import { Injectable, NotFoundException, OnModuleInit, OnModuleDestroy, InternalServerErrorException } from '@nestjs/common';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface BackupMeta {
  id: string;
  label: string;
  type: 'manual' | 'auto' | 'pre-restore';
  createdAt: string;
  size: number;
  db?: string;
}

@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private dir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  private timer?: NodeJS.Timeout;
  private binCache: Record<string, string> = {};

  onModuleInit() {
    this.ensureDir();
    // Automatic daily backup — checked hourly while the backend is running.
    this.timer = setInterval(() => this.autoMaybe().catch(() => {}), 60 * 60 * 1000);
    setTimeout(() => this.autoMaybe().catch(() => {}), 30 * 1000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private ensureDir() { if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true }); }

  private db() {
    const u = new URL(process.env.DATABASE_URL || '');
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username),
      pass: decodeURIComponent(u.password),
      name: u.pathname.slice(1).split('?')[0],
    };
  }

  /** Locate a PostgreSQL client binary (pg_dump / pg_restore / psql). */
  async resolveBin(bin: 'pg_dump' | 'pg_restore' | 'psql'): Promise<string> {
    if (this.binCache[bin]) return this.binCache[bin];
    const ext = process.platform === 'win32' ? '.exe' : '';
    const candidates: string[] = [];
    const envBin = process.env['BACKUP_' + bin.toUpperCase()];
    if (envBin) candidates.push(envBin);
    if (process.env.BACKUP_PG_BIN) candidates.push(path.join(process.env.BACKUP_PG_BIN, bin + ext));
    candidates.push(bin); // on PATH
    if (process.platform === 'win32') {
      const base = 'C:\\Program Files\\PostgreSQL';
      try {
        const vers = fs.readdirSync(base)
          .filter(d => fs.existsSync(path.join(base, d, 'bin', bin + ext)))
          .sort().reverse();
        for (const v of vers) candidates.push(path.join(base, v, 'bin', bin + ext));
      } catch {}
    }
    for (const c of candidates) {
      try { await execFileAsync(c, ['--version']); this.binCache[bin] = c; return c; } catch {}
    }
    throw new InternalServerErrorException(
      `Could not find ${bin}. Install the PostgreSQL client tools, or set BACKUP_PG_BIN to your PostgreSQL "bin" folder (e.g. C:\\Program Files\\PostgreSQL\\16\\bin).`,
    );
  }

  async create(label = '', type: BackupMeta['type'] = 'manual'): Promise<BackupMeta> {
    this.ensureDir();
    const bin = await this.resolveBin('pg_dump');
    const d = this.db();
    const ts = new Date();
    const stamp = ts.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const id = `tfm-${stamp}-${type}`;
    const file = path.join(this.dir, id + '.dump');
    await execFileAsync(
      bin,
      ['-h', d.host, '-p', String(d.port), '-U', d.user, '-d', d.name, '-Fc', '--no-owner', '--no-privileges', '-f', file],
      { env: { ...process.env, PGPASSWORD: d.pass }, maxBuffer: 1024 * 1024 * 128 },
    );
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    const meta: BackupMeta = { id, label, type, createdAt: ts.toISOString(), size, db: d.name };
    fs.writeFileSync(file + '.json', JSON.stringify(meta));
    if (type === 'auto') this.retention();
    return meta;
  }

  list(): BackupMeta[] {
    this.ensureDir();
    return fs.readdirSync(this.dir)
      .filter(f => f.endsWith('.dump'))
      .map(f => {
        let meta: any = {};
        try { meta = JSON.parse(fs.readFileSync(path.join(this.dir, f + '.json'), 'utf8')); } catch {}
        const st = fs.statSync(path.join(this.dir, f));
        return {
          id: f.replace(/\.dump$/, ''),
          label: meta.label || '',
          type: meta.type || 'manual',
          createdAt: meta.createdAt || st.mtime.toISOString(),
          size: meta.size || st.size,
          db: meta.db,
        } as BackupMeta;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  filePath(id: string): string {
    const safe = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const file = path.join(this.dir, safe + '.dump');
    if (!fs.existsSync(file)) throw new NotFoundException('Backup not found');
    return file;
  }

  remove(id: string) {
    const file = this.filePath(id);
    fs.unlinkSync(file);
    if (fs.existsSync(file + '.json')) fs.unlinkSync(file + '.json');
    return { ok: true };
  }

  /**
   * Restore a backup into the live database.
   * 1) takes an automatic "pre-restore" safety snapshot so you can switch back,
   * 2) drops other DB connections (best effort), 3) restores the dump in place.
   */
  async restore(id: string) {
    const file = this.filePath(id);
    const d = this.db();

    // 1) safety snapshot of the CURRENT data
    let safety: BackupMeta;
    try {
      safety = await this.create('Auto safety before restore', 'pre-restore');
    } catch (e: any) {
      throw new InternalServerErrorException('Could not create a safety backup before restoring — restore aborted. ' + (e?.message || ''));
    }

    // 2) best-effort: terminate other connections so DROP/restore isn't blocked
    try {
      const psql = await this.resolveBin('psql');
      await execFileAsync(
        psql,
        ['-h', d.host, '-p', String(d.port), '-U', d.user, '-d', d.name, '-c',
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${d.name}' AND pid <> pg_backend_pid();`],
        { env: { ...process.env, PGPASSWORD: d.pass } },
      );
    } catch {}

    // 3) restore (custom-format dump) into the same database
    const pgRestore = await this.resolveBin('pg_restore');
    try {
      await execFileAsync(
        pgRestore,
        ['-h', d.host, '-p', String(d.port), '-U', d.user, '-d', d.name, '--clean', '--if-exists', '--no-owner', '--no-privileges', file],
        { env: { ...process.env, PGPASSWORD: d.pass }, maxBuffer: 1024 * 1024 * 128 },
      );
    } catch (e: any) {
      throw new InternalServerErrorException('Restore failed: ' + (e?.stderr || e?.message || 'unknown error') + ' — your data is unchanged; the safety backup was created.');
    }
    return { ok: true, restored: id, safetyBackup: safety };
  }

  /** Tooling status for the UI. */
  async status() {
    let pgDump = false, msg = '';
    try { await this.resolveBin('pg_dump'); pgDump = true; }
    catch (e: any) { msg = e?.message || 'pg_dump not found'; }
    const list = this.list();
    const lastAuto = list.find(b => b.type === 'auto');
    return {
      ready: pgDump,
      message: pgDump ? '' : msg,
      dir: this.dir,
      count: list.length,
      lastBackupAt: list[0]?.createdAt || null,
      lastAutoAt: lastAuto?.createdAt || null,
    };
  }

  private async autoMaybe() {
    const list = this.list();
    const last = list[0];
    const since = last ? Date.now() - new Date(last.createdAt).getTime() : Infinity;
    if (since > 24 * 60 * 60 * 1000) {
      try { await this.create('Scheduled daily backup', 'auto'); } catch {}
    }
  }

  private retention(keep = 14) {
    const autos = this.list().filter(b => b.type === 'auto');
    autos.slice(keep).forEach(b => { try { this.remove(b.id); } catch {} });
  }
}

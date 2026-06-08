import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const REDIRECT_BASE = process.env.OAUTH_REDIRECT_BASE || 'http://localhost:3001/api/v1';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const CFG: Record<string, any> = {
  GDRIVE: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive openid email profile',
  },
  DROPBOX: {
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: 'files.metadata.read files.content.read account_info.read',
  },
};

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  private cfg(provider: string) {
    const c = CFG[provider];
    if (!c) throw new BadRequestException('Unknown provider');
    if (!c.clientId || !c.clientSecret) throw new BadRequestException(`${provider} is not configured on the server (missing client id/secret env vars).`);
    return c;
  }
  private redirectUri(provider: string) { return `${REDIRECT_BASE}/integrations/${provider}/callback`; }

  authUrl(provider: string) {
    const c = this.cfg(provider);
    const redirect = this.redirectUri(provider);
    if (provider === 'GDRIVE') {
      const p = new URLSearchParams({ client_id: c.clientId, redirect_uri: redirect, response_type: 'code', scope: c.scope, access_type: 'offline', prompt: 'consent', state: provider });
      return { url: `${c.authUrl}?${p.toString()}` };
    }
    // Dropbox
    const p = new URLSearchParams({ client_id: c.clientId, redirect_uri: redirect, response_type: 'code', token_access_type: 'offline', scope: c.scope, state: provider });
    return { url: `${c.authUrl}?${p.toString()}` };
  }

  /** Exchange the auth code for tokens, fetch account info, store. Returns the app URL to redirect back to. */
  async handleCallback(provider: string, code: string): Promise<string> {
    const c = this.cfg(provider);
    const body = new URLSearchParams({
      code, grant_type: 'authorization_code', client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: this.redirectUri(provider),
    });
    const res = await fetch(c.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new BadRequestException(`Token exchange failed: ${await res.text()}`);
    const tok: any = await res.json();
    const expiresAt = tok.expires_in ? new Date(Date.now() + (tok.expires_in - 60) * 1000) : null;

    let accountName: string | null = null, accountEmail: string | null = null;
    try {
      if (provider === 'GDRIVE') {
        const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
        if (u.ok) { const j: any = await u.json(); accountName = j.name; accountEmail = j.email; }
      } else {
        const u = await fetch('https://api.dropboxapi.com/2/users/get_current_account', { method: 'POST', headers: { Authorization: `Bearer ${tok.access_token}` } });
        if (u.ok) { const j: any = await u.json(); accountName = j?.name?.display_name; accountEmail = j?.email; }
      }
    } catch { /* non-fatal */ }

    await this.prisma.integrationConnection.upsert({
      where: { provider },
      update: { accessToken: tok.access_token, refreshToken: tok.refresh_token || undefined, expiresAt, scope: tok.scope || c.scope, accountName, accountEmail },
      create: { provider, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt, scope: tok.scope || c.scope, accountName, accountEmail },
    });
    return `${APP_URL}/setup/integrations?connected=${provider}`;
  }

  /** Return a valid access token, refreshing if needed. */
  private async getToken(provider: string): Promise<string> {
    const conn = await this.prisma.integrationConnection.findUnique({ where: { provider } });
    if (!conn?.accessToken) throw new BadRequestException(`${provider} is not connected.`);
    if (conn.expiresAt && conn.expiresAt.getTime() > Date.now()) return conn.accessToken;
    if (!conn.refreshToken) return conn.accessToken; // can't refresh; try as-is
    const c = this.cfg(provider);
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refreshToken, client_id: c.clientId, client_secret: c.clientSecret });
    const res = await fetch(c.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new BadRequestException(`Token refresh failed: ${await res.text()}`);
    const tok: any = await res.json();
    const expiresAt = tok.expires_in ? new Date(Date.now() + (tok.expires_in - 60) * 1000) : null;
    await this.prisma.integrationConnection.update({ where: { provider }, data: { accessToken: tok.access_token, expiresAt } });
    return tok.access_token;
  }

  async status() {
    const conns = await this.prisma.integrationConnection.findMany({ select: { provider: true, accountName: true, accountEmail: true, updatedAt: true } });
    const configured = { GDRIVE: !!(CFG.GDRIVE.clientId && CFG.GDRIVE.clientSecret), DROPBOX: !!(CFG.DROPBOX.clientId && CFG.DROPBOX.clientSecret) };
    return { connections: conns, configured };
  }

  async disconnect(provider: string) {
    await this.prisma.integrationConnection.deleteMany({ where: { provider } });
    return { ok: true };
  }

  /** List files/folders from the connected account. */
  async listFiles(provider: string, query?: string) {
    const token = await this.getToken(provider);
    if (provider === 'GDRIVE') {
      const q = query ? `name contains '${query.replace(/'/g, "")}' and trashed=false` : 'trashed=false';
      const url = `https://www.googleapis.com/drive/v3/files?pageSize=50&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,iconLink)&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new BadRequestException(`Drive list failed: ${await r.text()}`);
      const j: any = await r.json();
      return (j.files || []).map((f: any) => ({ id: f.id, name: f.name, url: f.webViewLink || `https://drive.google.com/open?id=${f.id}`, mimeType: f.mimeType }));
    }
    // Dropbox
    const endpoint = query ? 'https://api.dropboxapi.com/2/files/search_v2' : 'https://api.dropboxapi.com/2/files/list_folder';
    const payload = query ? { query } : { path: '', recursive: false, limit: 50 };
    const r = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new BadRequestException(`Dropbox list failed: ${await r.text()}`);
    const j: any = await r.json();
    const entries = query ? (j.matches || []).map((m: any) => m.metadata?.metadata).filter(Boolean) : j.entries || [];
    return entries.filter((e: any) => e['.tag'] === 'file').map((e: any) => ({ id: e.id, name: e.name, path: e.path_lower, mimeType: '' }));
  }

  /** Import a chosen file into the project document vault (as a shareable link). */
  async importToVault(provider: string, data: { projectId: string; id?: string; name: string; url?: string; path?: string; category?: string }, userId?: string) {
    let url = data.url;
    if (provider === 'DROPBOX' && data.path) {
      const token = await this.getToken('DROPBOX');
      // create or fetch a shared link
      const mk = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: data.path }),
      });
      if (mk.ok) { const j: any = await mk.json(); url = j.url; }
      else {
        const list = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: data.path }),
        });
        if (list.ok) { const j: any = await list.json(); url = j.links?.[0]?.url; }
      }
    }
    if (!url) throw new BadRequestException('Could not resolve a shareable link for the file.');
    return this.prisma.projectDocument.create({
      data: {
        projectId: data.projectId, name: data.name || 'Document', kind: 'LINK',
        provider, url, category: data.category || null, uploadedById: userId || null,
      },
    });
  }
}

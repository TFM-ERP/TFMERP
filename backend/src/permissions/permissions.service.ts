import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export const MODULES = ['home', 'finance', 'crm', 'rentals', 'partners', 'production', 'hr', 'compliance', 'reports', 'setup', 'travel_pii'] as const;
// Roles that may see traveller passport/visa/ID PII by default (editable in Settings).
const PII_DEFAULT_ROLES = ['SYSTEM_ADMIN', 'PRODUCTION_MANAGER', 'TRAVEL_COORDINATOR'];
export type ModuleKey = typeof MODULES[number];

// Levels: 0 none · 1 view · 2 edit · 3 manage
const N = 0, V = 1, E = 2, M = 3;
const all = (lvl: number) => MODULES.reduce((o, m) => ({ ...o, [m]: lvl }), {} as Record<string, number>);

// Sensible defaults per role — editable later in Settings → Roles & Permissions.
const DEFAULTS: Record<string, Record<string, number>> = {
  SYSTEM_ADMIN: all(M),
  FINANCE_MANAGER: { ...all(V), home: V, finance: M, compliance: M, reports: M, partners: E },
  ACCOUNTANT: { ...all(N), home: V, finance: E, compliance: V, reports: V, partners: V },
  RENTAL_MANAGER: { ...all(V), home: V, rentals: M, partners: E, compliance: V, reports: V, finance: V },
  RENTAL_COORDINATOR: { ...all(N), home: V, rentals: E, partners: V },
  DISPATCHER: { ...all(N), home: V, rentals: E },
  DRIVER: { ...all(N), home: V, rentals: V },
  MAINTENANCE: { ...all(N), home: V, rentals: E },
  PRODUCTION_MANAGER: { ...all(V), home: V, production: M, finance: V, reports: V },
  PRODUCTION_COORDINATOR: { ...all(N), home: V, production: E },
  CREW: { ...all(N), home: V, production: V },
  HR_MANAGER: { ...all(N), home: V, hr: M, compliance: V, reports: V },
  SALES: { ...all(N), home: V, finance: E, crm: M, partners: E, rentals: V, reports: V },
  TALENT_REP: { ...all(N), home: V, production: V }, // sees only their own talent (filtered server-side)
  TRAVEL_COORDINATOR: { ...all(N), home: V, production: E, travel_pii: M }, // travel/logistics desk
};

/** travel_pii default for a role unless explicitly set in Settings. */
const piiDefault = (role: string) => (role === 'SYSTEM_ADMIN' || PII_DEFAULT_ROLES.includes(role) ? M : N);

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try { await this.ensureSeeded(); } catch {}
  }

  async ensureSeeded() {
    const count = await this.prisma.rolePermission.count();
    if (count > 0) return;
    const rows: any[] = [];
    for (const [role, perms] of Object.entries(DEFAULTS))
      for (const [module, level] of Object.entries(perms))
        rows.push({ role, module, level });
    await this.prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }

  /** Effective module→level map for a role (stored values, falling back to defaults). */
  async forRole(role: string): Promise<Record<string, number>> {
    const stored = await this.prisma.rolePermission.findMany({ where: { role: role as any } });
    const map: Record<string, number> = { ...(DEFAULTS[role] || all(N)) };
    for (const r of stored) map[r.module] = r.level;
    // travel_pii is off by default (sensitive) unless the role is privileged or explicitly granted.
    if (!stored.some((r) => r.module === 'travel_pii')) map['travel_pii'] = piiDefault(role);
    // System admin always full
    if (role === 'SYSTEM_ADMIN') return all(M);
    return map;
  }

  /** Full matrix for the admin editor. */
  async matrix() {
    await this.ensureSeeded();
    const stored = await this.prisma.rolePermission.findMany();
    const out: Record<string, Record<string, number>> = {};
    for (const role of Object.keys(DEFAULTS)) out[role] = { ...(DEFAULTS[role] || all(N)), travel_pii: piiDefault(role) };
    for (const r of stored) { out[r.role] = out[r.role] || all(N); out[r.role][r.module] = r.level; }
    return { modules: MODULES, roles: Object.keys(DEFAULTS), matrix: out };
  }

  async setForRole(role: string, perms: Record<string, number>) {
    const ops = MODULES.map(module =>
      this.prisma.rolePermission.upsert({
        where: { role_module: { role: role as any, module } },
        update: { level: perms[module] ?? 0 },
        create: { role: role as any, module, level: perms[module] ?? 0 },
      }),
    );
    await this.prisma.$transaction(ops);
    return this.forRole(role);
  }
}

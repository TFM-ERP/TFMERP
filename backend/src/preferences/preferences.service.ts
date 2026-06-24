import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-UX Phase 0 — Appearance & theme governance.
 * Backed by the additive Prisma models UserPreference + OrgThemePolicy.
 * NOTE: compiles once `prisma db:push` has regenerated the client with those models.
 */
const ADMIN = /ADMIN/i; // SYSTEM_ADMIN, etc.

const DEFAULT_PREF = {
  themeId: 'graphite',
  mode: 'dark',
  readingMode: true,
  highContrast: false,
  density: 'comfortable',
  locale: 'en',
};
const DEFAULT_POLICY = {
  scope: 'global',
  mode: 'restricted',
  allowedThemeIds: ['graphite', 'studio', 'ink'] as string[],
  forcedThemeId: null as string | null,
  defaultThemeId: 'graphite',
};

type PrefPatch = Partial<{ themeId: string; mode: string; readingMode: boolean; highContrast: boolean; density: string; locale: string }>;
type PolicyPatch = Partial<{ mode: string; allowedThemeIds: string[]; forcedThemeId: string | null; defaultThemeId: string }>;

const prune = <T extends object>(o: T): Partial<T> => {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
};

@Injectable()
export class PreferencesService {
  constructor(private prisma: PrismaService) {}

  /** Current user's appearance preference (falls back to defaults if unset). */
  async getPreference(userId: string) {
    const pref = await this.prisma.userPreference.findUnique({ where: { userId } });
    return pref ?? { userId, ...DEFAULT_PREF };
  }

  /** Upsert the current user's appearance preference. */
  async setPreference(userId: string, body: PrefPatch) {
    const data = prune({
      themeId: body.themeId,
      mode: body.mode,
      readingMode: body.readingMode,
      highContrast: body.highContrast,
      density: body.density,
      locale: body.locale,
    });
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_PREF, ...data },
      update: data,
    });
  }

  /** The org-wide theme policy (singleton, scope = "global"). Readable by any signed-in user. */
  async getPolicy() {
    const p = await this.prisma.orgThemePolicy.findUnique({ where: { scope: 'global' } });
    return p ?? DEFAULT_POLICY;
  }

  /** Update the org policy — admin only (role checked server-side, not trusting the client). */
  async setPolicy(userId: string, body: PolicyPatch) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !ADMIN.test(String(user.role))) throw new ForbiddenException('Admin only');
    const data = prune({
      mode: body.mode,
      allowedThemeIds: body.allowedThemeIds,
      forcedThemeId: body.forcedThemeId,
      defaultThemeId: body.defaultThemeId,
    });
    return this.prisma.orgThemePolicy.upsert({
      where: { scope: 'global' },
      create: { ...DEFAULT_POLICY, ...data },
      update: data,
    });
  }
}

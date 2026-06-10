import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AudioEnginesService } from './audio-engines.service';
import { VoiceOption } from './adapters';

/**
 * SYS-13c — Voice casting: detect characters on a revision, manage reusable voice profiles,
 * and bind characters → voices (+ a Narrator pseudo-character). Inherits the master script's
 * voicePalette where present (P5).
 */
@Injectable()
export class VoiceCastingService {
  constructor(private prisma: PrismaService, private engines: AudioEnginesService) {}

  private readonly CUE_RE = /^\s*([A-Z][A-Z0-9 .'\-]{1,30})(\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D)\.?\))?\s*$/;
  private readonly NON_CUE = new Set(['INT', 'EXT', 'CUT TO', 'FADE IN', 'FADE OUT', 'DISSOLVE TO', 'CONTINUED', 'THE END', 'TITLE', 'MONTAGE', 'OMITTED']);

  /** Characters with line counts, merged with any existing assignments. */
  async detect(revisionId: string) {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, select: { pageText: true } });
    if (!rev) throw new NotFoundException('Revision not found.');
    const counts = new Map<string, number>();
    for (const pg of ((rev.pageText as any[]) || [])) {
      for (const raw of String(pg.text || '').split('\n')) {
        const m = raw.trim().match(this.CUE_RE);
        const name = m ? m[1].trim().replace(/\s+/g, ' ') : '';
        if (m && name.length >= 2 && !this.NON_CUE.has(name) && !/^\d/.test(name) && name.split(' ').length <= 4) counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    const assignments = await this.prisma.characterVoiceAssignment.findMany({ where: { revisionId } });
    const aByName = new Map(assignments.map((a) => [a.characterName, a]));
    const profileIds = assignments.map((a) => a.voiceProfileId).filter(Boolean) as string[];
    const profiles = profileIds.length ? await this.prisma.voiceProfile.findMany({ where: { id: { in: profileIds } } }) : [];
    const pById = new Map(profiles.map((p) => [p.id, p]));
    const chars = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, lines]) => {
      const a = aByName.get(name);
      return { characterName: name, lines, assignment: a || null, voice: a?.voiceProfileId ? pById.get(a.voiceProfileId) || null : null, cast: !!a?.voiceProfileId };
    });
    const narrator = aByName.get('NARRATOR') || assignments.find((a) => a.isNarrator) || null;
    return { characters: chars, narrator: narrator ? { assignment: narrator, voice: narrator.voiceProfileId ? pById.get(narrator.voiceProfileId) || null : null } : null };
  }

  // ── Voice profiles ────────────────────────────────────────────────────────────
  listProfiles(q?: { scope?: string; projectId?: string; masterScriptId?: string }) {
    const where: any = {};
    if (q?.scope) where.scope = q.scope;
    if (q?.projectId) where.projectId = q.projectId;
    if (q?.masterScriptId) where.masterScriptId = q.masterScriptId;
    return this.prisma.voiceProfile.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }
  createProfile(b: any, userId?: string) {
    return this.prisma.voiceProfile.create({ data: {
      scope: b?.scope || 'PROJECT', projectId: b?.projectId || null, masterScriptId: b?.masterScriptId || null, ownerId: userId || null,
      name: b?.name || 'Voice', engineKey: b?.engineKey || 'BROWSER', externalVoiceId: b?.externalVoiceId || null,
      gender: b?.gender || null, ageRange: b?.ageRange || null, nationality: b?.nationality || null, nativeLanguage: b?.nativeLanguage || null,
      spokenLanguages: b?.spokenLanguages ?? null, accent: b?.accent || null, style: b?.style || null,
      defaultRate: b?.defaultRate ?? 1, defaultPitch: b?.defaultPitch ?? 1, emotionalRange: b?.emotionalRange ?? null,
      clonedFromTalentId: b?.clonedFromTalentId || null, sampleUrl: b?.sampleUrl || null, createdById: userId || null,
    } });
  }
  updateProfile(id: string, b: any) {
    const d: any = {};
    for (const k of ['name', 'engineKey', 'externalVoiceId', 'gender', 'ageRange', 'nationality', 'nativeLanguage', 'spokenLanguages', 'accent', 'style', 'defaultRate', 'defaultPitch', 'emotionalRange', 'sampleUrl', 'scope']) if (b?.[k] !== undefined) d[k] = b[k];
    return this.prisma.voiceProfile.update({ where: { id }, data: d });
  }
  removeProfile(id: string) { return this.prisma.voiceProfile.delete({ where: { id } }); }

  // ── Assignments ─────────────────────────────────────────────────────────────────
  async assign(revisionId: string, characterName: string, b: any, userId?: string) {
    return this.prisma.characterVoiceAssignment.upsert({
      where: { revisionId_characterName: { revisionId, characterName } },
      create: { revisionId, characterName, voiceProfileId: b?.voiceProfileId || null, talentId: b?.talentId || null, speakCharacterName: !!b?.speakCharacterName, overrides: b?.overrides ?? null, languageMap: b?.languageMap ?? null, isNarrator: characterName === 'NARRATOR' || !!b?.isNarrator, createdById: userId || null },
      update: { voiceProfileId: b?.voiceProfileId, talentId: b?.talentId, speakCharacterName: b?.speakCharacterName, overrides: b?.overrides, languageMap: b?.languageMap },
    });
  }
  unassign(id: string) { return this.prisma.characterVoiceAssignment.delete({ where: { id } }); }

  /**
   * Auto-cast: AI (Claude) reads each uncast character's dialogue and suggests a voice
   * profile (gender, age, nativeness, accent, style); when the resolved TTS engine has a
   * voice library (e.g. ElevenLabs) the best-matching voice is picked automatically.
   * Falls back gracefully: no ANTHROPIC_API_KEY → empty traits; no studio engine → Browser.
   */
  async autoCast(revisionId: string, projectId: string | undefined, userId?: string) {
    const { characters } = await this.detect(revisionId);
    const uncast = characters.filter((c) => !c.cast);
    if (!uncast.length) return { created: 0, ai: false, engineKey: null };

    // 1. AI trait suggestion from sampled dialogue (suggestions only — user can edit after)
    let traits = new Map<string, any>();
    let usedAi = false;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const samples = await this.sampleDialogue(revisionId, uncast.map((c) => c.characterName));
        traits = await this.suggestTraits(uncast.map((c) => ({ name: c.characterName, lines: c.lines, sample: samples.get(c.characterName) || '' })));
        usedAi = traits.size > 0;
      } catch { /* AI unavailable — continue with defaults */ }
    }

    // 2. Resolve the TTS engine; pull its voice library if it has one
    const routing = await this.engines.resolve('TTS', projectId).catch(() => null);
    let engineKey = routing?.engine?.key || 'BROWSER';
    let voices: VoiceOption[] = [];
    if (engineKey !== 'BROWSER') {
      try { voices = await this.engines.listEngineVoices(engineKey); }
      catch { engineKey = 'BROWSER'; }
    }

    // 3. Create a profile + assignment per character, matching a library voice when possible
    let created = 0;
    const usedVoiceIds = new Set<string>();
    for (const c of uncast) {
      const t = traits.get(c.characterName) || {};
      const match = voices.length ? this.matchVoice(t, voices, usedVoiceIds) : null;
      if (match) usedVoiceIds.add(match.id);
      const profile = await this.createProfile({
        scope: 'PROJECT', projectId,
        name: `${c.characterName} — ${match ? match.name : 'voice'}`,
        engineKey: match ? engineKey : 'BROWSER',
        externalVoiceId: match?.id || null,
        gender: t.gender || match?.gender || null,
        ageRange: t.ageRange || match?.age || null,
        nationality: t.nationality || null,
        nativeLanguage: t.nativeLanguage || null,
        accent: t.accent || match?.accent || null,
        style: t.style || null,
        sampleUrl: match?.previewUrl || null,
      }, userId);
      await this.assign(revisionId, c.characterName, { voiceProfileId: profile.id }, userId);
      created += 1;
    }
    return { created, ai: usedAi, engineKey: voices.length ? engineKey : 'BROWSER' };
  }

  // ── Auto-cast internals ────────────────────────────────────────────────────────

  /** Up to ~3 dialogue snippets per character, pulled from the revision's page text. */
  private async sampleDialogue(revisionId: string, names: string[]): Promise<Map<string, string>> {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, select: { pageText: true } });
    const want = new Set(names);
    const out = new Map<string, string[]>();
    let current: string | null = null;
    for (const pg of ((rev?.pageText as any[]) || [])) {
      for (const raw of String(pg.text || '').split('\n')) {
        const line = raw.trim();
        const m = line.match(this.CUE_RE);
        const cueName = m ? m[1].trim().replace(/\s+/g, ' ') : '';
        if (m && want.has(cueName)) { current = cueName; continue; }
        if (m || !line) { current = null; continue; }
        if (current) {
          const arr = out.get(current) || [];
          if (arr.length < 3 && !line.startsWith('(')) arr.push(line.slice(0, 160));
          out.set(current, arr);
          if (arr.length >= 3) current = null;
        }
      }
    }
    return new Map([...out.entries()].map(([k, v]) => [k, v.join(' / ')]));
  }

  /** Ask Claude for a voice profile per character. Forced tool use → schema-shaped JSON. */
  private async suggestTraits(chars: { name: string; lines: number; sample: string }[]): Promise<Map<string, any>> {
    const tool = {
      name: 'submit_voice_casting',
      description: 'Submit one voice-profile suggestion per character.',
      input_schema: {
        type: 'object',
        properties: {
          characters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                characterName: { type: 'string' },
                gender: { type: 'string', enum: ['male', 'female', 'neutral'] },
                ageRange: { type: 'string', description: 'e.g. child, teen, 20s, 30s, 40s, 50s, 60s+, elderly' },
                nationality: { type: 'string' },
                nativeLanguage: { type: 'string' },
                accent: { type: 'string', description: 'e.g. American, British, French-English' },
                style: { type: 'string', description: 'e.g. calm, intense, warm, authoritative' },
              },
              required: ['characterName', 'gender', 'ageRange'],
            },
          },
        },
        required: ['characters'],
      },
    };
    const system = [
      'You are an expert voice-casting director for audio table reads of film/TV scripts.',
      'For EVERY character below, infer the most likely voice profile from the character name and dialogue samples.',
      '- gender: male, female, or neutral. Infer from name/dialogue; when truly ambiguous use neutral.',
      '- ageRange: rough bracket (child, teen, 20s, 30s, 40s, 50s, 60s+, elderly).',
      '- nationality / nativeLanguage / accent: only when the name or dialogue suggests it (e.g. code-switching, foreign phrases); otherwise omit.',
      '- style: one or two words describing delivery, from the tone of the lines.',
      'Respond ONLY by calling the submit_voice_casting tool.',
    ].join('\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' } as any,
      body: JSON.stringify({
        model: process.env.SCRIPT_AUDIO_AI_MODEL || process.env.MM_AI_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'submit_voice_casting' },
        messages: [{ role: 'user', content: JSON.stringify({ characters: chars }) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API HTTP ${res.status}`);
    const data: any = await res.json().catch(() => null);
    const toolUse = (data?.content || []).find((b: any) => b?.type === 'tool_use' && b?.name === 'submit_voice_casting');
    const list: any[] = Array.isArray(toolUse?.input?.characters) ? toolUse.input.characters : [];
    return new Map(list.filter((c) => c?.characterName).map((c) => [String(c.characterName), c]));
  }

  /** Score library voices against suggested traits; prefer unused voices so the cast sounds distinct. */
  private matchVoice(t: any, voices: VoiceOption[], used: Set<string>): VoiceOption | null {
    const norm = (s?: string) => String(s || '').toLowerCase();
    const ageBucket = (s?: string) => {
      const v = norm(s);
      if (!v) return '';
      if (/child|teen|young|1\d|2\d|20s/.test(v)) return 'young';
      if (/old|elder|6\d|7\d|60s|70s|senior/.test(v)) return 'old';
      return 'middle_aged';
    };
    let best: VoiceOption | null = null; let bestScore = -1;
    for (const v of voices) {
      let score = 0;
      const g = norm(t.gender); const vg = norm(v.gender);
      if (g && vg) score += (g === vg || (g === 'neutral' && vg.includes('neutral'))) ? 4 : (g !== 'neutral' ? -3 : 0);
      const ta = ageBucket(t.ageRange); const va = ageBucket(v.age);
      if (ta && va) score += ta === va ? 2 : 0;
      const acc = norm(t.accent); const vacc = norm(v.accent);
      if (acc && vacc && (vacc.includes(acc) || acc.includes(vacc))) score += 2;
      const lang = norm(t.nativeLanguage); const vlang = norm(v.language);
      if (lang && vlang && (vlang.includes(lang) || lang.includes(vlang))) score += 1;
      if (!used.has(v.id)) score += 1.5;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
  }
}

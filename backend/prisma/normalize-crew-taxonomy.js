/* Crew Directory taxonomy normalization — run from the backend folder:
 *   node prisma/normalize-crew-taxonomy.js          (preview only — writes nothing)
 *   node prisma/normalize-crew-taxonomy.js --apply  (writes the changes)
 *
 * Rewrites free-text CrewMember.role / .department onto the canonical system
 * taxonomy (frontend/src/lib/filmCrew.ts · docs/film-crew-taxonomy.md) so naming
 * is unified for search & sort. Original values are preserved in the change report
 * (prisma/crew-normalize-report.json). Idempotent — canonical records are skipped.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// [regex on role text, canonical department, canonical role]
// First match wins — order from specific to generic.
const RULES = [
  [/exec(utive)?\.?\s*producer/i, 'Production (Producers)', 'Executive Producer'],
  [/co[- ]?producer/i, 'Production (Producers)', 'Co-Producer'],
  [/line\s*producer/i, 'Production (Producers)', 'Line Producer'],
  [/associate\s*producer/i, 'Production (Producers)', 'Associate Producer'],
  [/^producer\b/i, 'Production (Producers)', 'Producer'],
  [/2nd\s*unit\s*director/i, 'Direction', '2nd Unit Director'],
  [/director'?s?\s*assistant|assistant\s*to\s*.*(director|renny)/i, 'Direction', "Director's Assistant"],
  [/screen\s*writer|screenwriter/i, 'Writing', 'Screenwriter'],
  [/casting\s*director/i, 'Casting', 'Casting Director'],
  [/^casting\b/i, 'Casting', 'Casting Associate'],
  [/unit\s*production\s*manager|^upm$|production\s*manager/i, 'Production Office', 'Unit Production Manager (UPM)'],
  [/production\s*supervisor/i, 'Production Office', 'Production Supervisor'],
  [/production\s*co-?ordinator/i, 'Production Office', 'Production Coordinator'],
  [/production\s*secretary/i, 'Production Office', 'Production Secretary'],
  [/travel\s*co-?ordinator/i, 'Production Office', 'Travel Coordinator'],
  [/^(1st|first)\s*assist.*director/i, 'Assistant Directors', '1st Assistant Director'],
  [/^(2nd|second)\s*assist.*director/i, 'Assistant Directors', '2nd Assistant Director'],
  [/^(3rd|third)\s*assist.*director/i, 'Assistant Directors', '3rd Assistant Director'],
  [/set\s*pa\b/i, 'Assistant Directors', 'Set PA'],
  [/key\s*pa\b/i, 'Assistant Directors', 'Set PA'],
  [/production\s*assistant/i, 'Production Office', 'Office Production Assistant'],
  [/script\s*supervisor|continuity/i, 'Script / Continuity', 'Script Supervisor'],
  [/production\s*account/i, 'Accounting', 'Production Accountant'],
  [/payroll\s*account/i, 'Accounting', 'Payroll Accountant'],
  [/^accounts?\b|accounting/i, 'Accounting', 'Accounts Clerk'],
  [/director\s*of\s*photography|^dop\b|^dp\b|2nd\s*unit\s*dop/i, 'Camera', 'Director of Photography (DP)'],
  [/steadicam/i, 'Camera', 'Steadicam Operator'],
  [/focus\s*puller|1st\s*ac\b/i, 'Camera', '1st AC (Focus Puller)'],
  [/clapper|2nd\s*ac\b|2nd\s*unit\s*snd\s*ac/i, 'Camera', '2nd AC (Clapper Loader)'],
  [/\bdit\b/i, 'Camera', 'DIT'],
  [/drone/i, 'Camera', 'Drone Operator'],
  [/video\s*(assist|technician)|vto.*video|okto/i, 'Camera', 'Video Assist Operator'],
  [/(on\s*set\s*)?photographer|stills/i, 'Camera', 'Stills Photographer'],
  [/camera\s*operator|second.*dop\s*assistant|dop\s*assistant/i, 'Camera', 'Camera Operator'],
  [/key\s*grip/i, 'Grip', 'Key Grip'],
  [/best\s*b(o?y|y)\s*grip/i, 'Grip', 'Best Boy Grip'],
  [/dolly\s*grip/i, 'Grip', 'Dolly Grip'],
  [/(techn?ocrane|crane).*?(operator|rigger)?|russian\s*arm\s*boom/i, 'Grip', 'Crane/Technocrane Operator'],
  [/grip\s*(assistant|trainee)/i, 'Grip', 'Grip Trainee'],
  [/rigging\s*grip/i, 'Grip', 'Rigging Grip'],
  [/^grip\b/i, 'Grip', 'Grip'],
  [/gaffer/i, 'Electric / Lighting', 'Gaffer (Chief Lighting Technician)'],
  [/(lighting\s*)?best\s*boy(\s*electric)?/i, 'Electric / Lighting', 'Best Boy Electric'],
  [/spark|electrician|lighting\s*technician/i, 'Electric / Lighting', 'Electrician/Lighting Technician'],
  [/generator\s*op/i, 'Electric / Lighting', 'Generator Operator'],
  [/production\s*sound\s*mixer|sound\s*mixer/i, 'Sound (Production)', 'Production Sound Mixer'],
  [/boom\s*operator/i, 'Sound (Production)', 'Boom Operator'],
  [/sound\s*(utility|assistant|cable)/i, 'Sound (Production)', 'Sound Assistant / Cable Person'],
  [/production\s*designer/i, 'Art Department', 'Production Designer'],
  [/(asst\.?|assistant)\s*art\s*director/i, 'Art Department', 'Assistant Art Director'],
  [/art\s*director/i, 'Art Department', 'Art Director'],
  [/art\s*(department\s*)?co-?ordinator/i, 'Art Department', 'Art Department Coordinator'],
  [/storyboard/i, 'Art Department', 'Storyboard Artist'],
  [/graphics?\s*designer/i, 'Art Department', 'Graphic Designer'],
  [/set\s*decorator/i, 'Set Decoration', 'Set Decorator'],
  [/head\s*set\s*dresser|leadman/i, 'Set Decoration', 'Leadman'],
  [/set\s*dresser/i, 'Set Decoration', 'Set Dresser'],
  [/(set\s*)?buyer/i, 'Set Decoration', 'Buyer'],
  [/props?\s*master/i, 'Props', 'Property Master'],
  [/standby\s*props/i, 'Props', 'Standby Props'],
  [/armou?rer/i, 'Props', 'Armourer'],
  [/construction\s*(coordinator|manager)/i, 'Construction', 'Construction Coordinator'],
  [/carpenter/i, 'Construction', 'Carpenter'],
  [/scenic/i, 'Construction', 'Scenic Artist'],
  [/greensman|greens/i, 'Greens', 'Greensman'],
  [/costume\s*designer/i, 'Costume / Wardrobe', 'Costume Designer'],
  [/costume\s*supervisor|wardrobe\s*supervisor/i, 'Costume / Wardrobe', 'Costume Supervisor'],
  [/costumer\s*\(key\)|key\s*costumer/i, 'Costume / Wardrobe', 'Key Costumer'],
  [/costumer|wardrobe\s*assistant/i, 'Costume / Wardrobe', 'Set Costumer'],
  [/(seamstress|tailor|cutter|ager|dyer|art\s*finisher)/i, 'Costume / Wardrobe', 'Seamstress/Tailor'],
  [/hair\s*&?\s*make.?up\s*(supervisor|designer)/i, 'Hair & Makeup', 'Hair & Makeup Designer'],
  [/sfx.*make.?up|prosthetic/i, 'Hair & Makeup', 'SFX/Prosthetics Makeup Artist'],
  [/key\s*make.?up/i, 'Hair & Makeup', 'Key Makeup Artist'],
  [/(assistant\s*)?make.?up/i, 'Hair & Makeup', 'Makeup Artist'],
  [/(assistant\s*)?hair|barber|hairdresser/i, 'Hair & Makeup', 'Hair Stylist'],
  [/special\s*effects\s*assistant|sfx\s*(technician|assistant)/i, 'Special Effects (SFX)', 'SFX Technician'],
  [/special\s*effects|^sfx\b/i, 'Special Effects (SFX)', 'SFX Technician'],
  [/(visual\s*effects|vfx)\s*supervisor/i, 'Visual Effects (VFX)', 'VFX Supervisor'],
  [/compositor/i, 'Visual Effects (VFX)', 'Compositor'],
  [/roto|matte\s*paint/i, 'Visual Effects (VFX)', 'Roto/Paint Artist'],
  [/visual\s*effects|^vfx\b/i, 'Visual Effects (VFX)', 'CG Artist'],
  [/stunt\s*coordinator/i, 'Stunts', 'Stunt Coordinator'],
  [/driving\s*double|stunt\s*double/i, 'Stunts', 'Stunt Double'],
  [/precision\s*driver|russian\s*arm.*driver|police\s*driver|bike\s*rider/i, 'Stunts', 'Precision Driver'],
  [/stunt/i, 'Stunts', 'Stunt Performer'],
  [/location\s*manager/i, 'Locations', 'Location Manager'],
  [/location\s*co-?ordinator/i, 'Locations', 'Assistant Location Manager'],
  [/location\s*scout/i, 'Locations', 'Location Scout'],
  [/location\s*assistant/i, 'Locations', 'Location Assistant'],
  [/unit\s*manager/i, 'Locations', 'Unit Manager'],
  [/transport(ation)?\s*captain/i, 'Transportation', 'Transportation Captain'],
  [/transport(ation)?\s*(coordinator|dispatcher)/i, 'Transportation', 'Transportation Coordinator'],
  [/picture\s*(car|vehicles?)/i, 'Transportation', 'Picture Car Coordinator'],
  [/(truck|wardrobe|unit)?\s*driver|helper\s*\/?\s*driver/i, 'Transportation', 'Driver'],
  [/caterer|catering|chef|craft\s*service|crafty/i, 'Catering / Craft Service', 'Craft Service'],
  [/medic|first\s*aid|paramedic/i, 'Health & Safety / Medical', 'Set Medic'],
  [/security/i, 'Security', 'Site Security'],
  [/post.?production\s*supervisor/i, 'Editorial', 'Post-Production Supervisor'],
  [/1st\s*assistant\s*editor/i, 'Editorial', '1st Assistant Editor'],
  [/(film\s*)?editor/i, 'Editorial', 'Editor'],
  [/colou?rist/i, 'Colour / DI', 'Colorist'],
  [/sound\s*designer/i, 'Sound Post', 'Sound Designer'],
  [/composer/i, 'Music', 'Composer'],
  [/publicist/i, 'Publicity / Stills', 'Unit Publicist'],
  [/epk|behind.the.scenes/i, 'Publicity / Stills', 'EPK Crew'],
  [/^(cast|actor|actress)\b/i, 'Cast / Talent', 'Supporting Cast'],
  [/^director\b/i, 'Direction', 'Director'],
];

// Department-context fallback for bare "Helper" etc.
function contextFallback(role, dept) {
  const d = (dept || '').toLowerCase();
  if (/helper/i.test(role || '')) {
    if (d.includes('light')) return ['Electric / Lighting', 'Electrical Trainee'];
    if (d.includes('grip')) return ['Grip', 'Grip Trainee'];
    return ['Other', role];
  }
  return null;
}

function mapRole(role, dept) {
  const r = (role || '').trim();
  if (!r) return null;
  for (const [re, d, canon] of RULES) if (re.test(r)) return [d, canon];
  return contextFallback(r, dept);
}

async function main() {
  const members = await prisma.crewMember.findMany({ select: { id: true, name: true, role: true, department: true } });
  const changes = []; const unmatched = [];
  for (const m of members) {
    const hit = mapRole(m.role, m.department);
    if (!hit) { if (m.role) unmatched.push({ name: m.name, role: m.role, department: m.department }); continue; }
    const [dept, role] = hit;
    if (m.department === dept && m.role === role) continue; // already canonical
    changes.push({ id: m.id, name: m.name, from: { department: m.department, role: m.role }, to: { department: dept, role } });
    if (APPLY) await prisma.crewMember.update({ where: { id: m.id }, data: { department: dept, role } });
  }
  fs.writeFileSync(path.join(__dirname, 'crew-normalize-report.json'), JSON.stringify({ appliedAt: APPLY ? new Date() : null, changes, unmatched }, null, 1));
  console.log(`${APPLY ? 'APPLIED' : 'PREVIEW (re-run with --apply to write)'} — ${changes.length} record(s) normalized, ${unmatched.length} unmatched (left as-is).`);
  for (const c of changes.slice(0, 15)) console.log(`  ${c.name}: "${c.from.role}" → ${c.to.department} · ${c.to.role}`);
  if (changes.length > 15) console.log(`  … and ${changes.length - 15} more (see prisma/crew-normalize-report.json)`);
  if (unmatched.length) console.log('Unmatched roles:', [...new Set(unmatched.map(u => u.role))].slice(0, 20).join(' | '));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

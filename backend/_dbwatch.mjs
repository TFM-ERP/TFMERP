import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const REV = 'cmqv6y07a00095av0jemgvsgc';
const DOC = 'cmqqiliff00005avskb2syjbw';
const rev0 = await p.scriptRevision.findUnique({ where: { id: REV }, select: { createdAt: true } });
const t0 = new Date(rev0.createdAt).getTime();
console.log('rev created (trigger):', rev0.createdAt.toISOString());
let writingStart = 0;
const SEED = 'FADE IN:\n\nGenerating…';
while (true) {
  await new Promise(r => setTimeout(r, 10000));
  const rev = await p.scriptRevision.findUnique({ where: { id: REV }, select: { pageText: true, pageCount: true } }).catch(()=>null);
  if (!rev) { console.log('rev gone'); break; }
  const pages = Array.isArray(rev.pageText) ? rev.pageText : [];
  const txt = pages.map(x => x.text || '').join('\n');
  const headings = (txt.match(/^\s*\d+\s{2,}(داخلي|خارجي|INT|EXT)/gmu) || []).length;
  const writing = txt && txt !== SEED && !txt.startsWith('FADE IN:\n\nGenerating') && txt.length > 60;
  const el = Math.round((Date.now()-t0)/1000);
  if (writing && !writingStart) { writingStart = Date.now(); console.log(`[${el}s] WRITING started (planning ≈ ${el}s) — original-240s-guard would-false-fire: ${el>240}`); }
  const doc = await p.scriptDocument.findUnique({ where: { id: DOC }, select: { activeRevisionId: true } });
  const done = doc.activeRevisionId === REV;
  console.log(`[${el}s] pages ${rev.pageCount} | heading-scenes ${headings} | chars ${txt.length} | active ${done}`);
  if (done && headings > 0) { console.log(`DONE | rendered scenes ≈ ${headings} | pages ${rev.pageCount} | planning ≈ ${writingStart?Math.round((writingStart-t0)/1000):'?'}s`); break; }
  if (el > 2400) { console.log('timeout 40min'); break; }
}
await p.$disconnect();

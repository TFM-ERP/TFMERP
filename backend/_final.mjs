import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const REV = 'cmqv6y07a00095av0jemgvsgc', DOC = 'cmqqiliff00005avskb2syjbw';
let last = 0;
while (true) {
  await new Promise(r => setTimeout(r, 30000));
  const rev = await p.scriptRevision.findUnique({ where: { id: REV }, select: { pageText: true, pageCount: true } }).catch(()=>null);
  if (!rev) break;
  const txt = (Array.isArray(rev.pageText)?rev.pageText:[]).map(x=>x.text||'').join('\n');
  const headings = (txt.match(/^\s*\d+\s{2,}(داخلي|خارجي|INT|EXT)/gmu)||[]).length;
  const errored = /did not return prose|did not finish/.test(txt);
  const doc = await p.scriptDocument.findUnique({ where: { id: DOC }, select: { activeRevisionId: true } });
  const active = doc.activeRevisionId === REV;
  const sceneRows = await p.scriptScene.count({ where: { revisionId: REV } }).catch(()=>0);
  if (headings !== last) { console.log(new Date().toISOString().slice(11,19), 'scenes', headings, 'pages', rev.pageCount, 'active', active, 'sceneRows', sceneRows); last = headings; }
  if (active || errored) { console.log('FINAL:', errored ? 'ERROR' : 'DONE', '| rendered scenes', headings, '| pages', rev.pageCount, '| ScriptScene rows', sceneRows); break; }
}
await p.$disconnect();

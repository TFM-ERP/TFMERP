import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseScenes } from './scene-parse.util';

// English sluglines (the import path's existing behaviour must be preserved).
test('parseScenes: English INT/EXT sluglines', () => {
  const scenes = parseScenes(['1  INT. DINER - DAY\nSteam off the coffee.\n\n2  EXT. HIGHWAY - NIGHT\nA ribbon through nothing.']);
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].intExt, 'INT');
  assert.equal(scenes[0].dayNight, 'DAY');
  assert.equal(scenes[0].sceneNumber, '1');
  assert.equal(scenes[1].intExt, 'EXT');
  assert.equal(scenes[1].dayNight, 'NIGHT');
});

test('parseScenes: English INT/EXT combined slug', () => {
  const scenes = parseScenes(['1  INT./EXT. CAR - CONTINUOUS']);
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].intExt, 'INT/EXT');
  assert.equal(scenes[0].dayNight, 'CONTINUOUS');
});

// عنترة's ACTUAL stored headings (pulled verbatim from the DB — real bytes,
// incl. Arabic commas in scenes 3/13/15/18). داخلي=INT, خارجي=EXT;
// فجر=DAWN, نهار=DAY, ليل=NIGHT.
const ANTARAH_HEADINGS = [
  '1  خارجي - مضارب بني عبس - فجر',
  '2  خارجي - مضارب بني عبس - فجر',
  '3  خارجي - أطراف المضارب، ساحة التدريب - نهار',
  '4  خارجي - مرعى الأغنام - نهار',
  '5  خارجي - عين الماء - نهار',
  '6  خارجي - عين الماء والطريق المؤدي إليها - نهار',
  '7  خارجي - عين الماء - نهار',
  '8  خارجي - مضارب بني عبس - نهار',
  '9  داخلي - خيمة زبيبة - ليل',
  '10  داخلي - خيمة عنترة - ليل',
  '11  داخلي - خيمة مالك بن قراد - نهار',
  '12  خارجي - أطراف المضارب - فجر',
  '13  خارجي - وادي الجن، الصخور الظلامية - ليل',
  '14  خارجي - جبال صخرية وعرة - نهار',
  '15  خارجي - أرض العماليق، سهل بازلتي - نهار',
  '16  خارجي - مخيّم العماليق - ليل',
  '17  داخلي - قصر الحيرة - نهار',
  '18  خارجي - حدود إفريقيا، ميادين المعركة - نهار',
  '19  داخلي - خيمة زبيبة في مضارب بني عبس - ليل',
];

test('parseScenes: عنترة Arabic sluglines → 19 scenes with correct INT/EXT + day/night', () => {
  // Develop stores pageText as a page array; bodies stubbed "(The scene continues.)".
  const page = ANTARAH_HEADINGS.map((h) => h + '\n\n(The scene continues.)\n').join('\n');
  const scenes = parseScenes([page]);
  assert.equal(scenes.length, 19);
  // خارجي → EXT, داخلي → INT
  assert.equal(scenes[0].intExt, 'EXT'); // 1 خارجي
  assert.equal(scenes[8].intExt, 'INT'); // 9 داخلي
  // day/night mapping
  assert.equal(scenes[0].dayNight, 'DAWN'); // فجر
  assert.equal(scenes[2].dayNight, 'DAY'); // نهار
  assert.equal(scenes[8].dayNight, 'NIGHT'); // ليل
  // scene numbers carried through
  assert.equal(scenes[0].sceneNumber, '1');
  assert.equal(scenes[18].sceneNumber, '19');
  // location with an embedded Arabic comma is preserved in the slugline
  assert.ok(scenes[2].slugline.includes('أطراف المضارب، ساحة التدريب'));
  // a location is never split by the comma — the day/night is still the trailing word
  assert.equal(scenes[12].dayNight, 'NIGHT'); // 13: ...الظلامية - ليل
});

test('parseScenes: no sluglines → no scenes (honest empty, not a crash)', () => {
  assert.deepEqual(parseScenes(['Just some prose with no headings at all.']), []);
  assert.deepEqual(parseScenes([]), []);
});

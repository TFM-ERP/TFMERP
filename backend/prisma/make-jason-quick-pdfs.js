/* Generates placeholder screenplay PDFs for the "Jason Quick" seed so the Script viewer
 * has real pages to render. Writes 3 revisions into backend/uploads/ (served at /uploads/...).
 * Run from the backend folder:  node prisma/make-jason-quick-pdfs.js
 * (Run AFTER `node prisma/seed-jason-quick.js`, or before — the seed only stores the path.)
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const OUT_DIR = path.join(process.cwd(), 'uploads');

// US Letter, Courier 12 — standard screenplay metrics
const W = 612, H = 792, SIZE = 12, LH = 14.4;
const M_TOP = 720, M_BOTTOM = 72, M_LEFT = 108; // 1.5" left margin
const IND = { action: 0, char: 215, paren: 165, dialogue: 108 + 36 };
const CPL_ACTION = 60, CPL_DIALOGUE = 35; // chars per line by element

// Screenplay — the 7 seeded scenes (1,2,3,12,13,14,15) keep their exact sluglines so the
// outline + script notes line up; connective scenes fill out a full action feature.
const A = (text) => ({ type: 'action', text });
const C = (text) => ({ type: 'char', text });
const D = (text) => ({ type: 'dialogue', text });
const S = (text) => ({ type: 'scene', text });

const SCRIPT = [
  S('1   EXT. HARBOR WAREHOUSE - NIGHT'),
  A('Rain hammers the docks. A figure rises from the black water — JASON QUICK (40s), scarred, soaked, a ghost with a grudge. A signal FLARE arcs overhead and paints him red.'),
  A('He moves. Silent. Purposeful. Two GUARDS share a cigarette under a sodium lamp, complacent, bored. They never hear him coming.'),
  C('QUICK'), D('(low) Wrong night to draw the short straw.'),
  A('A choke, a twist, two bodies eased to the wet concrete. Quick lifts a key-card and a radio. Somewhere across the yard, a CRANE groans, lowering a container marked with a red star.'),

  S('2   INT. WAREHOUSE - CONTINUOUS'),
  A('Crates to the rafters. Contraband cases. Quick slips between them, a HERO BERETTA M9 low in his grip. Boot scuffs. Whispers. He counts six shooters by their shadows.'),
  A('A pallet light SNAPS on. VIKTOR DRACO (50s) steps into it, arms wide, theatrical, untouchable.'),
  C('DRACO'), D('Jason Quick. Back from the dead. Again. You really should learn to stay buried.'),
  C('QUICK'), D("Tried it. Didn't take."),
  A('The room ERUPTS. Muzzle flash strobes the dark. Quick drops two, takes cover behind a forklift, a HIGH FALL sends a shooter off the catwalk into stacked crates. Squib hits walk the wall an inch from his head.'),
  A('Draco is already gone — a service door swinging, an engine catching outside.'),

  S('3   EXT. ROOFTOP - NIGHT'),
  A("Quick bursts onto the helipad roof. Draco's last man — a slab of muscle — meets him fist-first. Three brutal beats; they trade blows to the ledge, the city a glittering drop below."),
  C('QUICK'), D("(breathless) Tell Draco I'm not the one who should be running."),
  A("He lets the man dangle over the edge, then hauls him back. Quick doesn't kill. Not tonight. Below, a helicopter peels away into the rain."),

  S('4   INT. FBI FIELD OFFICE - DAY'),
  A('Fluorescent light. AGENT ELLIS (40s) studies a wall of surveillance photos: Quick, Draco, a freighter named the SEVASTOPOL. A junior agent hovers.'),
  C('ELLIS'), D("He's not a suspect. He's a symptom. Find me the disease."),
  A('Ellis pockets a burner phone he should not have. A small betrayal, quietly planted.'),

  S('5   EXT. DESERT AIRSTRIP - DAY'),
  A('Heat shimmer. A cargo plane idles. THE BROKER (50s) trades a briefcase for a pallet of crates, sweating through a linen suit, working both sides as always.'),
  C('THE BROKER'), D("Everyone pays me. That's the beauty of standing in the middle of the road."),
  A('A drone lifts off, unseen, watching.'),

  S('8   INT. BLACK-MARKET CLINIC - NIGHT'),
  A('Tiled walls, low ceiling, one swinging bulb. DR. SARA LIN (30s) digs a slug out of Quick without anaesthetic. He grits his teeth and does not flinch.'),
  C('DR. LIN'), D("You keep coming back in pieces. One day you'll come back in a bag."),
  C('QUICK'), D("Then stitch faster."),

  S('12   INT. SAFEHOUSE - NIGHT'),
  A("A cramped apartment. MAYA CRUZ (30s), Interpol, has a gun on Quick. He's patching a wound and barely looks up."),
  C('MAYA'), D('Interpol. Hands where I can see them.'),
  C('QUICK'), D("They're busy. Draco moves the shipment at dawn. You want him, or you want me?"),
  A('A beat. She clocks the case files spread on his table — her own case, three years deep. She lowers the gun an inch. An alliance, born of bad options.'),
  C('MAYA'), D("If you run, I shoot you myself."),
  C('QUICK'), D("Wouldn't expect anything less."),

  S('13   EXT. CITY STREET - DAY'),
  A('Daylight. A picture SUV tears through a closed downtown corridor; a second SUV in pursuit. Quick drives; Maya leans out, returning fire. A drift car threads the gap between a bus and a market stall.'),
  C('MAYA'), D('You call this losing them?!'),
  C('QUICK'), D('I call it choosing WHERE we lose them.'),
  A('They clip a fruit cart in a galaxy of oranges. The pursuit SUV eats the debris and keeps coming.'),

  S('14   INT. MOVING SUV - DAY'),
  A('Glass everywhere. Maya reloads on instinct, ejecting a mag with her teeth. Quick clips a mirror, grins like a man who has done this far too often.'),
  C('MAYA'), D("You're enjoying this."),
  C('QUICK'), D("I'm focused. It looks the same."),

  S('15   EXT. UNDERPASS - DAY'),
  A('The chase funnels into a concrete underpass. Quick hauls the wheel; the pursuit SUV clips a pillar and BARREL-ROLLS in a storm of sparks and debris. Silence. Dust. Quick and Maya step out, weapons up, into the light.'),
  C('QUICK'), D("Dawn's in three hours. Let's go ruin Draco's morning."),

  S('18   INT. DRACO PENTHOUSE - NIGHT'),
  A('Glass walls, a skyline on fire with city lights. Draco pours two drinks and slides one across the marble to an empty chair, as if expecting a ghost.'),
  C('DRACO'), D("He'll come. Men like Quick always walk into the last room. It's the only door they know."),

  S('22   EXT. FREIGHTER SEVASTOPOL - DAWN'),
  A('The pre-dawn dark bleeds grey. Quick and Maya board the freighter on a grapple line. Containers stacked like a city block. Somewhere among them, the red-star crate — and Draco, waiting.'),
  C('MAYA'), D("Last chance to do this the legal way."),
  C('QUICK'), D("I left legal back at the harbor."),
  A('They split. Weapons up. The horizon catches fire.'),
  A('FADE OUT.'),
];

function wrap(text, cpl) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > cpl) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur ? cur + ' ' : '') + w;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function build(revLabel, revColor, fileName) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);

  // Title page
  let page = doc.addPage([W, H]);
  const title = 'JASON QUICK';
  page.drawText(title, { x: (W - bold.widthOfTextAtSize(title, 24)) / 2, y: 470, size: 24, font: bold });
  const sub = 'An Action Feature';
  page.drawText(sub, { x: (W - font.widthOfTextAtSize(sub, 12)) / 2, y: 440, size: 12, font });
  const wr = 'Written by C. Hammond';
  page.drawText(wr, { x: (W - font.widthOfTextAtSize(wr, 12)) / 2, y: 380, size: 12, font });
  page.drawText(`${revLabel}  -  ${new Date().toLocaleDateString('en-US')}`, { x: M_LEFT, y: 96, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Quickstrike Pictures  -  CONFIDENTIAL', { x: M_LEFT, y: 80, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  // Body
  page = doc.addPage([W, H]);
  let y = M_TOP;
  let pageNo = 2;
  const header = () => {
    page.drawText(`${revColor.toUpperCase()} REV  ${revLabel}`, { x: M_LEFT, y: 760, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
    page.drawText(`${pageNo}.`, { x: W - 90, y: 760, size: 10, font });
  };
  header();

  const newPage = () => { page = doc.addPage([W, H]); pageNo++; y = M_TOP; header(); };
  const emit = (lines, x, f) => {
    for (const ln of lines) {
      if (y < M_BOTTOM) newPage();
      page.drawText(ln, { x, y, size: SIZE, font: f });
      y -= LH;
    }
  };

  for (const el of SCRIPT) {
    if (el.type === 'scene') {
      y -= LH; // blank line before a scene heading
      if (y < M_BOTTOM) newPage();
      emit([el.text.toUpperCase()], M_LEFT + IND.action, bold);
      y -= LH * 0.5;
    } else if (el.type === 'action') {
      emit(wrap(el.text, CPL_ACTION), M_LEFT + IND.action, font);
      y -= LH * 0.5;
    } else if (el.type === 'char') {
      y -= LH * 0.3;
      emit([el.text.toUpperCase()], M_LEFT + IND.char, font);
    } else if (el.type === 'dialogue') {
      emit(wrap(el.text, CPL_DIALOGUE), M_LEFT + IND.dialogue, font);
      y -= LH * 0.4;
    }
  }

  const bytes = await doc.save();
  fs.writeFileSync(path.join(OUT_DIR, fileName), bytes);
  console.log(`Wrote ${fileName} (${doc.getPageCount()} pages).`);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  await build('White (Production Draft)', 'White', 'jasonquick-white.pdf');
  await build('Blue Revision', 'Blue', 'jasonquick-blue.pdf');
  await build('Pink Revision (Current)', 'Pink', 'jasonquick-pink.pdf');
  console.log(`\nDone. PDFs in ${OUT_DIR}. They serve at /uploads/jasonquick-*.pdf — matching the seed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });

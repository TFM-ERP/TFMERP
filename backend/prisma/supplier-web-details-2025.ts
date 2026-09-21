/**
 * supplier-web-details-2025.ts
 *
 * Supplier contact details researched online on 21 Sep 2026 (official sites first,
 * UAE directories second). Only matches rated high or medium with an exact name are
 * used; weak or ambiguous matches (Control, Ogaret, Royal Catering, Royal Phone,
 * Formula Tyres, Cars Hub, GT8, Koobrik, ...) are left out. Chains get their head
 * office. Empty fields only — nothing on an invoice-derived record is overwritten —
 * except the few corrections listed in FORCE. The source goes into the supplier notes.
 *
 * No ledger or expense changes. Idempotent (tag [SUPWEB2025]). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SUPWEB2025]';

type F = { tradeName?: string; address?: string; city?: string; country?: string; phone?: string; email?: string; website?: string; vatId?: string };
interface Row { name: string; set: F; force?: F; src: string }
const ROWS: Row[] = [
  { name: 'ADNOC Distribution', set: { address: 'Head office: Sheikh Khalifa Energy Complex Tower 1, P.O. Box 50055', city: 'Abu Dhabi', phone: '800 300', email: 'info@adnocdistribution.ae', website: 'adnocdistribution.ae' }, src: 'adnocdistribution.ae/en/contact-us' },
  { name: 'ENOC', set: { address: 'Head office: 65, 10 Street, Oud Metha, Bur Dubai', city: 'Dubai', phone: '+971 4 337 4400', website: 'enoc.com' }, src: '2gis.ae / arabplaces (directory)' },
  { name: 'Emarat', set: { address: 'Head office: Sheikh Zayed Road, P.O. Box 9400', city: 'Dubai', phone: '+971 4 343 4444', email: 'info@emarat.ae', website: 'emarat.ae' }, src: 'emarat.ae/contact-us' },
  { name: 'Choithrams', set: { address: 'Head office: Al Ittihad Road, Al Khabaisi, Deira, P.O. Box 5249', city: 'Dubai', phone: '+971 4 297 9991', email: 'info@choithrams.com', website: 'choithrams.com' }, src: 'choithramsgcc.com/en/contactus' },
  { name: 'Ace Hardware', set: { phone: '800 275 223', email: 'customerservice@aceuae.com', website: 'aceuae.com' }, src: 'aceuae.com (Al-Futtaim ACE)' },
  { name: 'Almegnaus Hypermarket', set: { address: 'Al Wathba South', city: 'Abu Dhabi', phone: '+971 50 966 8000' }, src: 'Waze listing "Al-Megnaus Hypermarket"' },
  { name: 'Apex', set: { tradeName: 'Apex Express Courier Services LLC', address: 'Head office: Al Qusais Industrial Area 4, P.O. Box 56946 (Abu Dhabi branch: Musaffah 14)', city: 'Dubai', phone: '+971 4 255 4040 / Abu Dhabi +971 2 236 7506', email: 'info@apexexpressuae.com', website: 'apexexpressuae.com' }, src: 'apexexpressuae.com; matches Apex Express waybill 1122744 on the Senci delivery' },
  { name: 'Sheng Da Trading Co. FZCO', set: { address: 'Dragon Mart 1, Al Awir Road, G Floor, Shops BAI-05/12/13', city: 'Dubai', phone: '+971 52 100 5602' }, src: 'yellowpages-uae.com/sheng-da-trading-fzco-184306' },
  { name: 'Shatry Trading LLC', set: { address: 'Mussafah M11, P.O. Box 2753', city: 'Abu Dhabi', phone: '+971 2 204 0333' }, src: 'yellowpages-uae.com/shatry-trading-llc-189100' },
  { name: 'Middle East Bicycle trading', set: { address: 'Madinat Zayed', city: 'Abu Dhabi', phone: '02 635 3910' }, src: 'yellowpages-uae.com/middle-east-bicycle-trading-164598' },
  { name: 'Popular Spare Parts', set: { tradeName: 'Popular Auto Parts', address: 'Musaffah M8 (main branch), P.O. Box 7487', city: 'Abu Dhabi', phone: '800 3969 / +971 2 554 7308', email: 'info@popularautoparts.ae', website: 'popularautoparts.ae' }, src: 'popularautoparts.ae/contact; card narrative "POPULAR AU Abu Dhabi"; exact legal entity not confirmed' },
  { name: 'Sport Car Automotive', set: { address: 'Head office: Bldg 6 Shop 2, As-subh 4th St, New Industrial Area, P.O. Box 88989 (branch: Musaffah 11, Abu Dhabi)', city: 'Al Ain', phone: '+971 3 755 4020', email: 'scar@automotivepart.net', website: 'sportcarautomotive.com' }, src: 'sportcarautomotive.com/about-us' },
  { name: 'TCA Auto Garage', set: { address: 'Street 10, opposite Casa Milano, Musaffah M3', city: 'Abu Dhabi', phone: '+971 50 278 1840' }, src: 'Waze / instagram.com/tca.abudhabi; card narrative "TCA AUTO G ABU DHABI"' },
  { name: 'Senci General Trading L.L.C.', set: { address: 'Shop 13, Flora Hotel Bldg, Salem Plaza, Baniyas Square, Deira', city: 'Dubai', phone: '+971 52 874 5515' }, src: 'yello.ae/company/349420; yellowpages-uae.com/senci-general-trading-llc-185164' },
  { name: 'MACQUIP COMMERCIAL EQUIPMENT AND PROFESSIONAL MACHINES RENTING - L.L.C', set: { phone: '+971 50 943 2686', email: 'operations@macquip.me' }, src: 'macquip.me' },
  { name: 'Q-Tech General Trading LLC', set: { phone: '+971 4 341 9077' }, src: 'dubai24x7.com / hidubai.com (Offices 603-605, Ibn Battuta Gate)' },
  { name: 'Samsung Gulf Electronics FZE Dubai Branch', set: { phone: '800 7267864', website: 'samsung.com/ae' }, src: 'samsung.com/ae/support/contact' },
  { name: 'Shory Insurance Brokers LLC', set: { phone: '800 74679 (800 SHORY)', website: 'shory.com' }, src: 'shory.com/support' },
  { name: 'twofour54 FZ-LLC', set: { phone: '+971 2 401 2454', website: 'twofour54.com' }, src: 'twofour54.com/en/contact-us' },
  { name: 'Heartland Emirates Recreational Vehicles L.L.C', set: {}, force: { tradeName: 'Heartland' }, src: 'trade name corrected (was a copy of the legal name); also on facebook.com/heartlanduae, mobile +971 56 133 7522' },
  { name: 'Emirates Auction LLC', set: { phone: '+971 600 54 5454', website: 'emiratesauction.com' }, src: 'emiratesauction.com/contact-us; yello.ae/company/279453' },
  { name: 'Abu Dhabi Printing & Publishing Co. LLC', set: { phone: '02 673 2828' }, src: 'yellowpages-uae.com (directory)' },
  { name: 'Orynx General Trading LLC (Gear-up.me)', set: { website: 'gear-up.me' }, src: 'gear-up.me/contact' },
  { name: 'La Quinta by Wyndham Abu Dhabi Al Wahda', set: { address: '601 Sheikh Rashid Bin Saeed St, Al Nahyan Zone 1, P.O. Box 4228' }, src: 'hotel company profile (laquintaabudhabialwahda.com); managed by Gromaxx Hotels Management L.L.C.; main line +971 2 412 6666' },
  { name: 'Adobe Systems Software Ireland Limited', set: { phone: '+353 1 905 5210', vatId: 'IE VAT IE6364992H' }, src: 'adobe.com/ie/about-adobe/contact/offices; IE VAT from a VIES mirror (vatport.com)' },
  { name: 'Google Cloud EMEA Limited', set: { address: "70 Sir John Rogerson's Quay", city: 'Dublin 2', website: 'cloud.google.com', vatId: 'IE VAT IE3668997OH' }, src: 'cloud.google.com/terms/google-entity; IE VAT from vat-lookup.co.uk (CRO 660412)' },
  { name: 'Google LLC', set: { website: 'google.com' }, src: 'google.com' },
  { name: 'Figma, Inc.', set: { website: 'figma.com' }, src: 'figma.com/legal/tos (UAE not on its VAT page)' },
  { name: 'Vercel Inc.', set: { address: '440 N Barranca Ave #4133', city: 'Covina, CA 91723', phone: '+1 559 288 7060' }, src: 'vercel.com/legal/dmca-policy' },
  { name: 'Railway Corporation', set: { address: '548 Market St Suite 68956', city: 'San Francisco, CA 94104', phone: '+1 415 707 7675' }, src: 'railway.com/legal/terms' },
  { name: 'fal - Features & Labels, Inc.', set: { address: '2261 Market St. Suite 10467', city: 'San Francisco, CA 94114', email: 'support@fal.ai', website: 'fal.ai' }, src: 'fal.ai/terms' },
  { name: 'Eleven Labs Inc.', set: { address: '169 Madison Ave #2484', city: 'New York, NY 10016', vatId: 'US EIN 88-2721123' }, src: 'help.elevenlabs.io billing address / VAT-EIN article' },
  { name: 'Supabase Pte. Ltd.', set: { address: '65 Chulia Street #38-02/03, OCBC Centre', city: 'Singapore 049513', website: 'supabase.com' }, force: { vatId: 'SG UEN 202005760H' }, src: 'supabase.com/terms; 202005760H is the company UEN, not a GST number' },
  { name: 'Frame.io, Inc.', set: {}, force: { country: 'USA' }, src: 'Frame.io ToS: Frame.io, Inc. is the US company (Adobe); country was the UAE default' },
  { name: 'Callaia.ai', set: { tradeName: 'Callaia (Cinelytic, Inc.)', address: '9255 W. Sunset Boulevard, Suite 1100', city: 'Los Angeles, CA 90069', website: 'callaia.ai' }, force: { country: 'USA' }, src: 'callaia.ai/terms — operated by Cinelytic, Inc.' },
  { name: 'Immortal Cinema International, LLC', set: { website: 'immortalcinema.com' }, src: 'immortalcinema.com/contact' },
  { name: 'Zoom Communications, Inc.', set: { phone: '+1 888 799 9666', website: 'zoom.com' }, src: 'zoom.com/en/contact' },
];

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.supplier.count({ where: { notes: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const plan: { id: string; name: string; data: Record<string, string> }[] = [];
  for (const r of ROWS) {
    const s = await prisma.supplier.findFirst({ where: { name: r.name } });
    if (!s) throw new Error(`Supplier "${r.name}" not found — nothing changed.`);
    const cur = s as unknown as Record<string, unknown>;
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.set)) if (v && (cur[k] === null || cur[k] === undefined || cur[k] === '')) data[k] = v;
    for (const [k, v] of Object.entries(r.force ?? {})) if (v && cur[k] !== v) data[k] = v;
    const fields = Object.keys(data);
    if (!fields.length) { console.log(`  ${r.name}: nothing new`); continue; }
    data.notes = `${s.notes ? `${s.notes}\n` : ''}${TAG} Web research 21 Sep 2026 (${fields.join(', ')}): ${r.src}`;
    plan.push({ id: s.id, name: r.name, data });
    console.log(`  ${r.name}: ${fields.map((k) => `${k}=${data[k]}`).join(' · ')}`);
  }
  console.log(`\n${plan.length} suppliers to update.`);
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(async (tx) => { for (const p of plan) await tx.supplier.update({ where: { id: p.id }, data: p.data }); });
  console.log(`  updated ${await prisma.supplier.count({ where: { notes: { contains: TAG } } })}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

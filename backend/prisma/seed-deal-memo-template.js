/**
 * Seeds a default DEAL_MEMO ContractTemplate (+ standard clauses) so the
 * Casting → Contracts selection handoff has a template to generate against,
 * and the Contracts Drafting Workspace has a starting point.
 *
 * Idempotent: keyed on the template name. Re-running updates the body/clauses.
 *
 * Run:  node prisma/seed-deal-memo-template.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NAME = 'Standard Talent Deal Memo';

const BODY = `# DEAL MEMORANDUM

**Production:** {{project_title}}
**Date:** {{today}}

This Deal Memorandum is made between **{{company_name}}** ("Producer") and **{{counterparty_name}}** ("Artist").

## 1. Engagement

The Producer engages the Artist to render services in the role of **{{role}}**{{character}} in connection with the production titled **{{project_title}}**.

## 2. Compensation

The Artist shall be paid a daily rate of **{{daily_rate}}** ({{currency}}), or a weekly rate of **{{weekly_rate}}** where applicable. Total estimated engagement value: **{{contract_value}}**.

## 3. Term

Services commence on **{{start_date}}** and conclude on **{{end_date}}**, subject to the production schedule.

## 4. Union / Affiliation

Union status: {{union_status}}. Representation/agency: {{agency}}.

## 5. Governing Law

This agreement is governed by **{{governing_law}}** and the parties submit to the jurisdiction of **{{jurisdiction}}**.`;

const CLAUSES = [
  {
    code: 'DM-CONFIDENTIALITY-01',
    title: 'Confidentiality',
    category: 'Confidentiality',
    isMandatory: true,
    riskLevel: 'MEDIUM',
    bodyMarkdown:
      'The Artist shall keep confidential all non-public information relating to the production, including scripts, schedules, and commercial terms, during and after the term of this engagement.',
  },
  {
    code: 'DM-IP-RIGHTS-01',
    title: 'Rights & Likeness',
    category: 'IP',
    isMandatory: true,
    riskLevel: 'HIGH',
    bodyMarkdown:
      "The Artist grants the Producer the right to record, reproduce, and exploit the Artist's performance, image, and likeness in connection with the production and its promotion, in all media now known or hereafter devised, in perpetuity.",
  },
  {
    code: 'DM-CONDUCT-01',
    title: 'Professional Conduct & HSE',
    category: 'Conduct',
    isMandatory: false,
    riskLevel: 'LOW',
    bodyMarkdown:
      'The Artist shall comply with the production\'s health, safety, and code-of-conduct policies and the lawful directions of the Producer on set.',
  },
  {
    code: 'DM-TERMINATION-01',
    title: 'Termination',
    category: 'Termination',
    isMandatory: false,
    riskLevel: 'MEDIUM',
    bodyMarkdown:
      'Either party may terminate this engagement on written notice in the event of material breach. The Producer may terminate without cause subject to payment for services rendered to the date of termination.',
  },
];

async function main() {
  const existing = await prisma.contractTemplate.findFirst({ where: { name: NAME } });

  const data = {
    name: NAME,
    type: 'DEAL_MEMO',
    description: 'Default talent deal memo used by the Casting selection handoff and the Contracts workspace.',
    language: 'en',
    bodyMarkdown: BODY,
    governingLaw: 'UAE Federal Law',
    jurisdiction: 'Abu Dhabi Courts',
    variables: [
      { key: 'project_title', label: 'Production title', required: true },
      { key: 'counterparty_name', label: 'Artist name', required: true },
      { key: 'role', label: 'Role', required: true },
      { key: 'daily_rate', label: 'Daily rate', required: false, source: 'ProductionCrew' },
      { key: 'weekly_rate', label: 'Weekly rate', required: false, source: 'ProductionCrew' },
      { key: 'contract_value', label: 'Total value', required: false },
      { key: 'start_date', label: 'Start date', required: false },
      { key: 'end_date', label: 'End date', required: false },
      { key: 'union_status', label: 'Union status', required: false, source: 'GlobalTalentProfile' },
      { key: 'agency', label: 'Agency', required: false, source: 'GlobalTalentProfile' },
    ],
  };

  let template;
  if (existing) {
    template = await prisma.contractTemplate.update({ where: { id: existing.id }, data });
    // Refresh clauses attached to this template.
    await prisma.clauseTemplate.deleteMany({ where: { templateId: existing.id } });
    console.log(`Updated template "${NAME}" (${template.id}).`);
  } else {
    template = await prisma.contractTemplate.create({ data });
    console.log(`Created template "${NAME}" (${template.id}).`);
  }

  for (let i = 0; i < CLAUSES.length; i++) {
    const c = CLAUSES[i];
    await prisma.clauseTemplate.upsert({
      where: { code: c.code },
      update: { ...c, templateId: template.id, orderIndex: i },
      create: { ...c, templateId: template.id, orderIndex: i, language: 'en' },
    });
  }
  console.log(`Seeded ${CLAUSES.length} clause(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

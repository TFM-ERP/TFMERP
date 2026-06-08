/**
 * SYS-10 V3.0 (V3-G) — the expanded casting pipeline.
 *
 * The full ordered workflow. The 8 legacy SubmissionStatus values are preserved in
 * place (SUBMITTED, UNDER_REVIEW, SHORTLISTED, CALLBACK, OFFERED, CONFIRMED, DECLINED,
 * WITHDRAWN) so no historical submission breaks; the new stages slot around them.
 */
export const SUBMISSION_PIPELINE: string[] = [
  'DRAFT',
  'OPEN',
  'PUBLIC',
  'INVITED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CASTING_ASSISTANT_REVIEW',
  'CASTING_DIRECTOR_REVIEW',
  'PRODUCER_REVIEW',
  'DIRECTOR_REVIEW',
  'STUDIO_REVIEW',
  'SHORTLISTED',
  'CALLBACK',
  'CHEMISTRY_READ',
  'NEGOTIATION',
  'OFFERED',
  'DEAL_MEMO_PENDING',
  'DEAL_MEMO_SIGNED',
  'TRAVEL_PENDING',
  'VISA_PENDING',
  'BOOKED',
  'ON_SET',
  'WRAPPED',
  'ARCHIVED',
];

// Terminal / off-pipeline states.
export const TERMINAL_STATUSES = ['DECLINED', 'WITHDRAWN'];

/**
 * "Engaged" = offer and beyond — the talent the production must now service
 * (deal memo, travel, visa, accommodation, transport, arrivals). `CONFIRMED` is the
 * legacy "booked" value, kept for back-compat.
 */
export const ENGAGED_STATUSES = [
  'OFFERED', 'CONFIRMED', 'DEAL_MEMO_PENDING', 'DEAL_MEMO_SIGNED',
  'TRAVEL_PENDING', 'VISA_PENDING', 'BOOKED', 'ON_SET', 'WRAPPED',
];

export const nextStage = (s: string): string | null => {
  const i = SUBMISSION_PIPELINE.indexOf(s);
  return i >= 0 && i < SUBMISSION_PIPELINE.length - 1 ? SUBMISSION_PIPELINE[i + 1] : null;
};

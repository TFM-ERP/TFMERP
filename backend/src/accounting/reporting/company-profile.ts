/**
 * The company's own registration details, as they appear on official documents.
 *
 * Every value here is transcribed from the FTA VAT registration certificate,
 * version 2021/VAT/0000061707/002 issued 04/03/2023. Nothing in this file is
 * inferred. It exists so the FAF header, the financial statements and the VAT
 * return cannot quietly disagree about the company's own name, and so that a
 * default like "Abu Dhabi" is a documented fact rather than a guess someone has
 * to take on trust.
 *
 * If any of it changes, the FTA must be told — the certificate says so — and this
 * file changes with it.
 */
export const COMPANY_PROFILE = {
  trn: '100600664500003',
  nameEn: 'The Film Makers FZ LLC',
  /** Required by the FAF header, which has a dedicated Arabic-name column. */
  nameAr: 'ذا فيلم ميكرز منطقة حرة ذ.م.م',

  licensingAuthority: 'twofour54',
  /**
   * Current licence. The VAT certificate below still shows B.L. 1019/21 because
   * it was issued in 2023 and has not been reissued since the renewal.
   */
  licenceNumber: 'B.L. 1019/26',

  /**
   * Current premises. The VAT certificate still shows the former address at
   * Rotana Building No. 6, Khalifa Park — see `certificate.outOfDate` below.
   */
  registeredAddress: 'Yas Creative Hub, Yas Island, Abu Dhabi',
  /**
   * The emirate of the registered address. A fixed establishment attributes its
   * standard-rated supplies here when an invoice records no place of supply, so
   * this is the default behind VAT 201 box 1.
   */
  emirate: 'Abu Dhabi' as const,
  contactNumber: '+971508116460',

  /** VAT registration took effect on this date. No return exists before it. */
  vatEffectiveFrom: '2021-07-01',
  vatFirstReturnPeriod: { from: '2021-07-01', to: '2021-09-30' },

  /**
   * The tax periods on the certificate: quarterly, aligned to the calendar.
   * 1 Jan–31 Mar, 1 Apr–30 Jun, 1 Jul–30 Sep, 1 Oct–31 Dec.
   */
  vatPeriod: 'QUARTERLY' as const,

  certificate: {
    version: '2021/VAT/0000061707/002',
    issued: '2023-03-04',
    /**
     * What the certificate still says that is no longer true. The certificate
     * itself requires the FTA to be told of any change to the basis on which the
     * TRN was issued, and a change of registered address is one of those.
     */
    outOfDate: {
      registeredAddress: 'Rotana Building No. 6, Sheikh Zayed Bin Sultan Al Nahyan, Khalifa Park, Abu Dhabi, 769558',
      licenceNumber: 'B.L. 1019/21',
    },
  },
} as const;

/** Whether a date falls inside the VAT-registered life of the company. */
export function isVatRegisteredOn(date: Date): boolean {
  return date >= new Date(COMPANY_PROFILE.vatEffectiveFrom);
}

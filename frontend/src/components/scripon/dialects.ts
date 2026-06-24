// Script-language dialect library (P1: Arabic). ids match the backend langDirective AR_VARIETY map.
// Used by the build intake to pick the language the SCRIPT is written in. Default = ar-MSA (formal فصحى).
export type ScriptVariety = { id: string; lang: string; label: string; native: string };

export const AR_DIALECTS: ScriptVariety[] = [
  { id: 'ar-MSA', lang: 'ar', label: 'Modern Standard (Formal)', native: 'الفصحى' },
  { id: 'ar-EG-cairene', lang: 'ar', label: 'Egyptian · Cairene', native: 'المصرية — عايز' },
  { id: 'ar-EG-saidi', lang: 'ar', label: 'Upper Egyptian · Saʿidi', native: 'الصعيدية' },
  { id: 'ar-LV-damascene', lang: 'ar', label: 'Levantine · Syrian / Damascene', native: 'الشامية — بدّي' },
  { id: 'ar-LV-lebanese', lang: 'ar', label: 'Lebanese', native: 'اللبنانية' },
  { id: 'ar-LV-palestinian', lang: 'ar', label: 'Palestinian', native: 'الفلسطينية' },
  { id: 'ar-LV-jordanian', lang: 'ar', label: 'Jordanian', native: 'الأردنية' },
  { id: 'ar-GLF-emirati', lang: 'ar', label: 'Gulf · Emirati', native: 'الخليجية — أبا/أبغى' },
  { id: 'ar-GLF-kuwaiti', lang: 'ar', label: 'Kuwaiti', native: 'الكويتية' },
  { id: 'ar-GLF-qatari', lang: 'ar', label: 'Qatari', native: 'القطرية' },
  { id: 'ar-GLF-bahraini', lang: 'ar', label: 'Bahraini', native: 'البحرينية' },
  { id: 'ar-SA-najdi', lang: 'ar', label: 'Najdi · central Saudi', native: 'النجدية' },
  { id: 'ar-SA-hejazi', lang: 'ar', label: 'Hejazi · western Saudi', native: 'الحجازية' },
  { id: 'ar-OM-omani', lang: 'ar', label: 'Omani', native: 'العُمانية' },
  { id: 'ar-IQ-gelet', lang: 'ar', label: 'Iraqi · Baghdadi (Gelet)', native: 'العراقية — أريد' },
  { id: 'ar-IQ-qeltu', lang: 'ar', label: 'Iraqi · Mosul (Qeltu)', native: 'الموصلية' },
  { id: 'ar-MA-darija', lang: 'ar', label: 'Moroccan · Darija', native: 'الدارجة المغربية — بغيت' },
  { id: 'ar-DZ-darja', lang: 'ar', label: 'Algerian · Darja', native: 'الدارجة الجزائرية' },
  { id: 'ar-TN-derja', lang: 'ar', label: 'Tunisian · Derja', native: 'الدارجة التونسية' },
  { id: 'ar-LY-libyan', lang: 'ar', label: 'Libyan', native: 'الليبية' },
  { id: 'ar-SD-sudanese', lang: 'ar', label: 'Sudanese', native: 'السودانية — داير' },
  { id: 'ar-YE-sanaani', lang: 'ar', label: 'Yemeni · Sanaani', native: 'اليمنية — أشتي' },
];

// Is the chosen target-language string an Arabic one? (the intake stores a display label like "Arabic" / "العربية")
export function isArabicLang(language?: string): boolean {
  const s = String(language || '').toLowerCase();
  return s.indexOf('arab') >= 0 || s.indexOf('عرب') >= 0 || s === 'ar';
}

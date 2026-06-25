/** Shared story-ending taxonomy — single source of truth for BOTH the New Build intake
 *  (Ending selector) and the Script Doctor · Rewrite Slate · Re-engineer ending. Add new
 *  researched types here and they appear in both places. No DB record.
 *  `ar`/`arDesc` localise the chips + (i) info for the Arabic interface. */
export type EndingType = { id: string; label: string; desc: string; ar: string; arDesc: string };
export const ENDING_TYPES: EndingType[] = [
  { id: 'resolved', label: 'Resolved / happy', desc: 'All loose ends tied; the protagonist reaches the goal and a new status quo settles.', ar: 'محلولة / سعيدة', arDesc: 'تُربط كل الخيوط؛ يبلغ البطل هدفه ويستقر وضع جديد.' },
  { id: 'triumphant', label: 'Triumphant', desc: 'An unambiguous, hard-won victory - the hero clearly and decisively wins.', ar: 'منتصِرة', arDesc: 'انتصار واضح بعد عناء — يفوز البطل بجلاء وحسم.' },
  { id: 'tragic', label: 'Tragic', desc: 'An inevitable downfall driven by a fatal flaw or bad choices.', ar: 'مأساوية', arDesc: 'سقوط محتوم يقوده عيب قاتل أو خيارات خاطئة.' },
  { id: 'bittersweet', label: 'Bittersweet', desc: 'The goal is reached but at real cost - victory mixed with loss.', ar: 'حلوة مرّة', arDesc: 'يُبلغ الهدف لكن بثمن حقيقي — نصر ممزوج بخسارة.' },
  { id: 'twist', label: 'Twist', desc: 'A late reveal that recontextualises everything that came before.', ar: 'مفاجأة', arDesc: 'كشف متأخّر يعيد تأطير كل ما سبق.' },
  { id: 'ambiguous', label: 'Ambiguous / open to interpretation', desc: 'Deliberately unresolved - the audience decides what it means.', ar: 'غامضة / مفتوحة للتأويل', arDesc: 'غير محسومة عمدًا — الجمهور يقرّر معناها.' },
  { id: 'hopeful', label: 'Hopeful', desc: 'Not everything is resolved, but the ending points toward a better future.', ar: 'مفعمة بالأمل', arDesc: 'لا يُحلّ كل شيء، لكن النهاية تشير إلى مستقبل أفضل.' },
  { id: 'circular', label: 'Circular / full-circle', desc: 'Ends where it began - a bookend reframed by the journey between.', ar: 'دائرية / تعود للبداية', arDesc: 'تنتهي حيث بدأت — إطار يعيد الرحلةُ بينهما تأطيرَه.' },
  { id: 'open-sequel', label: 'Open / sequel hook', desc: 'Deliberately unresolved, hinting the story continues into a sequel or wider saga.', ar: 'مفتوحة / تمهيد لجزء ثانٍ', arDesc: 'غير محسومة عمدًا، تلمّح إلى استمرار القصة في جزء أو ملحمة أوسع.' },
  { id: 'cliffhanger', label: 'Cliffhanger', desc: 'Cut off at peak tension, leaving the outcome hanging to pull into the next chapter.', ar: 'تشويقية معلّقة', arDesc: 'تُقطع عند ذروة التوتر، تاركة المصير معلّقًا لتجذب إلى الفصل التالي.' },
  { id: 'downer', label: 'Downer', desc: 'Bleak - the protagonist ends worse off, with little or no hope.', ar: 'قاتمة', arDesc: 'كئيبة — ينتهي البطل أسوأ حالًا بقليل من الأمل أو دونه.' },
  { id: 'poetic-justice', label: 'Poetic justice', desc: 'Characters get exactly what they deserve - reward or comeuppance to fit.', ar: 'عدالة شعرية', arDesc: 'ينال كل شخص ما يستحقه تمامًا — مكافأة أو عقاب يناسبه.' },
  { id: 'frame', label: 'Frame / bookend', desc: 'Returns to a framing device (narration, flash-forward) that reframes the whole story.', ar: 'إطار / استهلال وختام', arDesc: 'تعود إلى أداة تأطير (سرد، استباق) تعيد تأطير القصة كلها.' },
  { id: 'anticlimax', label: 'Deliberate anti-climax', desc: 'Subverts the expected big finish for a quieter, pointed effect.', ar: 'لاذروة متعمّدة', arDesc: 'تقوّض الخاتمة الكبرى المتوقّعة لأثرٍ أهدأ وأكثر قصدًا.' },
];

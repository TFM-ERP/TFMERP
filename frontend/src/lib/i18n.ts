'use client';

/**
 * SYS-UX Phase 3 — i18n + direction runtime (ADDITIVE, frontend-only).
 *
 * Drives <html lang> + <html dir> from a persisted locale (localStorage `tfm_locale`).
 * DEFAULT is English / LTR, so the live app is byte-for-byte unchanged until a user opts in.
 * Choosing العربية flips the document to RTL and loads an Arabic webface; the shell mirrors
 * automatically because it is built on logical CSS properties (inline-start/end, text-start).
 *
 * No React context/provider is required — `useLocale()` subscribes to a storage + custom event,
 * so any client component can opt in without wrapping the tree (keeps the change non-invasive).
 * Mirrors the theme engine in (dashboard)/layout.tsx: localStorage is the live driver.
 */
import { useEffect, useState } from 'react';
import { AR_SCRIPON } from './i18n.scripon';

export type Locale = 'en' | 'ar';
export type Dir = 'ltr' | 'rtl';

export const LOCALES: { id: Locale; label: string; native: string; dir: Dir }[] = [
  { id: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { id: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
];

export const localeDir = (l: Locale): Dir => (l === 'ar' ? 'rtl' : 'ltr');

/* ── Dictionaries ───────────────────────────────────────────────────────────
   Keys are the English source string. Missing keys fall back to the key itself,
   so an untranslated screen renders in English rather than blank. This file is
   the single place to review/extend Arabic copy. Seeded with the shell chrome
   (module labels, group captions, top bar). Extend per-module incrementally. */
type Dict = Record<string, string>;

const AR: Dict = {
  // Module labels (sidebar)
  'Home': 'الرئيسية',
  'Finance': 'المالية',
  'Rentals': 'التأجير',
  'Maintenance': 'الصيانة',
  'CRM': 'علاقات العملاء',
  'Partners': 'الشركاء',
  'Production': 'الإنتاج',
  'ScriptON': 'السيناريو',
  'Comms': 'الاتصالات',
  'Locations': 'المواقع',
  'Travel & Visas': 'السفر والتأشيرات',
  'Contracts': 'العقود',
  'Casting': 'اختيار الممثلين',
  'Accommodation': 'الإقامة',
  'Transport': 'النقل',
  'HR': 'الموارد البشرية',
  'Compliance': 'الامتثال',
  'Reports': 'التقارير',
  'Setup': 'الإعدادات',
  // Group captions
  'Workspace': 'مساحة العمل',
  'Creative & planning': 'الإبداع والتخطيط',
  'People': 'الأفراد',
  'Logistics & assets': 'الخدمات اللوجستية والأصول',
  'Insights': 'التحليلات',
  'Admin': 'الإدارة',
  // Top bar + chrome
  'Search or jump…': 'ابحث أو انتقل…',
  'record': 'سجل',
  'Sign out': 'تسجيل الخروج',
  'Personal identity & security': 'الهوية الشخصية والأمان',
  'Administrator': 'مدير النظام',
  // Appearance · Language & layout
  'Language': 'اللغة',
  'Language & layout': 'اللغة والتخطيط',
  // Command palette
  'Jump to page or action…': 'انتقل إلى صفحة أو إجراء…',
  'No matches': 'لا نتائج',
  // Scheduling home
  'Scheduling': 'الجدولة',
  'Stripboard': 'لوحة الشرائط',
  'Cast DOOD': 'أيام عمل الممثلين',
  'Calendar': 'التقويم',
  'Shoot days': 'أيام التصوير',
  'Scenes': 'المشاهد',
  'Cast (DOOD)': 'الممثلون',
  'days': 'يوم',
  'scenes': 'مشهد',
  'Day': 'يوم',
  'sample': 'عيّنة',
  // Finance home
  'Cost report': 'تقرير التكاليف',
  'Top sheet': 'الورقة الإجمالية',
  'Cash position': 'الوضع النقدي',
  'Budget': 'الميزانية',
  'Actual': 'الفعلي',
  'Committed': 'الملتزم',
  'Variance': 'الفرق',
  'Budget vs actual — by department': 'الميزانية مقابل الفعلي — حسب القسم',
  'Category': 'الفئة',
  'Total': 'الإجمالي',
  'Export': 'تصدير',
  'Petty cash on hand': 'النقد النثري المتوفر',
  'Open floats': 'العُهد المفتوحة',
  'Pending POs': 'أوامر شراء معلقة',
  'Float opening total': 'إجمالي افتتاح العُهد',
  // ── Common vocabulary (shared across pages — reusable translation memory) ──
  'Save': 'حفظ', 'Save changes': 'حفظ التغييرات', 'Save & close': 'حفظ وإغلاق',
  'Cancel': 'إلغاء', 'Delete': 'حذف', 'Edit': 'تعديل', 'Add': 'إضافة', 'New': 'جديد',
  'Create': 'إنشاء', 'Update': 'تحديث', 'Remove': 'إزالة', 'Search': 'بحث',
  'Filter': 'تصفية', 'Filters': 'عوامل التصفية', 'Refresh': 'تحديث', 'Close': 'إغلاق',
  'Submit': 'إرسال', 'Send': 'إرسال', 'Confirm': 'تأكيد', 'View': 'عرض', 'Details': 'التفاصيل',
  'Download': 'تنزيل', 'Upload': 'رفع', 'Print': 'طباعة', 'Import': 'استيراد', 'Back': 'رجوع',
  'Next': 'التالي', 'Prev': 'السابق', 'Previous': 'السابق', 'Done': 'تم',
  'Approve': 'اعتماد', 'Reject': 'رفض', 'Yes': 'نعم', 'No': 'لا',
  'Loading…': 'جارٍ التحميل…', 'Saving…': 'جارٍ الحفظ…',
  'Select': 'اختيار', 'Select…': 'اختر…', 'All': 'الكل', 'None': 'لا شيء',
  'Actions': 'الإجراءات', 'Settings': 'الإعدادات', 'Apply': 'تطبيق', 'Reset': 'إعادة تعيين',
  'Clear': 'مسح', 'More': 'المزيد', 'Show all': 'عرض الكل', 'Required': 'مطلوب', 'Optional': 'اختياري',
  // status
  'Status': 'الحالة', 'Active': 'نشط', 'Inactive': 'غير نشط', 'Pending': 'قيد الانتظار',
  'Approved': 'معتمد', 'Rejected': 'مرفوض', 'Draft': 'مسودة', 'Completed': 'مكتمل',
  'Cancelled': 'ملغى', 'Closed': 'مغلق', 'Open': 'مفتوح', 'Paid': 'مدفوع', 'Unpaid': 'غير مدفوع',
  'Overdue': 'متأخر', 'Scheduled': 'مجدول', 'In progress': 'قيد التنفيذ', 'Confirmed': 'مؤكد',
  'Expired': 'منتهٍ', 'Available': 'متاح',
  // fields
  'Name': 'الاسم', 'Name *': 'الاسم *', 'Full name': 'الاسم الكامل', 'Description': 'الوصف',
  'Notes': 'ملاحظات', 'Type': 'النوع', 'Date': 'التاريخ', 'Time': 'الوقت', 'Amount': 'المبلغ',
  'Subtotal': 'المجموع الفرعي', 'Quantity': 'الكمية', 'Price': 'السعر', 'Currency': 'العملة',
  'Email': 'البريد الإلكتروني', 'Phone': 'الهاتف', 'Mobile': 'الجوال', 'Address': 'العنوان',
  'City': 'المدينة', 'Country': 'الدولة', 'Company': 'الشركة', 'Client': 'العميل',
  'Supplier': 'المورّد', 'Vendor': 'المورّد', 'Project': 'المشروع', 'Department': 'القسم',
  'Role': 'الدور', 'Title': 'العنوان', 'Code': 'الرمز', 'Reference': 'المرجع',
  'From': 'من', 'To': 'إلى', 'Start': 'البداية', 'End': 'النهاية',
  'Start date': 'تاريخ البدء', 'End date': 'تاريخ الانتهاء', 'Location': 'الموقع', 'Asset': 'الأصل',
  'Driver': 'السائق', 'Vehicle': 'المركبة', 'IBAN': 'الآيبان', 'VAT': 'ضريبة القيمة المضافة',
  'Tax': 'الضريبة', 'Invoice': 'فاتورة', 'Payment': 'الدفعة', 'Balance': 'الرصيد',
  'Created': 'تاريخ الإنشاء', 'Updated': 'تاريخ التحديث', 'Dashboard': 'لوحة التحكم',
  'Overview': 'نظرة عامة', 'Summary': 'ملخص',
  // Home dashboard
  'Welcome': 'مرحباً', 'Good morning': 'صباح الخير', 'Good afternoon': 'نهارك سعيد', 'Good evening': 'مساء الخير',
  "Here's what needs your attention today.": 'إليك ما يحتاج انتباهك اليوم.',
  'Outstanding': 'المستحق', 'Overdue invoices': 'فواتير متأخرة', 'Collected (30d)': 'المحصّل (30 يوم)',
  'Active hires': 'عقود إيجار نشطة', 'Available fleet': 'الأسطول المتاح', 'Open maintenance': 'صيانة مفتوحة',
  'Docs expiring': 'مستندات تنتهي قريباً', 'New invoice': 'فاتورة جديدة', 'New quotation': 'عرض سعر جديد',
  'New booking': 'حجز جديد', 'No dashboards available for your role.': 'لا توجد لوحات متاحة لدورك.',
  'Needs attention': 'يحتاج انتباهاً', "You're all caught up.": 'أنت على اطلاع كامل.',
  // Finance · dashboard
  'Finance · Overview': 'المالية · نظرة عامة', 'Finance Dashboard': 'لوحة المالية',
  'Year to date': 'منذ بداية العام', 'All activities': 'كل الأنشطة',
  'YTD Invoiced': 'المفوتر منذ بداية العام', 'Collected YTD': 'المحصّل منذ بداية العام',
  'Active Quotations': 'عروض أسعار نشطة', 'This month': 'هذا الشهر',
  'collection rate': 'معدل التحصيل', 'invoices overdue': 'فواتير متأخرة',
  'Pending approval or conversion': 'بانتظار الاعتماد أو التحويل',
  'Monthly Revenue by Activity': 'الإيرادات الشهرية حسب النشاط', 'Rental': 'التأجير',
  'Recent Invoices': 'أحدث الفواتير', 'View all': 'عرض الكل',
  'New Quotation': 'عرض سعر جديد', 'New Invoice': 'فاتورة جديدة',
  'Record Payment': 'تسجيل دفعة', 'Aging Report': 'تقرير الأعمار',
  // Finance · expenses
  'Expenses': 'المصروفات', 'Finance · Spend': 'المالية · الإنفاق', 'records': 'سجلات',
  'Log Expense': 'تسجيل مصروف', 'Total Approved': 'إجمالي المعتمد', 'New Expense Claim': 'مطالبة مصروف جديدة',
  'Activity': 'النشاط', 'Description *': 'الوصف *', 'What was this expense for?': 'ما الغرض من هذا المصروف؟',
  '— Select supplier or type below —': '— اختر مورّداً أو اكتب أدناه —', 'Vendor Name': 'اسم المورّد',
  '(if not in directory)': '(إن لم يكن في الدليل)', 'Supplier VAT ID / TRN': 'الرقم الضريبي للمورّد',
  'Auto-filled from supplier directory': 'يُملأ تلقائياً من دليل المورّدين',
  'Amount (AED) *': 'المبلغ (درهم) *', 'VAT Amount (AED)': 'مبلغ الضريبة (درهم)',
  'Project / Job Ref': 'مرجع المشروع / المهمة', 'Production project ID (optional)': 'معرّف مشروع الإنتاج (اختياري)',
  'Budget Account Code': 'رمز حساب الميزانية', 'e.g. 2200 (optional)': 'مثال: 2200 (اختياري)',
  'Submit for Approval': 'إرسال للاعتماد', 'Submitting...': 'جارٍ الإرسال…',
  'All Statuses': 'كل الحالات', 'Pending Approval': 'بانتظار الاعتماد', 'All Categories': 'كل الفئات',
  'Ref': 'مرجع', 'Supplier / Vendor': 'المورّد', 'Submitted By': 'مقدَّم من',
  'Route': 'توجيه', 'Mark Paid': 'تعليم كمدفوع', 'No expenses found': 'لا توجد مصروفات',
  'Description and amount are required': 'الوصف والمبلغ مطلوبان', 'Failed to submit expense': 'تعذّر إرسال المصروف',
  // Finance · payments
  'Finance · Cash': 'المالية · النقد', 'Payments': 'المدفوعات', 'payments': 'دفعات',
  'Cleared': 'مُحصّلة', 'Bounced': 'مرتدّة', 'Method': 'طريقة الدفع',
  'Bank Transfer': 'تحويل بنكي', 'Cheque': 'شيك', 'Cash': 'نقد', 'Card': 'بطاقة', 'Online': 'إلكتروني',
  'No payments found': 'لا توجد مدفوعات', 'Showing': 'عرض', 'of': 'من',
  // Finance · approvals
  'Finance · Approvals': 'المالية · الاعتمادات', 'Invoice Approvals': 'اعتمادات الفواتير',
  'Multi-step approval routing for expenses & supplier invoices.': 'توجيه اعتماد متعدد الخطوات للمصروفات وفواتير المورّدين.',
  'Nothing awaiting approval.': 'لا شيء بانتظار الاعتماد.', 'No approval requests yet.': 'لا توجد طلبات اعتماد بعد.',
  'Comment (optional)': 'تعليق (اختياري)', 'raised': 'رُفع', 'Awaiting': 'بانتظار',
  // Finance · invoices
  'Finance · Receivables': 'المالية · الذمم المدينة', 'Invoices': 'الفواتير', 'invoices total': 'إجمالي الفواتير',
  'Search invoice number, client, PO...': 'ابحث برقم الفاتورة أو العميل أو أمر الشراء…',
  'Overdue only': 'المتأخرة فقط', 'Invoice #': 'رقم الفاتورة', 'PO Ref': 'مرجع أمر الشراء',
  'Issue Date': 'تاريخ الإصدار', 'Due Date': 'تاريخ الاستحقاق', 'Amount Due': 'المبلغ المستحق',
  'd overdue': ' يوم تأخير', 'No invoices found': 'لا توجد فواتير',
  // Finance · quotations
  'Finance · Sales': 'المالية · المبيعات', 'Quotations': 'عروض الأسعار', 'quotations total': 'إجمالي عروض الأسعار',
  'Search by number, client, or subject...': 'ابحث بالرقم أو العميل أو الموضوع…',
  'Quotation #': 'رقم العرض', 'Subject': 'الموضوع', 'Valid Until': 'صالح حتى', 'No quotations found': 'لا توجد عروض أسعار',
  // Finance · collections
  'Collections': 'التحصيلات',
  'Receivables aging, payment reminders and statements of account.': 'أعمار الذمم المدينة، تذكيرات الدفع، وكشوف الحساب.',
  'Run reminders': 'تشغيل التذكيرات', 'Current': 'الحالي', '1–30 days': '1–30 يوم', '31–60 days': '31–60 يوم',
  '61–90 days': '61–90 يوم', '90+ days': '90+ يوم', 'All open': 'كل المفتوحة',
  'invoice(s)': 'فاتورة', 'outstanding': 'مستحقة', 'Nothing outstanding in this view.': 'لا شيء مستحق في هذا العرض.',
  'Due': 'الاستحقاق', 'Amount due': 'المبلغ المستحق', 'Last reminder': 'آخر تذكير',
  'blocked': 'محظور', 'no email': 'لا بريد', 'Remind': 'تذكير', 'Statement': 'كشف حساب',
  'Collections settings': 'إعدادات التحصيل', 'Automatic reminders': 'تذكيرات تلقائية',
  'Scans every 6 hours and sends the appropriate reminder per the cadence below. Off until SMTP is set.': 'يفحص كل 6 ساعات ويرسل التذكير المناسب وفق الجدول أدناه. معطّل حتى يتم ضبط SMTP.',
  'SMTP (outgoing email)': 'SMTP (البريد الصادر)', 'Host': 'المضيف', 'Port': 'المنفذ',
  'Username': 'اسم المستخدم', 'Password': 'كلمة المرور', 'From address': 'عنوان المُرسِل',
  'Send test': 'إرسال اختبار', 'Reminder cadence': 'جدول التذكيرات', 'day': 'يوم',
  'Negative = days before due date; positive = days overdue.': 'سالب = أيام قبل الاستحقاق؛ موجب = أيام تأخير.',
  'Statement / email footer': 'تذييل كشف الحساب / البريد',
  // Finance · suppliers (list)
  'Finance · Directory': 'المالية · الدليل', 'Supplier Directory': 'دليل المورّدين', 'suppliers': 'مورّد',
  'Add Supplier': 'إضافة مورّد', 'expiry alerts within 60 days': 'تنبيهات انتهاء خلال 60 يوماً',
  'Trade licence:': 'الرخصة التجارية:', 'Search name, code, TRN...': 'ابحث بالاسم أو الرمز أو الرقم الضريبي…',
  'TRN / VAT': 'الرقم الضريبي', 'Trade Licence': 'الرخصة التجارية', 'Contact': 'جهة الاتصال',
  'Contacts': 'جهات الاتصال', 'Docs': 'المستندات', 'Soon': 'قريباً', 'Workshop': 'ورشة',
  'No suppliers found.': 'لا يوجد مورّدون.', '+ Add your first supplier': '＋ أضف أول مورّد',
  'Page': 'صفحة', 'total': 'إجمالي',
  // Finance · VAT return
  'Finance · Tax': 'المالية · الضرائب', 'VAT Return': 'الإقرار الضريبي',
  'UAE VAT 201 — quarterly filing summary': 'إقرار ضريبة القيمة المضافة 201 — ملخص ربع سنوي',
  'Export CSV': 'تصدير CSV', 'Print / PDF': 'طباعة / PDF', 'Select Tax Period': 'اختر الفترة الضريبية',
  'Quarter': 'الربع', 'Custom range': 'نطاق مخصّص', 'Year': 'السنة',
  'Q1 — Jan–Mar': 'الربع 1 — يناير–مارس', 'Q2 — Apr–Jun': 'الربع 2 — أبريل–يونيو',
  'Q3 — Jul–Sep': 'الربع 3 — يوليو–سبتمبر', 'Q4 — Oct–Dec': 'الربع 4 — أكتوبر–ديسمبر',
  'Start Date': 'تاريخ البدء', 'End Date': 'تاريخ الانتهاء', 'Calculating...': 'جارٍ الحساب…',
  'Generate VAT Return': 'إنشاء الإقرار الضريبي', 'Please set a valid date range': 'يرجى تحديد نطاق تاريخ صالح',
  'Failed to generate VAT return': 'تعذّر إنشاء الإقرار الضريبي', 'UAE VAT 201 Return': 'إقرار ضريبة القيمة المضافة 201',
  'invoices': 'فاتورة', 'expense records': 'سجل مصروفات', 'Based on': 'استناداً إلى', 'Period:': 'الفترة:',
  'Part 1 — Sales & All Other Outputs': 'الجزء 1 — المبيعات وجميع المخرجات الأخرى',
  'Part 2 — VAT on Sales & Purchases': 'الجزء 2 — ضريبة القيمة المضافة على المبيعات والمشتريات',
  'Standard Rated Sales (5%)': 'مبيعات بالنسبة القياسية (5%)', 'Zero Rated Sales (0%)': 'مبيعات بنسبة صفر (0%)',
  'Exempt Sales': 'مبيعات معفاة', 'Total Sales (Box 1 + 2 + 3)': 'إجمالي المبيعات (الخانة 1 + 2 + 3)',
  'Output VAT (VAT on sales)': 'ضريبة المخرجات (على المبيعات)',
  'Input VAT (Recoverable VAT on expenses)': 'ضريبة المدخلات (القابلة للاسترداد على المصروفات)',
  'Other Adjustments': 'تسويات أخرى', 'Net VAT Payable to FTA': 'صافي الضريبة المستحقة للهيئة',
  'VAT Refund Due from FTA': 'ضريبة مستردة من الهيئة', 'Box': 'الخانة', 'Sales by Client': 'المبيعات حسب العميل',
  'TRN': 'الرقم الضريبي', 'Sales (excl. VAT)': 'المبيعات (دون الضريبة)',
  'due to FTA': 'مستحقة للهيئة', 'refund claimable': 'مسترد قابل للمطالبة',
  'Output VAT': 'ضريبة المخرجات', 'Input VAT': 'ضريبة المدخلات',
  // Accounting
  'Accounting · Reports': 'المحاسبة · التقارير', 'Trial Balance': 'ميزان المراجعة',
  'Posted entries only.': 'القيود المرحَّلة فقط.', 'As of': 'حتى تاريخ',
  'Income': 'الإيرادات', 'Net profit': 'صافي الربح', 'Assets': 'الأصول',
  'No posted entries yet.': 'لا توجد قيود مرحَّلة بعد.', 'Account': 'الحساب',
  'Debit': 'مدين', 'Credit': 'دائن', 'TOTAL': 'الإجمالي',
  '⚠ Trial balance does not tie — check journal postings.': '⚠ ميزان المراجعة غير متوازن — راجع قيود اليومية.',
  // ── ScripON (screenwriting & development) ───────────────────────────────────
  'ScripON': 'سكربت أون', 'ScripON Library': 'مكتبة سكربت أون', 'standalone': 'مستقل',
  // rail / screens
  'Reader': 'القارئ', 'Library': 'المكتبة', 'Studio': 'الاستوديو', 'Doctor': 'الطبيب',
  'Script Doctor': 'طبيب السيناريو', 'Breakdown': 'التفكيك', 'Revisions': 'المراجعات',
  'Approvals': 'الاعتمادات', 'Greenlight': 'الضوء الأخضر', 'Coverage': 'التغطية',
  'Develop': 'تطوير', 'Development': 'التطوير', 'ScripON Studio': 'استوديو سكربت أون',
  'Schedule & Budget': 'الجدول والميزانية', 'Reports & Exports': 'التقارير والتصدير',
  'Notes & Collaboration': 'الملاحظات والتعاون', 'Approval workflow': 'سير الاعتماد',
  'Settings & Governance': 'الإعدادات والحوكمة', 'Development package': 'حزمة التطوير', 'Package': 'الحزمة',
  // ── OS rail labels (9-workspace ScripON rail — missing 4; Home/Doctor/Studio/Develop/Versions already above) ──
  'Write': 'كتابة', 'Canon': 'كانون', 'Room': 'الغرفة', 'Slate': 'اللائحة',
  // ── Project settings panel (Task 7) ──
  'Project settings': 'إعدادات المشروع',
  'Name, language and the defaults new builds & exports inherit.': 'الاسم واللغة والإعدادات الافتراضية التي تورثها الأبنية والتصديرات الجديدة.',
  'Workspace name': 'اسم مساحة العمل',
  'Shown across ScriptON': 'يظهر في كل أنحاء سكربت أون',
  'UI + new script default': 'افتراضي للواجهة والسيناريوهات الجديدة',
  'Collaboration': 'التعاون',
  'Solo — just you (no sign-offs, Room hidden)': 'فردي — أنت وحدك (لا اعتمادات، الغرفة مخفية)',
  'Team — approval workflow + Room on': 'فريق — سير اعتماد + الغرفة مفعّلة',
  'Auto (follows membership)': 'تلقائي (حسب الأعضاء)',
  'Team': 'فريق', 'Solo': 'فردي',
  'Default revision color': 'لون المراجعة الافتراضي',
  'Applied to new revisions': 'يُطبَّق على المراجعات الجديدة',
  'Saved.': 'تم الحفظ.',
  'Could not save settings.': 'تعذّر حفظ الإعدادات.',
  // ── Solo/team approval actions (Task 6) ──
  'Distributed — sides ready (solo mode, no sign-off needed).': 'تم التوزيع — الصفحات جاهزة (الوضع الفردي، لا حاجة لاعتماد).',
  'Connect a project with a script to distribute.': 'اربط مشروعًا به سيناريو للتوزيع.',
  'Approved.': 'تم الاعتماد.',
  'Could not approve.': 'تعذّر الاعتماد.',
  // script structure
  'Script': 'السيناريو', 'Scene': 'مشهد', 'Slugline': 'عنوان المشهد', 'Heading': 'العنوان',
  'Logline': 'السطر التعريفي', 'Treatment': 'المعالجة', 'Synopsis': 'الملخص',
  'Beats': 'الإيقاعات', 'Beat sheet': 'ورقة الإيقاعات', 'Outline': 'المخطط', 'Step outline': 'المخطط التفصيلي',
  'Step Outline': 'المخطط التفصيلي', 'Character': 'شخصية', 'Characters': 'الشخصيات',
  'Character bible': 'دليل الشخصيات', 'Character Bible': 'دليل الشخصيات', 'Dialogue': 'الحوار',
  'Action': 'الوصف', 'Voice': 'الصوت', 'Tone': 'النبرة', 'Theme': 'الثيمة', 'Structure': 'البنية',
  // actions
  'Generate': 'توليد', 'Generate script': 'توليد السيناريو', 'Generate script → Library': 'توليد السيناريو ← المكتبة',
  'Regenerate': 'إعادة التوليد', 'Retry generation': 'إعادة المحاولة', 'Regenerating…': 'جارٍ إعادة التوليد…',
  'Promote': 'ترقية', 'Promote to production': 'الترقية إلى الإنتاج', 'Diagnose': 'تشخيص', 'Diagnostics': 'التشخيص',
  'Rewrite': 'إعادة الكتابة', 'Read script': 'قراءة السيناريو', 'Read the script': 'قراءة السيناريو',
  'Read full script': 'قراءة السيناريو كاملاً', 'Download PDF': 'تنزيل PDF', 'Coverage report': 'تقرير التغطية',
  'Run breakdown': 'تشغيل التفكيك', 'Optimise': 'تحسين', 'Punch up': 'تحسين الحوار',
  // build / develop flow
  'Build': 'بناء', 'New build': 'بناء جديد', 'Builds': 'الأبنية', 'New Build': 'بناء جديد',
  'Stage': 'مرحلة', 'Stages': 'المراحل', 'Pipeline': 'المسار', 'Version': 'نسخة', 'Versions': 'النسخ',
  'Compare': 'مقارنة', 'Direction': 'الاتجاه', 'Directions': 'الاتجاهات', 'Choose your direction': 'اختر اتجاهك',
  'Research': 'البحث', 'Intake': 'بيانات العمل', 'Brief': 'الموجز', 'Creative brief': 'الموجز الإبداعي',
  'Genre': 'النوع', 'Genres': 'الأنواع', 'Format': 'الصيغة', 'Rating': 'التصنيف', 'Market': 'السوق',
  'Comps': 'الأعمال المشابهة', 'Comparables': 'الأعمال المشابهة', 'Lore Atlas': 'أطلس العوالم',
  'Approve this stage': 'اعتماد هذه المرحلة', 'Generate another take': 'توليد نسخة أخرى',
  'Previous version': 'النسخة السابقة', 'Next version': 'النسخة التالية', 'Add a note': 'إضافة ملاحظة',
  'writing…': 'يكتب…', 'pending': 'قيد الانتظار', 'generated.': 'تم التوليد.',
  // breakdown lenses
  'Elements': 'العناصر', 'Element': 'عنصر', 'Cast': 'الممثلون', 'Props': 'الإكسسوارات',
  'Wardrobe': 'الأزياء', 'Vehicles': 'المركبات', 'SFX': 'المؤثرات', 'VFX': 'المؤثرات البصرية',
  'Set dressing': 'تجهيز الموقع', 'Stunts': 'الحركات الخطرة',
  // misc chrome
  'Loading the script…': 'جارٍ تحميل السيناريو…', 'Choose your direction…': 'اختر اتجاهك…',
  'Import a script to develop': 'استيراد سيناريو للتطوير', 'New production project (full form)': 'مشروع إنتاج جديد (النموذج الكامل)',
  'Develops in': 'يطوَّر في', 'The ScripON Library': 'مكتبة سكربت أون',
};

// ScripON's swept screens contribute their Arabic via the auto-merged AR_SCRIPON; base AR wins on any overlap order-wise but they're consistent.
const DICTS: Record<Locale, Dict> = { en: {}, ar: { ...AR, ...AR_SCRIPON } };

/** Build a translator for a locale. `t(key, fallback?)` → translation | fallback | key. */
export function makeT(locale: Locale) {
  const d = DICTS[locale] ?? {};
  return (key: string, fallback?: string): string => d[key] ?? fallback ?? key;
}

/* ── Persistence + DOM side-effects ───────────────────────────────────────── */
const KEY = 'tfm_locale';
const EVT = 'tfm:locale';
const AR_FONT_ID = 'tfm-ar-font';
const AR_STYLE_ID = 'tfm-ar-style';

export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

function ensureArabicFont() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(AR_FONT_ID)) {
    const l = document.createElement('link');
    l.id = AR_FONT_ID;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }
  if (!document.getElementById(AR_STYLE_ID)) {
    const s = document.createElement('style');
    s.id = AR_STYLE_ID;
    // Only bites when the document is in Arabic; numbers/Latin keep their own fonts.
    s.textContent = "html[lang=\"ar\"]{font-family:'Noto Sans Arabic','Tahoma','Segoe UI',var(--font-sans,sans-serif);}";
    document.head.appendChild(s);
  }
}

/** Apply locale to <html> (lang + dir) and load the Arabic face when needed. Pure DOM effect. */
export function applyLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.setAttribute('lang', locale);
  el.setAttribute('dir', localeDir(locale));
  if (locale === 'ar') ensureArabicFont();
}

/** Persist + apply + broadcast so every useLocale() subscriber (and other tabs) updates. */
export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    /* ignore */
  }
  applyLocale(locale);
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: locale }));
  } catch {
    /* ignore */
  }
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */
export interface LocaleApi {
  locale: Locale;
  dir: Dir;
  isRTL: boolean;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

/** Read the current locale and re-render on change (same tab via custom event, cross-tab via storage). */
export function useLocale(): LocaleApi {
  const [locale, setLoc] = useState<Locale>('en'); // 'en' on first paint == SSR markup, avoids hydration drift
  useEffect(() => {
    setLoc(getLocale());
    const onCustom = (e: Event) => setLoc(((e as CustomEvent).detail as Locale) ?? getLocale());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setLoc(getLocale());
    };
    window.addEventListener(EVT, onCustom as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVT, onCustom as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return { locale, dir: localeDir(locale), isRTL: locale === 'ar', setLocale, t: makeT(locale) };
}

import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Uploaded files are served by the backend at /uploads/... — turn a stored path
// into an absolute URL so links/images resolve to the API server, not the frontend.
export const API_ROOT = API_BASE.replace('/api/v1', '');
export const assetUrl = (u?: string | null): string =>
  !u ? '' : (u.startsWith('http') || u.startsWith('data:')) ? u : `${API_ROOT}${u.startsWith('/') ? '' : '/'}${u}`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('tfm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('tfm_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ── File Upload ───────────────────────────────────────────────────────────────

export const uploadFile = async (file: File): Promise<{ url: string; originalName: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const token = typeof window !== 'undefined' ? localStorage.getItem('tfm_token') : null;
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed');
  }
  return res.json();
};

export const deleteUploadedFile = (filename: string) =>
  api.delete(`/upload/${filename}`);

// ── Finance API helpers ───────────────────────────────────────────────────

export const financeApi = {
  dashboard: () => api.get('/finance/reports/dashboard'),
  revenueByActivity: (year: number) => api.get(`/finance/reports/revenue-by-activity?year=${year}`),

  // Bank accounts
  bankAccounts: {
    list: () => api.get('/finance/bank-accounts'),
    defaults: () => api.get('/finance/bank-accounts/defaults'),
    create: (data: any) => api.post('/finance/bank-accounts', data),
    update: (id: string, data: any) => api.put(`/finance/bank-accounts/${id}`, data),
  },

  // Quotations
  quotations: {
    list: (params: any) => api.get('/finance/quotations', { params }),
    get: (id: string) => api.get(`/finance/quotations/${id}`),
    create: (data: any) => api.post('/finance/quotations', data),
    update: (id: string, data: any) => api.put(`/finance/quotations/${id}`, data),
    updateStatus: (id: string, status: string, notes?: string) => api.patch(`/finance/quotations/${id}/status`, { status, notes }),
    convertToInvoice: (id: string) => api.post(`/finance/quotations/${id}/convert-to-invoice`),
    delete: (id: string) => api.delete(`/finance/quotations/${id}`),
  },

  // Invoices
  invoices: {
    list: (params: any) => api.get('/finance/invoices', { params }),
    get: (id: string) => api.get(`/finance/invoices/${id}`),
    create: (data: any) => api.post('/finance/invoices', data),
    update: (id: string, data: any) => api.put(`/finance/invoices/${id}`, data),
    updateStatus: (id: string, status: string, notes?: string) => api.patch(`/finance/invoices/${id}/status`, { status, notes }),
    recordPayment: (id: string, data: any) => api.post(`/finance/invoices/${id}/payments`, data),
    agingReport: () => api.get('/finance/invoices/aging-report'),
  },

  // Payments
  payments: {
    list: (params: any) => api.get('/finance/payments', { params }),
    summary: (start?: string, end?: string) => api.get('/finance/payments/summary', { params: { startDate: start, endDate: end } }),
    updateStatus: (id: string, status: string) => api.patch(`/finance/payments/${id}/status`, { status }),
  },

  // VAT
  vat: {
    list: () => api.get('/finance/vat'),
    seed: () => api.post('/finance/vat/seed'),
  },

  // Expenses
  expenses: {
    list: (params?: any) => api.get('/finance/expenses', { params }),
    get: (id: string) => api.get(`/finance/expenses/${id}`),
    create: (data: any) => api.post('/finance/expenses', data),
    update: (id: string, data: any) => api.put(`/finance/expenses/${id}`, data),
    approve: (id: string) => api.patch(`/finance/expenses/${id}/approve`),
    reject: (id: string) => api.patch(`/finance/expenses/${id}/reject`),
    markPaid: (id: string) => api.patch(`/finance/expenses/${id}/paid`),
    summary: (startDate?: string, endDate?: string) =>
      api.get('/finance/expenses/summary', { params: { startDate, endDate } }),
    categories: () => api.get('/finance/expenses/categories'),
  },

  // Suppliers
  suppliers: {
    list:             (params?: any)                        => api.get('/finance/suppliers', { params }),
    search:           (q: string)                           => api.get('/finance/suppliers/search', { params: { q } }),
    get:              (id: string)                          => api.get(`/finance/suppliers/${id}`),
    financialSummary: (id: string)                          => api.get(`/finance/suppliers/${id}/financial-summary`),
    create:           (data: any)                           => api.post('/finance/suppliers', data),
    update:           (id: string, data: any)               => api.put(`/finance/suppliers/${id}`, data),
    updateStatus:     (id: string, status: string, reason?: string) =>
                        api.patch(`/finance/suppliers/${id}/status`, { status, blacklistReason: reason }),
    toggleActive:     (id: string)                          => api.patch(`/finance/suppliers/${id}/toggle-active`),
    expiryAlerts:     ()                                    => api.get('/finance/suppliers/expiry-alerts'),
    categories:       ()                                    => api.get('/finance/suppliers/categories'),
    // Contacts
    addContact:       (id: string, data: any)               => api.post(`/finance/suppliers/${id}/contacts`, data),
    updateContact:    (contactId: string, data: any)        => api.put(`/finance/suppliers/contacts/${contactId}`, data),
    removeContact:    (contactId: string)                   => api.delete(`/finance/suppliers/contacts/${contactId}`),
    // Documents
    addDocument:      (id: string, data: any)               => api.post(`/finance/suppliers/${id}/documents`, data),
    removeDocument:   (docId: string)                       => api.delete(`/finance/suppliers/documents/${docId}`),
  },

  // Reports
  reports: {
    dashboard: () => api.get('/finance/reports/dashboard'),
    revenueByActivity: (year: number) => api.get(`/finance/reports/revenue-by-activity?year=${year}`),
    outstandingByClient: () => api.get('/finance/reports/outstanding-by-client'),
    vatReturn: (startDate: string, endDate: string) =>
      api.get('/finance/reports/vat-return', { params: { startDate, endDate } }),
  },
};

// ── Rental API ───────────────────────────────────────────────────────────

export const rentalApi = {
  // Dashboard
  dashboard: () => api.get('/rental/bookings/dashboard'),

  // Assets
  assets: {
    list: (params?: any) => api.get('/rental/assets', { params }),
    get: (id: string) => api.get(`/rental/assets/${id}`),
    create: (data: any) => api.post('/rental/assets', data),
    update: (id: string, data: any) => api.put(`/rental/assets/${id}`, data),
    updateStatus: (id: string, status: string, notes?: string) => api.patch(`/rental/assets/${id}/status`, { status, notes }),
    checkAvailability: (id: string, startDate: string, endDate: string, excludeBookingId?: string) =>
      api.get(`/rental/assets/${id}/availability`, { params: { startDate, endDate, excludeBookingId } }),
    expiryAlerts: () => api.get('/rental/assets/expiry-alerts'),
    utilization: (startDate: string, endDate: string) =>
      api.get('/rental/assets/utilization', { params: { startDate, endDate } }),
  },

  // Bookings
  bookings: {
    list: (params?: any) => api.get('/rental/bookings', { params }),
    get: (id: string) => api.get(`/rental/bookings/${id}`),
    create: (data: any) => api.post('/rental/bookings', data),
    update: (id: string, data: any) => api.put(`/rental/bookings/${id}`, data),
    updateStatus: (id: string, status: string, notes?: string) => api.patch(`/rental/bookings/${id}/status`, { status, notes }),
    calendar: (year: number, month: number) =>
      api.get('/rental/bookings/calendar', { params: { year, month } }),
    timeline: (from: string, to: string) => api.get('/rental/bookings/timeline', { params: { from, to } }),
    utilization: (from: string, to: string) => api.get('/rental/bookings/utilization', { params: { from, to } }),
    checkConflicts: (assetIds: string[], startDate: string, endDate: string, excludeBookingId?: string) =>
      api.post('/rental/bookings/check-conflicts', { assetIds, startDate, endDate, excludeBookingId }),
    locations: (id: string) => api.get(`/rental/bookings/${id}/locations`),
    addLocation: (id: string, data: any) => api.post(`/rental/bookings/${id}/locations`, data),
    updateLocation: (locId: string, data: any) => api.put(`/rental/bookings/locations/${locId}`, data),
    removeLocation: (locId: string) => api.delete(`/rental/bookings/locations/${locId}`),
  },

  // Contracts
  contracts: {
    list: (params?: any) => api.get('/rental/contracts', { params }),
    get: (id: string) => api.get(`/rental/contracts/${id}`),
    create: (data: any) => api.post('/rental/contracts', data),
    update: (id: string, data: any) => api.put(`/rental/contracts/${id}`, data),
    sign: (id: string, signedByName: string, signedByTitle: string) =>
      api.patch(`/rental/contracts/${id}/sign`, { signedByName, signedByTitle }),
  },

  // Drivers
  drivers: {
    list: (params?: any) => api.get('/rental/drivers', { params }),
    get: (id: string) => api.get(`/rental/drivers/${id}`),
    create: (data: any) => api.post('/rental/drivers', data),
    update: (id: string, data: any) => api.put(`/rental/drivers/${id}`, data),
    expiryAlerts: () => api.get('/rental/drivers/expiry-alerts'),
    performance: (id: string) => api.get(`/rental/drivers/${id}/performance`),
    generateInvoice: (id: string, jobIds: string[]) => api.post(`/rental/drivers/${id}/invoice`, { jobIds }),
    createJob: (data: any) => api.post('/rental/drivers/jobs', data),
    updateJobStatus: (jobId: string, status: string, completedAt?: string) =>
      api.patch(`/rental/drivers/jobs/${jobId}/status`, { status, completedAt }),
    updateJob: (jobId: string, data: any) => api.put(`/rental/drivers/jobs/${jobId}`, data),
    jobsByBooking: (bookingId: string) => api.get(`/rental/drivers/jobs/booking/${bookingId}`),
    unbilledJobs: (id: string) => api.get(`/rental/drivers/${id}/unbilled-jobs`),
    payouts: (id: string) => api.get(`/rental/drivers/${id}/payouts`),
    createPayout: (id: string, jobIds: string[]) => api.post(`/rental/drivers/${id}/payouts`, { jobIds }),
    pushPayroll: (id: string, jobIds: string[], month: number, year: number) => api.post(`/rental/drivers/${id}/push-payroll`, { jobIds, month, year }),
    approvePayout: (payoutId: string) => api.patch(`/rental/drivers/payouts/${payoutId}/approve`),
    payPayout: (payoutId: string, data: any) => api.patch(`/rental/drivers/payouts/${payoutId}/pay`, data),
  },

  // Incidents
  incidents: {
    list: (params?: any) => api.get('/rental/incidents', { params }),
    get: (id: string) => api.get(`/rental/incidents/${id}`),
    summary: () => api.get('/rental/incidents/summary'),
    create: (data: any) => api.post('/rental/incidents', data),
    update: (id: string, data: any) => api.put(`/rental/incidents/${id}`, data),
    resolve: (id: string, data: any) => api.patch(`/rental/incidents/${id}/resolve`, data),
    updateStatus: (id: string, status: string) => api.patch(`/rental/incidents/${id}/status`, { status }),
  },

  // Maintenance
  maintenance: {
    list:     (params?: any)                    => api.get('/rental/maintenance', { params }),
    get:      (id: string)                      => api.get(`/rental/maintenance/${id}`),
    create:   (data: any)                       => api.post('/rental/maintenance', data),
    update:   (id: string, data: any)           => api.put(`/rental/maintenance/${id}`, data),
    start:    (id: string)                      => api.patch(`/rental/maintenance/${id}/start`, {}),
    complete: (id: string, data: any)           => api.patch(`/rental/maintenance/${id}/complete`, data),
    cancel:   (id: string, reason?: string)     => api.patch(`/rental/maintenance/${id}/cancel`, { reason }),
    schedule: (assetId?: string)                => api.get('/rental/maintenance/schedule', { params: assetId ? { assetId } : undefined }),
    overdue:  ()                                => api.get('/rental/maintenance/overdue'),
  },

  // Fuel
  fuel: {
    list: (params?: any) => api.get('/rental/fuel', { params }),
    summary: (assetId?: string, startDate?: string, endDate?: string) =>
      api.get('/rental/fuel/summary', { params: { assetId, startDate, endDate } }),
    create: (data: any) => api.post('/rental/fuel', data),
    delete: (id: string) => api.delete(`/rental/fuel/${id}`),
  },

  // Damage
  damage: {
    list: (params?: any) => api.get('/rental/damage', { params }),
    get: (id: string) => api.get(`/rental/damage/${id}`),
    create: (data: any) => api.post('/rental/damage', data),
    update: (id: string, data: any) => api.put(`/rental/damage/${id}`, data),
    resolve: (id: string, repairCost: number) =>
      api.patch(`/rental/damage/${id}/resolve`, { repairCost }),
  },
};

// ── Production API ────────────────────────────────────────────────────────

export const productionApi = {
  // Projects
  dashboard: (role?: string) => api.get('/production/projects/dashboard', { params: role ? { role } : {} }),
  projects: {
    list: (params?: any) => api.get('/production/projects', { params }),
    get: (id: string) => api.get(`/production/projects/${id}`),
    workflow: (id: string) => api.get(`/production/projects/${id}/workflow`),
    create: (data: any) => api.post('/production/projects', data),
    update: (id: string, data: any) => api.put(`/production/projects/${id}`, data),
    duplicate: (id: string, crewScope?: string) => api.post(`/production/projects/${id}/duplicate`, { crewScope }),
    remove: (id: string, force = false) => api.delete(`/production/projects/${id}`, { params: { force } }),
    bulkArchive: (projectIds: string[]) => api.patch('/production/projects/bulk-archive', { projectIds }),
    bank: (id: string) => api.get(`/production/projects/${id}/bank`),
    linkBank: (id: string, data: { bankAccountId?: string | null; ledgerBankAccountId?: string | null }) => api.put(`/production/projects/${id}/bank`, data),
    permissionTemplates: () => api.get('/production/projects/permission-templates'),
    team: (id: string) => api.get(`/production/projects/${id}/team`),
    myAuthority: (id: string) => api.get(`/production/projects/${id}/my-authority`),
    assignRole: (id: string, data: { userId: string; templateId: string; notes?: string; costTreatment?: string; coaCode?: string; coaTitle?: string; roleTitle?: string; dailyRate?: number }) => api.put(`/production/projects/${id}/team`, data),
    removeRole: (id: string, userId: string) => api.delete(`/production/projects/${id}/team/${userId}`),
    convertCurrency: (id: string, toCurrency: string, factor: number) => api.post(`/production/projects/${id}/convert-currency`, { toCurrency, factor }),
    injectDistribution: (id: string) => api.post(`/production/projects/${id}/inject-distribution`),
  },
  // Budget versions
  budget: {
    getVersion: (versionId: string) => api.get(`/production/budget/versions/${versionId}`),
    createVersion: (data: any) => api.post('/production/budget/versions', data),
    activateVersion: (versionId: string) => api.patch(`/production/budget/versions/${versionId}/activate`),
    lockVersion: (versionId: string) => api.patch(`/production/budget/versions/${versionId}/lock`),
    cloneVersion: (versionId: string, versionName?: string) => api.post(`/production/budget/versions/${versionId}/clone`, { versionName }),
    transitionStatus: (versionId: string, toStatus: string, notes?: string) => api.patch(`/production/budget/versions/${versionId}/status`, { toStatus, notes }),
    topsheetComparison: (projectId: string, baselineId?: string, workingId?: string) => api.get(`/production/budget/topsheet-comparison/${projectId}`, { params: { ...(baselineId ? { baselineId } : {}), ...(workingId ? { workingId } : {}) } }),
    lifecycle: (projectId: string) => api.get(`/production/budget/lifecycle/${projectId}`),
    topSheet: (versionId: string) => api.get(`/production/budget/versions/${versionId}/topsheet`),
    budgetVsActual: (versionId: string) => api.get(`/production/budget/versions/${versionId}/budget-vs-actual`),
    recalculate: (versionId: string) => api.post(`/production/budget/versions/${versionId}/recalculate`),
    // Globals
    upsertGlobal: (versionId: string, data: any) => api.post(`/production/budget/versions/${versionId}/globals`, data),
    deleteGlobal: (globalId: string) => api.delete(`/production/budget/globals/${globalId}`),
    // Fringes
    createFringe: (versionId: string, data: any) => api.post(`/production/budget/versions/${versionId}/fringes`, data),
    updateFringe: (fringeId: string, data: any) => api.put(`/production/budget/fringes/${fringeId}`, data),
    deleteFringe: (fringeId: string) => api.delete(`/production/budget/fringes/${fringeId}`),
    // Sections
    createSection: (versionId: string, data: any) => api.post(`/production/budget/versions/${versionId}/sections`, data),
    updateSection: (sectionId: string, data: any) => api.put(`/production/budget/sections/${sectionId}`, data),
    // Accounts
    createAccount: (sectionId: string, data: any) => api.post(`/production/budget/sections/${sectionId}/accounts`, data),
    updateAccount: (accountId: string, data: any) => api.put(`/production/budget/accounts/${accountId}`, data),
    // Line items
    createItem: (accountId: string, data: any) => api.post(`/production/budget/accounts/${accountId}/items`, data),
    updateItem: (itemId: string, data: any) => api.put(`/production/budget/items/${itemId}`, data),
    deleteItem: (itemId: string) => api.delete(`/production/budget/items/${itemId}`),
  },
  // Crew
  crew: {
    list: (projectId: string) => api.get(`/production/crew/project/${projectId}`),
    workforceStatus: (projectId: string) => api.get(`/production/crew/project/${projectId}/workforce-status`),
    assignment: (id: string) => api.get(`/production/crew/assignment/${id}`),
    create: (data: any) => api.post('/production/crew', data),
    update: (id: string, data: any) => api.put(`/production/crew/${id}`, data),
    setCostTreatment: (id: string, costTreatment: string) => api.put(`/production/crew/${id}/cost-treatment`, { costTreatment }),
    remove: (id: string) => api.delete(`/production/crew/${id}`),
  },
  // Schedule
  schedule: {
    list: (projectId: string) => api.get(`/production/crew/schedule/${projectId}`),
    create: (projectId: string, data: any) => api.post(`/production/crew/schedule/${projectId}`, data),
    update: (dayId: string, data: any) => api.put(`/production/crew/schedule/day/${dayId}`, data),
    remove: (dayId: string) => api.delete(`/production/crew/schedule/day/${dayId}`),
  },
  // Cost management — vendors, POs, cost report
  costing: {
    vendors: (projectId: string) => api.get('/production/costing/vendors', { params: { projectId } }),
    createVendor: (data: any) => api.post('/production/costing/vendors', data),
    updateVendor: (id: string, data: any) => api.put(`/production/costing/vendors/${id}`, data),
    removeVendor: (id: string) => api.delete(`/production/costing/vendors/${id}`),
    supplierCatalog: (projectId: string) => api.get('/production/costing/supplier-catalog', { params: { projectId } }),
    addFromSuppliers: (projectId: string, supplierIds: string[]) => api.post('/production/costing/vendors/add-from-suppliers', { projectId, supplierIds }),
    refreshVendor: (id: string) => api.post(`/production/costing/vendors/${id}/refresh-from-supplier`),
    pos: (projectId: string, params?: any) => api.get('/production/costing/pos', { params: { projectId, ...(params || {}) } }),
    createPo: (data: any) => api.post('/production/costing/pos', data),
    updatePo: (id: string, data: any) => api.put(`/production/costing/pos/${id}`, data),
    setPoStatus: (id: string, status: string) => api.patch(`/production/costing/pos/${id}/status`, { status }),
    submitPoApproval: (id: string) => api.post(`/production/costing/pos/${id}/submit-approval`),
    revisePo: (id: string) => api.post(`/production/costing/pos/${id}/revise`),
    invoicePo: (id: string, body: { amount?: number; invoiceNumber?: string; invoiceDate?: string } = {}) => api.post(`/production/costing/pos/${id}/invoice`, body),
    uploadInvoice: (id: string, file: File) => { const fd = new FormData(); fd.append('file', file); return api.post(`/production/costing/pos/${id}/upload-invoice`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
    removePo: (id: string) => api.delete(`/production/costing/pos/${id}`),
    report: (projectId: string) => api.get(`/production/costing/report/${projectId}`),
    financeSummary: (projectId: string) => api.get(`/production/costing/finance-summary/${projectId}`),
    overspend: (projectId: string) => api.get(`/production/costing/overspend/${projectId}`),
    transfers: (projectId: string) => api.get('/production/costing/transfers', { params: { projectId } }),
    createTransfer: (data: any) => api.post('/production/costing/transfers', data),
    setTransferStatus: (id: string, status: string) => api.patch(`/production/costing/transfers/${id}/status`, { status }),
    removeTransfer: (id: string) => api.delete(`/production/costing/transfers/${id}`),
    setEtc: (accountId: string, etcAmount: number | null) => api.patch(`/production/costing/accounts/${accountId}/etc`, { etcAmount }),
    snapshots: (projectId: string) => api.get(`/production/costing/snapshots/${projectId}`),
    saveSnapshot: (projectId: string, label?: string) => api.post(`/production/costing/snapshots/${projectId}`, { label }),
    // Petty cash
    floats: (projectId: string) => api.get('/production/costing/floats', { params: { projectId } }),
    createFloat: (data: any) => api.post('/production/costing/floats', data),
    closeFloat: (id: string) => api.patch(`/production/costing/floats/${id}/close`),
    pettyTxns: (floatId: string) => api.get(`/production/costing/floats/${floatId}/txns`),
    addPettyTxn: (floatId: string, data: any) => api.post(`/production/costing/floats/${floatId}/txns`, data),
    removePettyTxn: (id: string) => api.delete(`/production/costing/petty-txns/${id}`),
    // V1.2 expanded OCR — suggestion-only, returns { ocr, draft } for review before posting
    scanReceipt: (floatId: string, file: File, body: any = {}) => { const fd = new FormData(); fd.append('file', file); Object.entries(body).forEach(([k, v]) => fd.append(k, String(v ?? ''))); return api.post(`/production/costing/floats/${floatId}/upload-receipt`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
    scanTimesheet: (projectId: string, file: File) => { const fd = new FormData(); fd.append('file', file); return api.post(`/production/costing/timesheets/${projectId}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
    // Cash flow
    cashflow: (projectId: string) => api.get(`/production/costing/cashflow/${projectId}`),
  },
  // Movie Magic Budgeting / Scheduling sync
  movieMagic: {
    import: (projectId: string, mmbFile?: File | null, mmsFile?: File | null, mergeStrategy?: 'NEW_VERSION' | 'UPDATE_ACTIVE') => {
      const fd = new FormData();
      if (mmbFile) fd.append('mmbFile', mmbFile);
      if (mmsFile) fd.append('mmsFile', mmsFile);
      if (mergeStrategy) fd.append('mergeStrategy', mergeStrategy);
      return api.post(`/production/movie-magic/${projectId}/import`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    exportMmb: (projectId: string) => api.get(`/production/movie-magic/${projectId}/export/mmb`, { responseType: 'blob' }),
    exportMms: (projectId: string) => api.get(`/production/movie-magic/${projectId}/export/mms`, { responseType: 'blob' }),
    // AI-reviewed import: preview (no writes) → human review → confirm (clone + inject)
    aiPreview: (projectId: string, mmbFile: File) => {
      const fd = new FormData();
      fd.append('mmbFile', mmbFile);
      return api.post(`/production/movie-magic/${projectId}/import/ai-preview`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    aiConfirm: (projectId: string, payload: { versionName?: string; lines: any[] }) =>
      api.post(`/production/movie-magic/${projectId}/import/ai-confirm`, payload),
    aiMapLines: (projectId: string, lines: any[]) => api.post(`/production/movie-magic/${projectId}/ai-map-lines`, { lines }),
  },
  // Vendor self-onboarding (admin)
  vendorOnboarding: {
    invite: (projectId: string, hours?: number) => api.post('/production/vendor-onboarding/invite', { projectId, hours }),
    pending: (projectId: string, status?: string) => api.get('/production/vendor-onboarding/pending', { params: { projectId, status } }),
    approve: (id: string) => api.post(`/production/vendor-onboarding/${id}/approve`),
    reject: (id: string) => api.post(`/production/vendor-onboarding/${id}/reject`),
  },
  // Scheduling — stripboard + Day Out of Days
  scheduling: {
    board: (projectId: string) => api.get(`/production/scheduling/board/${projectId}`),
    dood: (projectId: string) => api.get(`/production/scheduling/dood/${projectId}`),
    createStrip: (data: any) => api.post('/production/scheduling/strips', data),
    updateStrip: (id: string, data: any) => api.put(`/production/scheduling/strips/${id}`, data),
    reorder: (items: any[]) => api.post('/production/scheduling/reorder', { items }),
    removeStrip: (id: string) => api.delete(`/production/scheduling/strips/${id}`),
    autoSchedule: (projectId: string, opts: { pagesPerDay?: number; onlyUnscheduled?: boolean } = {}) => api.post(`/production/scheduling/auto-schedule/${projectId}`, opts),
    // Dynamic multi-category DOOD (computed live — never stored)
    doodMatrix: (projectId: string, category: string, dropAfter?: number) => api.get(`/production/scheduling/dood-matrix/${projectId}`, { params: { category, dropAfter } }),
    doodCategories: (projectId: string) => api.get(`/production/scheduling/dood-categories/${projectId}`),
    doodToGlobals: (projectId: string, dropAfter?: number) => api.post(`/production/scheduling/dood-to-globals/${projectId}`, { dropAfter }),
    calendar: (projectId: string) => api.get(`/production/scheduling/calendar/${projectId}`),
    callsheetData: (projectId: string, date: string, dropAfter?: number) => api.get(`/production/scheduling/callsheet-data/${projectId}`, { params: { date, dropAfter } }),
  },
  // Email & share
  mail: {
    status: () => api.get('/production/mail/status'),
    getSettings: () => api.get('/production/mail/settings'),
    saveSettings: (data: any) => api.put('/production/mail/settings', data),
    test: (to: string) => api.post('/production/mail/test', { to }),
    getProjectSettings: (projectId: string) => api.get(`/production/mail/settings/project/${projectId}`),
    saveProjectSettings: (projectId: string, data: any) => api.put(`/production/mail/settings/project/${projectId}`, data),
    testProject: (projectId: string, to: string) => api.post(`/production/mail/test/project/${projectId}`, { to }),
    callsheet: (id: string, data: any) => api.post(`/production/mail/callsheet/${id}`, data),
    costReport: (projectId: string, data: any) => api.post(`/production/mail/cost-report/${projectId}`, data),
    dealMemo: (assignmentId: string, data: any) => api.post(`/production/mail/deal-memo/${assignmentId}`, data),
    sendBreakdown: (projectId: string, data: { subject?: string; html?: string; recipients?: string[]; message?: string }) => api.post(`/production/mail/send-breakdown/${projectId}`, data),
  },
  // Document vault
  documents: {
    list: (projectId: string, params?: any) => api.get('/production/documents', { params: { projectId, ...(params || {}) } }),
    create: (data: any) => api.post('/production/documents', data),
    update: (id: string, data: any) => api.put(`/production/documents/${id}`, data),
    remove: (id: string) => api.delete(`/production/documents/${id}`),
  },
  // Script breakdown — scene elements
  breakdown: {
    byStrip: (stripId: string) => api.get(`/production/breakdown/strip/${stripId}`),
    sheet: (stripId: string) => api.get(`/production/breakdown/sheet/${stripId}`),
    summary: (projectId: string) => api.get(`/production/breakdown/summary/${projectId}`),
    locationBreakdown: (projectId: string) => api.get(`/production/breakdown/location-breakdown/${projectId}`),
    categoryBreakdown: (projectId: string) => api.get(`/production/breakdown/category-breakdown/${projectId}`),
    dayRollup: (projectId: string) => api.get(`/production/breakdown/day-rollup/${projectId}`),
    shareBreakdown: (data: { projectId: string; kind?: string; refKey?: string; title: string; message?: string; toUserIds: string[] }) => api.post('/production/breakdown/share', data),
    myShares: (projectId: string) => api.get(`/production/breakdown/shares/${projectId}`),
    markShareRead: (id: string) => api.post(`/production/breakdown/shares/${id}/read`),
    create: (data: any) => api.post('/production/breakdown', data),
    update: (id: string, data: any) => api.put(`/production/breakdown/${id}`, data),
    remove: (id: string) => api.delete(`/production/breakdown/${id}`),
    pushToBudget: (projectId: string) => api.post(`/production/breakdown/push-to-budget/${projectId}`),
    importScript: (projectId: string, data: { fileUrl: string; originalName?: string; replace?: boolean }) => api.post(`/production/breakdown/import-script/${projectId}`, data),
    importScriptFull: (projectId: string, data: { fileUrl: string; originalName?: string; pagesPerDay?: number; rateCard?: Record<string, number>; skipBudget?: boolean }) => api.post(`/production/breakdown/import-script-full/${projectId}`, data),
    budgetPreview: (projectId: string) => api.get(`/production/breakdown/budget-preview/${projectId}`),
    budgetGenerate: (projectId: string, rateCard: Record<string, number>) => api.post(`/production/breakdown/budget-generate/${projectId}`, { rateCard }),
    mappingPreview: (projectId: string) => api.get(`/production/breakdown/mapping-preview/${projectId}`),
    applyMapping: (projectId: string, mappings: any[]) => api.post(`/production/breakdown/apply-mapping/${projectId}`, { mappings }),
  },
  // Per-project accounting ledger
  ledger: {
    list: (projectId: string, params?: any) => api.get('/production/ledger', { params: { projectId, ...(params || {}) } }),
    summary: (projectId: string) => api.get(`/production/ledger/summary/${projectId}`),
    portfolio: () => api.get('/production/ledger/portfolio'),
    create: (data: any) => api.post('/production/ledger', data),
    update: (id: string, data: any) => api.put(`/production/ledger/${id}`, data),
    setStatus: (id: string, status: string) => api.patch(`/production/ledger/${id}/status`, { status }),
    submitApproval: (id: string) => api.post(`/production/ledger/${id}/submit-approval`),
    paidRegister: (projectId: string, params?: any) => api.get(`/production/ledger/paid/${projectId}`, { params }),
    remove: (id: string) => api.delete(`/production/ledger/${id}`),
    // Accounts payable
    apAging: (projectId: string) => api.get(`/production/ledger/ap-aging/${projectId}`),
    pay: (projectId: string, ids: string[], paidDate?: string, twoFactorCode?: string) =>
      api.post(`/production/ledger/pay/${projectId}`, { ids, paidDate }, twoFactorCode ? { headers: { 'x-2fa-code': twoFactorCode } } : undefined),
    // Cost coding / drill-down + reports
    byAccount: (projectId: string) => api.get(`/production/ledger/by-account/${projectId}`),
    accountLedger: (projectId: string, code: string) => api.get(`/production/ledger/account/${projectId}/${encodeURIComponent(code)}`),
    gl: (projectId: string) => api.get(`/production/ledger/gl/${projectId}`),
    // Period close
    periods: (projectId: string) => api.get(`/production/ledger/periods/${projectId}`),
    setPeriod: (projectId: string, period: string, status: 'OPEN' | 'CLOSED') => api.post(`/production/ledger/periods/${projectId}`, { period, status }),
  },
  // Locations
  locationNeeds: {
    list: (projectId: string) => api.get(`/production/location-needs/${projectId}`),
    sync: (projectId: string) => api.post(`/production/location-needs/sync/${projectId}`),
    updateNeed: (id: string, data: any) => api.put(`/production/location-needs/need/${id}`, data),
    addOption: (needId: string, data: { locationId: string; optionStatus?: string; notes?: string }) => api.post(`/production/location-needs/need/${needId}/options`, data),
    updateOption: (id: string, data: any) => api.put(`/production/location-needs/options/${id}`, data),
    removeOption: (id: string) => api.delete(`/production/location-needs/options/${id}`),
    lock: (needId: string, optionId: string) => api.post(`/production/location-needs/need/${needId}/lock/${optionId}`),
    unlock: (needId: string) => api.post(`/production/location-needs/need/${needId}/unlock`),
  },
  scoutVisits: {
    list: (projectId?: string) => api.get(`/production/scout-visits${projectId ? `?projectId=${projectId}` : ''}`),
    get: (id: string) => api.get(`/production/scout-visits/${id}`),
    callSheet: (id: string) => api.get(`/production/scout-visits/${id}/call-sheet`),
    crewPool: (projectId: string) => api.get(`/production/scout-visits/crew-pool/${projectId}`),
    masterOptions: () => api.get(`/production/scout-visits/master-options`),
    create: (data: any) => api.post(`/production/scout-visits`, data),
    update: (id: string, data: any) => api.put(`/production/scout-visits/${id}`, data),
    remove: (id: string) => api.delete(`/production/scout-visits/${id}`),
    addStop: (id: string, data: any) => api.post(`/production/scout-visits/${id}/stops`, data),
    updateStop: (stopId: string, data: any) => api.put(`/production/scout-visits/stops/${stopId}`, data),
    removeStop: (stopId: string) => api.delete(`/production/scout-visits/stops/${stopId}`),
    reorderStops: (id: string, ids: string[]) => api.post(`/production/scout-visits/${id}/stops/reorder`, { ids }),
    addMember: (id: string, data: any) => api.post(`/production/scout-visits/${id}/members`, data),
    updateMember: (memberId: string, data: any) => api.put(`/production/scout-visits/members/${memberId}`, data),
    removeMember: (memberId: string) => api.delete(`/production/scout-visits/members/${memberId}`),
    transportStatus: (id: string) => api.get(`/production/scout-visits/${id}/transport`),
    requestTransport: (id: string, data: any = {}) => api.post(`/production/scout-visits/${id}/transport`, data),
    cancelTransport: (id: string) => api.delete(`/production/scout-visits/${id}/transport`),
  },
  clearancePacks: {
    list: (projectId?: string) => api.get(`/production/clearance-packs${projectId ? `?projectId=${projectId}` : ''}`),
    get: (id: string) => api.get(`/production/clearance-packs/${id}`),
    buildFromVisit: (visitId: string, data: any) => api.post(`/production/clearance-packs/from-visit/${visitId}`, data),
    update: (id: string, data: any) => api.put(`/production/clearance-packs/${id}`, data),
    refresh: (id: string) => api.post(`/production/clearance-packs/${id}/refresh`),
    remove: (id: string) => api.delete(`/production/clearance-packs/${id}`),
    setConsent: (crewId: string, consent: boolean) => api.post(`/production/clearance-packs/consent/${crewId}`, { consent }),
    share: (id: string, data: any) => api.post(`/production/clearance-packs/${id}/share`, data),
    revoke: (id: string) => api.post(`/production/clearance-packs/${id}/revoke`),
    logDownload: (id: string) => api.post(`/production/clearance-packs/${id}/log-download`),
    // public — venue link (no auth)
    resolvePublic: (token: string) => api.get(`/public/clearance/${token}`),
  },
  locationReports: {
    plates: (params: { locationId?: string; visitId?: string; projectId?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return api.get(`/production/location-reports/plates${q ? `?${q}` : ''}`);
    },
    createPlate: (data: any) => api.post(`/production/location-reports/plates`, data),
    uploadPlate: (formData: FormData) => api.post(`/production/location-reports/plates/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    updatePlate: (id: string, data: any) => api.put(`/production/location-reports/plates/${id}`, data),
    removePlate: (id: string) => api.delete(`/production/location-reports/plates/${id}`),
    reorderPlates: (ids: string[]) => api.post(`/production/location-reports/plates/reorder`, { ids }),
    report: (locationId: string) => api.get(`/production/location-reports/report/${locationId}`),
    lookbook: (params: { locationId?: string; projectId?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return api.get(`/production/location-reports/lookbook${q ? `?${q}` : ''}`);
    },
    storyboard: (params: { locationId?: string; projectId?: string; sceneRef?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return api.get(`/production/location-reports/storyboard${q ? `?${q}` : ''}`);
    },
    compareNeed: (needId: string) => api.get(`/production/location-reports/compare-need/${needId}`),
    signOff: (needId: string, data: any) => api.post(`/production/location-reports/sign-off/${needId}`, data),
  },
  sunPath: {
    compute: (lat: number, lng: number, date: string, tz?: number) => api.get(`/production/sun-path?lat=${lat}&lng=${lng}&date=${date}${tz ? `&tz=${tz}` : ''}`),
    forLocation: (id: string, date: string, tz?: number) => api.get(`/production/sun-path/location/${id}?date=${date}${tz ? `&tz=${tz}` : ''}`),
    gating: (locationId: string, date: string, tz?: number) => api.get(`/production/sun-path/gating/${locationId}?date=${date}${tz ? `&tz=${tz}` : ''}`),
  },
  scriptReadiness: {
    board: (projectId: string) => api.get(`/production/script-readiness/board/${projectId}`),
    requests: (projectId: string, status?: string) => api.get(`/production/script-readiness/requests/${projectId}${status ? `?status=${status}` : ''}`),
    createRequest: (projectId: string, data: any) => api.post(`/production/script-readiness/requests/${projectId}`, data),
    updateRequest: (id: string, data: any) => api.put(`/production/script-readiness/requests/${id}`, data),
    removeRequest: (id: string) => api.delete(`/production/script-readiness/requests/${id}`),
  },
  script: {
    list: (projectId: string) => api.get(`/production/script/project/${projectId}`),
    getDocument: (id: string) => api.get(`/production/script/document/${id}`),
    getRevision: (id: string) => api.get(`/production/script/revision/${id}`),
    createDocument: (projectId: string, data: any) => api.post(`/production/script/project/${projectId}`, data),
    addRevision: (documentId: string, formData: FormData) => api.post(`/production/script/document/${documentId}/revision`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    setActive: (documentId: string, revisionId: string) => api.put(`/production/script/document/${documentId}/active/${revisionId}`),
    removeRevision: (id: string) => api.delete(`/production/script/revision/${id}`),
    removeDocument: (id: string) => api.delete(`/production/script/document/${id}`),
    // P5 — library link/promote/pull from inside a project
    promoteToLibrary: (documentId: string, data: any = {}) => api.post(`/production/master-scripts/promote/${documentId}`, data),
    pullLatest: (documentId: string) => api.post(`/production/master-scripts/pull/${documentId}`),
    linkMaster: (masterScriptId: string, projectId: string) => api.post(`/production/master-scripts/${masterScriptId}/link/${projectId}`),
    libraryList: (params?: any) => api.get(`/production/master-scripts`, { params }),
    // P6 — Analyze (local heuristic) + audio notes
    analyze: (revisionId: string) => api.get(`/production/script-analyze/revision/${revisionId}`),
    audioList: (revisionId: string) => api.get(`/production/script-analyze/audio/${revisionId}`),
    addAudio: (revisionId: string, formData: FormData) => api.post(`/production/script-analyze/audio/${revisionId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    removeAudio: (id: string) => api.delete(`/production/script-analyze/audio/${id}`),
  },
  scriptAnnotations: {
    layers: (documentId: string) => api.get(`/production/script-annotations/layers/${documentId}`),
    createLayer: (documentId: string, data: any) => api.post(`/production/script-annotations/layers/${documentId}`, data),
    updateLayer: (id: string, data: any) => api.put(`/production/script-annotations/layers/${id}`, data),
    removeLayer: (id: string) => api.delete(`/production/script-annotations/layers/${id}`),
    shares: (layerId: string) => api.get(`/production/script-annotations/layers/${layerId}/shares`),
    addShare: (layerId: string, data: any) => api.post(`/production/script-annotations/layers/${layerId}/shares`, data),
    removeShare: (shareId: string) => api.delete(`/production/script-annotations/shares/${shareId}`),
    list: (revisionId: string) => api.get(`/production/script-annotations/revision/${revisionId}`),
    create: (data: any) => api.post(`/production/script-annotations`, data),
    update: (id: string, data: any) => api.put(`/production/script-annotations/${id}`, data),
    remove: (id: string) => api.delete(`/production/script-annotations/${id}`),
    // D3 — transfer / orphans / compare
    transfer: (sourceRevisionId: string, targetRevisionId: string) => api.post(`/production/script-annotations/transfer/${sourceRevisionId}/${targetRevisionId}`),
    orphans: (revisionId: string) => api.get(`/production/script-annotations/orphans/${revisionId}`),
    placeOrphan: (id: string, data: any) => api.put(`/production/script-annotations/orphans/${id}/place`, data),
    compare: (revA: string, revB: string) => api.get(`/production/script-annotations/compare/${revA}/${revB}`),
    // P2 — bookmarks (carry forward on transfer)
    bookmarks: (revisionId: string) => api.get(`/production/script-annotations/bookmarks/${revisionId}`),
    addBookmark: (revisionId: string, data: any) => api.post(`/production/script-annotations/bookmarks/${revisionId}`, data),
    editBookmark: (id: string, data: any) => api.put(`/production/script-annotations/bookmark/${id}`, data),
    removeBookmark: (id: string) => api.delete(`/production/script-annotations/bookmark/${id}`),
    // P3 — tag categories / auto-tag / reports / scene special tags
    tagCategories: (projectId: string) => api.get(`/production/script-annotations/tag-categories/${projectId}`),
    addTagCategory: (projectId: string, data: any) => api.post(`/production/script-annotations/tag-categories/${projectId}`, data),
    editTagCategory: (id: string, data: any) => api.put(`/production/script-annotations/tag-category/${id}`, data),
    removeTagCategory: (id: string) => api.delete(`/production/script-annotations/tag-category/${id}`),
    reorderTagCategories: (projectId: string, ids: string[]) => api.post(`/production/script-annotations/tag-categories/${projectId}/reorder`, { ids }),
    autoTagCast: (revisionId: string) => api.post(`/production/script-annotations/autotag-cast/${revisionId}`),
    tagReport: (revisionId: string) => api.get(`/production/script-annotations/tag-report/${revisionId}`),
    updateScene: (id: string, data: any) => api.put(`/production/script-annotations/scene/${id}`, data),
    exportPdf: (revisionId: string, layerIds: string[]) => api.post(`/production/script-annotations/export/${revisionId}`, { layerIds }),
    procAccounts: (projectId: string) => api.get(`/production/script-annotations/procurement/accounts/${projectId}`),
    procStaging: (revisionId: string) => api.get(`/production/script-annotations/procurement/staging/${revisionId}`),
    procStage: (annotationId: string, data: any) => api.post(`/production/script-annotations/procurement/${annotationId}/stage`, data),
    procConfirm: (annotationId: string) => api.post(`/production/script-annotations/procurement/${annotationId}/confirm`),
    procUnstage: (annotationId: string) => api.delete(`/production/script-annotations/procurement/${annotationId}/stage`),
  },
  sides: {
    list: (projectId: string) => api.get(`/production/sides/project/${projectId}`),
    generate: (revisionId: string, data: any) => api.post(`/production/sides/generate/${revisionId}`, data),
    facing: (revisionId: string, data: any) => api.post(`/production/sides/facing/${revisionId}`, data),
    email: (id: string) => api.post(`/production/sides/${id}/email`),
    remove: (id: string) => api.delete(`/production/sides/${id}`),
  },
  lining: {
    list: (revisionId: string) => api.get(`/production/lining/revision/${revisionId}`),
    addCoverage: (sceneId: string, data: any) => api.post(`/production/lining/scene/${sceneId}`, data),
    updateCoverage: (id: string, data: any) => api.put(`/production/lining/coverage/${id}`, data),
    removeCoverage: (id: string) => api.delete(`/production/lining/coverage/${id}`),
    autoCoverage: (revisionId: string, data: any) => api.post(`/production/lining/autocoverage/${revisionId}`, data),
    addTake: (coverageId: string, data: any) => api.post(`/production/lining/coverage/${coverageId}/takes`, data),
    updateTake: (id: string, data: any) => api.put(`/production/lining/takes/${id}`, data),
    wrapTake: (id: string) => api.post(`/production/lining/takes/${id}/wrap`),
    removeTake: (id: string) => api.delete(`/production/lining/takes/${id}`),
    hotCost: (projectId: string, data: any) => api.post(`/production/lining/hot-cost/${projectId}`, data),
    pushHotCost: (projectId: string, data: any) => api.post(`/production/lining/hot-cost/${projectId}/push`, data),
    accruals: (projectId: string) => api.get(`/production/lining/accruals/${projectId}`),
    removeAccrual: (id: string) => api.delete(`/production/lining/accruals/${id}`),
  },
  locations: {
    list: (projectId: string) => api.get(`/production/locations/${projectId}`),
    get: (id: string) => api.get(`/production/locations/item/${id}`),
    create: (projectId: string, data: any) => api.post(`/production/locations/${projectId}`, data),
    update: (id: string, data: any) => api.put(`/production/locations/item/${id}`, data),
    remove: (id: string) => api.delete(`/production/locations/item/${id}`),
    postFee: (id: string, days: number) => api.post(`/production/locations/item/${id}/post-fee`, { days }),
    postCost: (id: string, data: any) => api.post(`/production/locations/item/${id}/post-cost`, data),
    // Permits (SYS-07 slice 4)
    permits: (id: string) => api.get(`/production/locations/item/${id}/permits`),
    createPermit: (id: string, data: any) => api.post(`/production/locations/item/${id}/permits`, data),
    updatePermit: (permitId: string, data: any) => api.put(`/production/locations/permits/${permitId}`, data),
    removePermit: (permitId: string) => api.delete(`/production/locations/permits/${permitId}`),
    submitPermit: (permitId: string) => api.post(`/production/locations/permits/${permitId}/submit`),
    permitWorkflow: (permitId: string) => api.get(`/production/locations/permits/${permitId}/workflow`),
    // Document vault + compliance + pipeline (SYS-07 slice 6)
    documents: (id: string) => api.get(`/production/locations/item/${id}/documents`),
    createDoc: (id: string, data: any) => api.post(`/production/locations/item/${id}/documents`, data),
    updateDoc: (docId: string, data: any) => api.put(`/production/locations/documents/${docId}`, data),
    removeDoc: (docId: string) => api.delete(`/production/locations/documents/${docId}`),
    uploadDoc: (id: string, form: FormData) => api.post(`/production/locations/item/${id}/documents/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    compliance: (id: string) => api.get(`/production/locations/item/${id}/compliance`),
    setStage: (id: string, stage: string) => api.post(`/production/locations/item/${id}/stage`, { stage }),
    generateNoc: (id: string, data?: any) => api.post(`/production/locations/item/${id}/noc`, data || {}),
    importEmail: (id: string, form: FormData) => api.post(`/production/locations/item/${id}/import-email`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    importEmailMaster: (id: string, form: FormData) => api.post(`/production/locations/master/${id}/import-email`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    ocrPermit: (form: FormData) => api.post('/production/locations/permits/ocr', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    // Risk register
    risks: (id: string) => api.get(`/production/locations/item/${id}/risks`),
    createRisk: (id: string, data: any) => api.post(`/production/locations/item/${id}/risks`, data),
    updateRisk: (riskId: string, data: any) => api.put(`/production/locations/risks/${riskId}`, data),
    removeRisk: (riskId: string) => api.delete(`/production/locations/risks/${riskId}`),
    // Slice 7 — permit authorities, security, payments (project scope, ledger-aware)
    authorities: () => api.get('/production/locations/authorities'),
    security: (id: string) => api.get(`/production/locations/item/${id}/security`),
    addSecurity: (id: string, data: any) => api.post(`/production/locations/item/${id}/security`, data),
    updSecurity: (sid: string, data: any) => api.put(`/production/locations/security/${sid}`, data),
    delSecurity: (sid: string) => api.delete(`/production/locations/security/${sid}`),
    postSecurity: (sid: string) => api.post(`/production/locations/security/${sid}/post-cost`),
    payments: (id: string) => api.get(`/production/locations/item/${id}/payments`),
    paySummary: (id: string) => api.get(`/production/locations/item/${id}/payments/summary`),
    addPayment: (id: string, data: any) => api.post(`/production/locations/item/${id}/payments`, data),
    updPayment: (pid: string, data: any) => api.put(`/production/locations/payments/${pid}`, data),
    delPayment: (pid: string) => api.delete(`/production/locations/payments/${pid}`),
    payPayment: (pid: string) => api.post(`/production/locations/payments/${pid}/pay`),
  },
  // Payroll timecards
  payroll: {
    list: (projectId: string) => api.get(`/production/payroll/${projectId}`),
    preview: (projectId: string, data: any) => api.post(`/production/payroll/${projectId}/preview`, data),
    create: (projectId: string, data: any) => api.post(`/production/payroll/${projectId}`, data),
    update: (id: string, data: any) => api.put(`/production/payroll/card/${id}`, data),
    remove: (id: string) => api.delete(`/production/payroll/card/${id}`),
    post: (id: string) => api.post(`/production/payroll/card/${id}/post`),
    reverse: (id: string) => api.post(`/production/payroll/card/${id}/reverse`),
  },
  // End credits
  credits: {
    get: (projectId: string) => api.get(`/production/credits/${projectId}`),
    save: (projectId: string, data: any) => api.put(`/production/credits/${projectId}`, data),
    regenerate: (projectId: string) => api.post(`/production/credits/${projectId}/regenerate`),
  },
  // Overages
  overages: {
    list: (projectId: string) => api.get('/production/overages', { params: { projectId } }),
    create: (data: any) => api.post('/production/overages', data),
    update: (id: string, data: any) => api.put(`/production/overages/${id}`, data),
    setStatus: (id: string, status: string) => api.patch(`/production/overages/${id}/status`, { status }),
    remove: (id: string) => api.delete(`/production/overages/${id}`),
  },
  // Per diem
  perdiem: {
    list: (projectId: string) => api.get('/production/perdiem', { params: { projectId } }),
    create: (data: any) => api.post('/production/perdiem', data),
    generate: (data: any) => api.post('/production/perdiem/generate', data),
    update: (id: string, data: any) => api.put(`/production/perdiem/${id}`, data),
    setStatus: (id: string, status: string) => api.patch(`/production/perdiem/${id}/status`, { status }),
    remove: (id: string) => api.delete(`/production/perdiem/${id}`),
  },
  // Call sheets
  callsheets: {
    list: (projectId: string) => api.get('/production/callsheets', { params: { projectId } }),
    get: (id: string) => api.get(`/production/callsheets/${id}`),
    create: (data: any) => api.post('/production/callsheets', data),
    update: (id: string, data: any) => api.put(`/production/callsheets/${id}`, data),
    publish: (id: string) => api.patch(`/production/callsheets/${id}/publish`),
    pullSchedule: (id: string) => api.post(`/production/callsheets/${id}/pull-schedule`),
    autofillDaylight: (id: string, tz?: number) => api.post(`/production/callsheets/${id}/autofill-daylight`, tz ? { tz } : {}),
    remove: (id: string) => api.delete(`/production/callsheets/${id}`),
  },
};

// ── Approval Routing API ───────────────────────────────────────────────────

export const approvalsApi = {
  pending: () => api.get('/finance/approvals/pending'),
  listAll: (params?: any) => api.get('/finance/approvals', { params }),
  forEntity: (type: string, id: string) => api.get(`/finance/approvals/entity/${type}/${id}`),
  routeExpense: (id: string) => api.post(`/finance/approvals/expense/${id}/route`),
  routePo: (id: string) => api.post(`/finance/approvals/po/${id}/route`),
  approve: (id: string, comment?: string) => api.post(`/finance/approvals/${id}/approve`, { comment }),
  reject: (id: string, comment?: string) => api.post(`/finance/approvals/${id}/reject`, { comment }),
};

// ── FX rates API ────────────────────────────────────────────────────────────

export const fxApi = {
  rates: () => api.get('/fx/rates'),
  save: (rates: { currency: string; toBase: number }[]) => api.put('/fx/rates', { rates }),
  remove: (currency: string) => api.delete(`/fx/rates/${currency}`),
  refresh: () => api.post('/fx/refresh'), // live fetch, AED-favourable quote per currency
};

// ── Audit log API ───────────────────────────────────────────────────────────

export const auditApi = {
  list: (params?: any) => api.get('/audit', { params }),
};

// ── Universal workflow & approval engine ──────────────────────────────────────
export const workflowApi = {
  definitions: (entityType?: string) => api.get('/workflow/definitions', { params: { entityType } }),
  upsertDefinition: (data: any) => api.put('/workflow/definitions', data),
  start: (data: { entityType: string; entityId: string; projectId?: string; label?: string; definitionKey?: string }) => api.post('/workflow/start', data),
  instance: (id: string) => api.get(`/workflow/instance/${id}`),
  forEntity: (entityType: string, entityId: string) => api.get(`/workflow/entity/${entityType}/${entityId}`),
  approve: (id: string, comment?: string) => api.post(`/workflow/instance/${id}/approve`, { comment }),
  reject: (id: string, comment?: string) => api.post(`/workflow/instance/${id}/reject`, { comment }),
  cancel: (id: string, comment?: string) => api.post(`/workflow/instance/${id}/cancel`, { comment }),
  myPending: () => api.get('/workflow/my-pending'),
};

// ── Labor, Union & Fringe Intelligence API ───────────────────────────────────

export const laborApi = {
  // Geography
  geoTree: () => api.get('/labor/geo/tree'),
  geoList: () => api.get('/labor/geo'),
  createGeo: (data: any) => api.post('/labor/geo', data),
  updateGeo: (id: string, data: any) => api.put(`/labor/geo/${id}`, data),
  removeGeo: (id: string) => api.delete(`/labor/geo/${id}`),
  // Labor bodies
  bodies: (params?: any) => api.get('/labor/bodies', { params }),
  createBody: (data: any) => api.post('/labor/bodies', data),
  updateBody: (id: string, data: any) => api.put(`/labor/bodies/${id}`, data),
  removeBody: (id: string) => api.delete(`/labor/bodies/${id}`),
  // Agreements
  agreements: (laborBodyId?: string) => api.get('/labor/agreements', { params: { laborBodyId } }),
  agreement: (id: string) => api.get(`/labor/agreements/${id}`),
  createAgreement: (data: any) => api.post('/labor/agreements', data),
  updateAgreement: (id: string, data: any) => api.put(`/labor/agreements/${id}`, data),
  removeAgreement: (id: string) => api.delete(`/labor/agreements/${id}`),
  // Classifications
  createClass: (data: any) => api.post('/labor/classifications', data),
  updateClass: (id: string, data: any) => api.put(`/labor/classifications/${id}`, data),
  removeClass: (id: string) => api.delete(`/labor/classifications/${id}`),
  // Rate rules
  rateRules: (agreementId: string) => api.get('/labor/rate-rules', { params: { agreementId } }),
  createRule: (data: any) => api.post('/labor/rate-rules', data),
  updateRule: (id: string, data: any) => api.put(`/labor/rate-rules/${id}`, data),
  removeRule: (id: string) => api.delete(`/labor/rate-rules/${id}`),
  // Sources
  sources: (laborBodyId?: string) => api.get('/labor/sources', { params: { laborBodyId } }),
  createSource: (data: any) => api.post('/labor/sources', data),
  updateSource: (id: string, data: any) => api.put(`/labor/sources/${id}`, data),
  removeSource: (id: string) => api.delete(`/labor/sources/${id}`),
  // Refresh engine (allow-listed fetch → review proposals)
  refresh: (laborBodyIds: string[] = []) => api.post('/labor/refresh', { laborBodyIds }),
  aiResearch: (data: { agreementId: string; sourceId?: string; url?: string }) => api.post('/labor/ai-research', data),
  aiUpdateAll: () => api.post('/labor/ai-update-all'),
  // Rate-change proposals (approval queue)
  proposals: (status?: string) => api.get('/labor/proposals', { params: { status } }),
  pendingCount: () => api.get('/labor/proposals/pending-count'),
  createProposal: (data: any) => api.post('/labor/proposals', data),
  approveProposal: (id: string, notes?: string) => api.post(`/labor/proposals/${id}/approve`, { notes }),
  rejectProposal: (id: string, notes?: string) => api.post(`/labor/proposals/${id}/reject`, { notes }),
  // Resolution / preview
  resolve: (config: any) => api.post('/labor/resolve', config),
  // Project snapshot
  projectConfig: (projectId: string) => api.get(`/labor/project/${projectId}/config`),
  saveConfig: (projectId: string, data: any) => api.put(`/labor/project/${projectId}/config`, data),
  snapshot: (projectId: string, data: any) => api.post(`/labor/project/${projectId}/snapshot`, data),
  toggleRule: (id: string, enabled: boolean) => api.put(`/labor/project-rule/${id}/toggle`, { enabled }),
  updates: (projectId: string) => api.get(`/labor/project/${projectId}/updates`),
  applyUpdates: (projectId: string, ids: string[]) => api.post(`/labor/project/${projectId}/apply-updates`, { projectRateRuleIds: ids }),
  // Budget integration
  applyFringes: (versionId: string) => api.post(`/labor/budget/${versionId}/apply-fringes`),
  fringeDetail: (versionId: string) => api.get(`/labor/budget/${versionId}/fringe-detail`),
  // Incentives & tax credits
  incentives: (geoNodeId?: string) => api.get('/labor/incentives', { params: { geoNodeId } }),
  createIncentive: (data: any) => api.post('/labor/incentives', data),
  updateIncentive: (id: string, data: any) => api.put(`/labor/incentives/${id}`, data),
  removeIncentive: (id: string) => api.delete(`/labor/incentives/${id}`),
  projectIncentives: (projectId: string) => api.get(`/labor/project/${projectId}/incentives`),
  addProjectIncentive: (projectId: string, data: any) => api.post(`/labor/project/${projectId}/incentives`, data),
  updateProjectIncentive: (id: string, data: any) => api.put(`/labor/project-incentive/${id}`, data),
  removeProjectIncentive: (id: string) => api.delete(`/labor/project-incentive/${id}`),
  // Abu Dhabi rebate claim tracker
  getClaim: (projectId: string) => api.get(`/labor/project/${projectId}/claim`),
  saveClaim: (projectId: string, data: any) => api.put(`/labor/project/${projectId}/claim`, data),
};

// ── Executive dashboard API ────────────────────────────────────────────────

export const dashboardApi = {
  executive: () => api.get('/dashboard/executive'),
};

// ── Cloud integrations (OAuth) API ─────────────────────────────────────────

export const integrationsApi = {
  status: () => api.get('/integrations'),
  connectUrl: (provider: string) => api.get(`/integrations/${provider}/connect`),
  disconnect: (provider: string) => api.delete(`/integrations/${provider}`),
  files: (provider: string, q?: string) => api.get(`/integrations/${provider}/files`, { params: { q } }),
  importFile: (provider: string, data: any) => api.post(`/integrations/${provider}/import`, data),
};

// ── Accounting (GL + Bank Rec) API ─────────────────────────────────────────

export const accountingApi = {
  // Chart of accounts
  accounts: (params?: any) => api.get('/accounting/accounts', { params }),
  createAccount: (data: any) => api.post('/accounting/accounts', data),
  updateAccount: (id: string, data: any) => api.put(`/accounting/accounts/${id}`, data),
  deleteAccount: (id: string) => api.delete(`/accounting/accounts/${id}`),
  seed: () => api.post('/accounting/accounts/seed'),
  // Journals
  journals: (params?: any) => api.get('/accounting/journals', { params }),
  journal: (id: string) => api.get(`/accounting/journals/${id}`),
  createJournal: (data: any) => api.post('/accounting/journals', data),
  updateJournal: (id: string, data: any) => api.put(`/accounting/journals/${id}`, data),
  postJournal: (id: string) => api.patch(`/accounting/journals/${id}/post`),
  voidJournal: (id: string) => api.patch(`/accounting/journals/${id}/void`),
  deleteJournal: (id: string) => api.delete(`/accounting/journals/${id}`),
  // Auto-posting
  postingStatus: () => api.get('/accounting/posting-status'),
  postAll: () => api.post('/accounting/post-all'),
  postBurden: (versionId: string) => api.post(`/accounting/post-burden/${versionId}`),
  // Reports
  trialBalance: (params?: any) => api.get('/accounting/trial-balance', { params }),
  summary: (params?: any) => api.get('/accounting/summary', { params }),
  ledger: (accountId: string, params?: any) => api.get(`/accounting/ledger/${accountId}`, { params }),
  // Bank
  bankAccounts: () => api.get('/accounting/bank-accounts'),
  createBankAccount: (data: any) => api.post('/accounting/bank-accounts', data),
  reconcileWorkspace: (id: string) => api.get(`/accounting/bank-accounts/${id}/reconcile`),
  toggleClear: (lineId: string, reconciled: boolean) => api.patch(`/accounting/lines/${lineId}/clear`, { reconciled }),
  completeReconciliation: (data: any) => api.post('/accounting/reconciliations', data),
};

// ── Inventory / Consumables API ────────────────────────────────────────────

export const inventoryApi = {
  list: (params?: any) => api.get('/inventory', { params }),
  get: (id: string) => api.get(`/inventory/${id}`),
  summary: () => api.get('/inventory/summary'),
  categories: () => api.get('/inventory/categories'),
  create: (data: any) => api.post('/inventory', data),
  update: (id: string, data: any) => api.put(`/inventory/${id}`, data),
  remove: (id: string) => api.delete(`/inventory/${id}`),
  move: (id: string, data: any) => api.post(`/inventory/${id}/movements`, data),
};

// ── Maintenance (Third-Party) API ─────────────────────────────────────────

export const maintenanceApi = {
  vendors: {
    list: (params?: any) => api.get('/maintenance/vendors', { params }),
    get: (id: string) => api.get(`/maintenance/vendors/${id}`),
    financialSummary: (id: string) => api.get(`/maintenance/vendors/${id}/financial-summary`),
    create: (data: any) => api.post('/maintenance/vendors', data),
    update: (id: string, data: any) => api.put(`/maintenance/vendors/${id}`, data),
    addDocument: (id: string, data: any) => api.post(`/maintenance/vendors/${id}/documents`, data),
    removeDocument: (docId: string) => api.delete(`/maintenance/vendors/documents/${docId}`),
  },
  jobs: {
    list: (params?: any) => api.get('/maintenance/jobs', { params }),
    get: (id: string) => api.get(`/maintenance/jobs/${id}`),
    summary: () => api.get('/maintenance/jobs/summary'),
    costPerAsset: () => api.get('/maintenance/jobs/reports/cost-per-asset'),
    costPerVendor: () => api.get('/maintenance/jobs/reports/cost-per-vendor'),
    create: (data: any) => api.post('/maintenance/jobs', data),
    update: (id: string, data: any) => api.put(`/maintenance/jobs/${id}`, data),
    updateStatus: (id: string, status: string, notes?: string) => api.patch(`/maintenance/jobs/${id}/status`, { status, notes }),
    addPhoto: (id: string, url: string) => api.patch(`/maintenance/jobs/${id}/photos/add`, { url }),
    removePhoto: (id: string, url: string) => api.patch(`/maintenance/jobs/${id}/photos/remove`, { url }),
  },
  parts: {
    list: (params?: any) => api.get('/maintenance/parts', { params }),
    get: (id: string) => api.get(`/maintenance/parts/${id}`),
    warrantyAlerts: () => api.get('/maintenance/parts/warranty-alerts'),
    create: (data: any) => api.post('/maintenance/parts', data),
    update: (id: string, data: any) => api.put(`/maintenance/parts/${id}`, data),
  },
  tires: {
    list: (params?: any) => api.get('/maintenance/tires', { params }),
    get: (id: string) => api.get(`/maintenance/tires/${id}`),
    byAsset: (assetId: string) => api.get(`/maintenance/tires/by-asset/${assetId}`),
    warrantyAlerts: () => api.get('/maintenance/tires/warranty-alerts'),
    create: (data: any) => api.post('/maintenance/tires', data),
    update: (id: string, data: any) => api.put(`/maintenance/tires/${id}`, data),
  },
  quotations: {
    list: (params?: any) => api.get('/maintenance/quotations', { params }),
    create: (data: any) => api.post('/maintenance/quotations', data),
    update: (id: string, data: any) => api.put(`/maintenance/quotations/${id}`, data),
    approve: (id: string) => api.patch(`/maintenance/quotations/${id}/approve`),
  },
  invoices: {
    list: (params?: any) => api.get('/maintenance/vendor-invoices', { params }),
    get: (id: string) => api.get(`/maintenance/vendor-invoices/${id}`),
    outstanding: () => api.get('/maintenance/vendor-invoices/outstanding'),
    create: (data: any) => api.post('/maintenance/vendor-invoices', data),
    update: (id: string, data: any) => api.put(`/maintenance/vendor-invoices/${id}`, data),
  },
  payments: {
    list: (params?: any) => api.get('/maintenance/vendor-payments', { params }),
    create: (data: any) => api.post('/maintenance/vendor-payments', data),
    clear: (id: string) => api.patch(`/maintenance/vendor-payments/${id}/clear`),
  },
};

// ── Service Catalog API ───────────────────────────────────────────────────

export const servicesApi = {
  list:         (params?: any) => api.get('/finance/services', { params }),
  get:          (id: string) => api.get(`/finance/services/${id}`),
  create:       (data: any) => api.post('/finance/services', data),
  update:       (id: string, data: any) => api.put(`/finance/services/${id}`, data),
  toggleActive: (id: string) => api.patch(`/finance/services/${id}/toggle-active`),
  categories:   () => api.get('/finance/services/categories'),
  costCenters:        () => api.get('/finance/services/cost-centers'),
  createCostCenter:   (data: any) => api.post('/finance/services/cost-centers', data),
  updateCostCenter:   (id: string, data: any) => api.put(`/finance/services/cost-centers/${id}`, data),
  deleteCostCenter:   (id: string) => api.delete(`/finance/services/cost-centers/${id}`),
};

// ── Contacts Directory API ────────────────────────────────────────────────

export const contactsApi = {
  list: (params?: any) => api.get('/contacts', { params }),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: any) => api.post('/contacts', data),
  update: (id: string, data: any) => api.put(`/contacts/${id}`, data),
  remove: (id: string) => api.delete(`/contacts/${id}`),
};

// ── Settings API ─────────────────────────────────────────────────────────

export const settingsApi = {
  get:    ()          => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
  emailTest: (to?: string) => api.post('/settings/email-test', { to }),
};

// ── Clients API ───────────────────────────────────────────────────────────

export const clientsApi = {
  list: (params?: any) => api.get('/clients', { params: typeof params === 'string' ? { search: params } : params }),
  get: (id: string) => api.get(`/clients/${id}`),
  balance: (id: string) => api.get(`/clients/${id}/balance`),
  financialSummary: (id: string) => api.get(`/clients/${id}/financial-summary`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
  updateStatus: (id: string, status: string, blockReason?: string) =>
    api.patch(`/clients/${id}/status`, { status, blockReason }),
  addContact: (id: string, data: any) => api.post(`/clients/${id}/contacts`, data),
  updateContact: (contactId: string, data: any) => api.put(`/clients/contacts/${contactId}`, data),
  removeContact: (contactId: string) => api.delete(`/clients/contacts/${contactId}`),
  addDocument: (id: string, data: any) => api.post(`/clients/${id}/documents`, data),
  removeDocument: (docId: string) => api.delete(`/clients/documents/${docId}`),
};

// ── Status Management API ─────────────────────────────────────────────────

export const statusApi = {
  history:          (module: string, recordId: string) =>
                      api.get('/status/history', { params: { module, recordId } }),
  recent:           (limit = 20) =>
                      api.get('/status/recent', { params: { limit } }),
  pendingApprovals: () => api.get('/status/pending-approvals'),
  kanban:           (module: string) => api.get('/status/kanban', { params: { module } }),
  kpi:              () => api.get('/status/kpi'),
  analytics:        (module: string) => api.get('/status/analytics', { params: { module } }),
  updateStatus:     (module: string, id: string, status: string, notes?: string) => {
    const endpoints: Record<string, string> = {
      Invoice:     `/finance/invoices/${id}/status`,
      Quotation:   `/finance/quotations/${id}/status`,
      Booking:     `/rental/bookings/${id}/status`,
      Asset:       `/rental/assets/${id}/status`,
      Maintenance: `/maintenance/jobs/${id}/status`,
    };
    return api.patch(endpoints[module], { status, notes });
  },
};

// ── Company Management API ────────────────────────────────────────────────

export const companyApi = {
  get:           ()                          => api.get('/company'),
  update:        (data: any)                 => api.put('/company', data),
  completeSetup: (data: any)                 => api.post('/company/complete-setup', data),
  expiryAlerts:  (days?: number)             => api.get('/company/expiry-alerts', { params: days ? { days } : undefined }),
  // Bank accounts
  bankAccounts: {
    list:   ()                        => api.get('/company/bank-accounts'),
    create: (data: any)               => api.post('/company/bank-accounts', data),
    update: (id: string, data: any)   => api.put(`/company/bank-accounts/${id}`, data),
    remove: (id: string)              => api.delete(`/company/bank-accounts/${id}`),
  },
  // Locations
  locations: {
    list:   ()                        => api.get('/company/locations'),
    create: (data: any)               => api.post('/company/locations', data),
    update: (id: string, data: any)   => api.put(`/company/locations/${id}`, data),
    remove: (id: string)              => api.delete(`/company/locations/${id}`),
  },
  // Documents
  documents: {
    list:   ()                        => api.get('/company/documents'),
    create: (data: any)               => api.post('/company/documents', data),
    update: (id: string, data: any)   => api.put(`/company/documents/${id}`, data),
    remove: (id: string)              => api.delete(`/company/documents/${id}`),
  },
};

// ── HR & Workforce API ────────────────────────────────────────────────────

// ── HR & Workforce API ────────────────────────────────────────────────────

export const hrApi = {
  stats:        ()                          => api.get('/hr/employees/stats'),
  expiryAlerts: (days?: number)             => api.get('/hr/expiry-alerts', { params: days ? { days } : undefined }),
  employees: {
    list:   (params?: any)            => api.get('/hr/employees', { params }),
    get:    (id: string)             => api.get(`/hr/employees/${id}`),
    create: (data: any)              => api.post('/hr/employees', data),
    update: (id: string, data: any)  => api.put(`/hr/employees/${id}`, data),
    remove: (id: string)             => api.delete(`/hr/employees/${id}`),
    addDocument:         (id: string, data: any) => api.post(`/hr/employees/${id}/documents`, data),
    removeDocument:      (docId: string)         => api.delete(`/hr/documents/${docId}`),
    assignAsset:         (id: string, data: any) => api.post(`/hr/employees/${id}/assets`, data),
    returnAsset:         (assignId: string)      => api.patch(`/hr/assets/${assignId}/return`),
    addCertification:    (id: string, data: any) => api.post(`/hr/employees/${id}/certifications`, data),
    removeCertification: (certId: string)        => api.delete(`/hr/certifications/${certId}`),
  },
  leave: {
    list:      (params?: any)            => api.get('/hr/leave', { params }),
    create:    (data: any)               => api.post('/hr/leave', data),
    setStatus: (id: string, status: string) => api.patch(`/hr/leave/${id}/status`, { status }),
  },
};

// ── HR: Attendance & Payroll API ──────────────────────────────────────────

export const attendanceApi = {
  list:      (params?: any) => api.get('/hr/attendance', { params }),
  timesheet: (month: number, year: number) => api.get('/hr/attendance/timesheet', { params: { month, year } }),
  clockIn:   (employeeId: string, at?: string) => api.post('/hr/attendance/clock-in', { employeeId, at }),
  clockOut:  (id: string, at?: string) => api.patch(`/hr/attendance/${id}/clock-out`, { at }),
  create:    (data: any) => api.post('/hr/attendance', data),
  remove:    (id: string) => api.delete(`/hr/attendance/${id}`),
};

export const payrollApi = {
  list:          () => api.get('/hr/payroll'),
  get:           (id: string) => api.get(`/hr/payroll/${id}`),
  generate:      (month: number, year: number, notes?: string) => api.post('/hr/payroll/generate', { month, year, notes }),
  updatePayslip: (payslipId: string, data: any) => api.put(`/hr/payroll/payslips/${payslipId}`, data),
  setStatus:     (id: string, status: string) => api.patch(`/hr/payroll/${id}/status`, { status }),
  remove:        (id: string) => api.delete(`/hr/payroll/${id}`),
};

// ── Users (account management — linked to HR employees) ──────────────────────

export const usersApi = {
  list:               (search?: string) => api.get('/users', { params: search ? { search } : undefined }),
  get:                (id: string) => api.get(`/users/${id}`),
  availableEmployees: (search?: string) => api.get('/users/available-employees', { params: search ? { search } : undefined }),
  create:             (data: any) => api.post('/users', data),
  update:             (id: string, data: any) => api.put(`/users/${id}`, data),
};

// ── Production crew directory ────────────────────────────────────────────────
export const crewApi = {
  availability: (id: string) => api.get(`/crew/${id}/availability`),
  list:        (params?: any) => api.get('/crew', { params }),
  get:         (id: string) => api.get(`/crew/${id}`),
  departments: () => api.get('/crew/departments'),
  create:      (data: any) => api.post('/crew', data),
  update:      (id: string, data: any) => api.put(`/crew/${id}`, data),
  remove:      (id: string) => api.delete(`/crew/${id}`),
  // V1.2 ERP identity link
  parentUsers: (search?: string) => api.get('/crew/parent-users', { params: { search } }),
  linkParentUser: (id: string, parentSystemUserId: string | null) => api.put(`/crew/${id}/parent-user`, { parentSystemUserId }),
  // Paste-a-profile importer (ADFC-style fields)
  parseProfile: (text: string) => api.post('/crew/parse-profile', { text }),
};

// ── Travel + Visa + Accommodation (Phase 2) ──────────────────────────────────
export const travelApi = {
  travelers:    (params?: { personType?: string; includeCompanions?: string }) => api.get('/travel/travelers', { params }),
  traveler:     (id: string) => api.get(`/travel/travelers/${id}`),               // full identity dossier
  addTraveler:  (d: any) => api.post('/travel/travelers', d),
  updTraveler:  (id: string, d: any) => api.put(`/travel/travelers/${id}`, d),
  readiness:    (id: string) => api.get(`/travel/travelers/${id}/readiness`),
  arrivalSheet: (id: string) => api.get(`/travel/travelers/${id}/arrival-sheet`),
  addCompanion: (id: string, d: any) => api.post(`/travel/travelers/${id}/companions`, d),
  addVisaRec:   (id: string, d: any) => api.post(`/travel/travelers/${id}/visa-records`, d),
  updVisaRec:   (id: string, d: any) => api.put(`/travel/visa-records/${id}`, d),
  delVisaRec:   (id: string) => api.delete(`/travel/visa-records/${id}`),
  addDoc:       (id: string, d: any) => api.post(`/travel/travelers/${id}/documents`, d),
  delDoc:       (id: string) => api.delete(`/travel/documents/${id}`),
  upsertArrival:(id: string, d: any) => api.post(`/travel/travelers/${id}/arrivals`, d),
  requirements: (id: string, d: any) => api.post(`/travel/travelers/${id}/requirements`, d),
  identityFromTalent: (talentId: string) => api.post(`/travel/identities/from-talent/${talentId}`),
  identityFromCrew:   (crewMemberId: string) => api.post(`/travel/identities/from-crew/${crewMemberId}`),
  dashboard:    () => api.get('/travel/dashboard'),
  trips:        (arg?: string | { projectId?: string; scope?: string }) => api.get('/travel/trips', { params: typeof arg === 'string' ? { projectId: arg } : (arg || {}) }),
  trip:         (id: string) => api.get(`/travel/trips/${id}`),
  request:      (d: any) => api.post('/travel/trips', d),
  approve:      (id: string) => api.post(`/travel/trips/${id}/approve`),
  expensePush:  (id: string) => api.post(`/travel/trips/${id}/expense-push`),
  addItinerary: (id: string, d: any) => api.post(`/travel/trips/${id}/itineraries`, d),
  searchFlights:(d: any) => api.post('/travel/flights/search', d),
  bookFlight:   (id: string, d: any) => api.post(`/travel/itineraries/${id}/flights`, d),
  addHotel:     (id: string, d: any) => api.post(`/travel/itineraries/${id}/hotels`, d),
  addCar:       (id: string, d: any) => api.post(`/travel/itineraries/${id}/cars`, d),
  commit:       (id: string) => api.post(`/travel/itineraries/${id}/commit`),
  post:         (id: string) => api.post(`/travel/itineraries/${id}/post`),
  visas:        (status?: string) => api.get('/travel/visas', { params: { status } }),
  updVisa:      (id: string, d: any) => api.patch(`/travel/visas/${id}`, d),
};

// ── Accommodation & Logistics (SYS-12) ───────────────────────────────────────
export const accommodationApi = {
  properties:   (params?: { type?: string; q?: string }) => api.get('/logistics/accommodation/properties', { params }),
  property:     (id: string) => api.get(`/logistics/accommodation/properties/${id}`),
  addProperty:  (d: any) => api.post('/logistics/accommodation/properties', d),
  updProperty:  (id: string, d: any) => api.put(`/logistics/accommodation/properties/${id}`, d),
  delProperty:  (id: string) => api.delete(`/logistics/accommodation/properties/${id}`),
  addRoom:      (propertyId: string, d: any) => api.post(`/logistics/accommodation/properties/${propertyId}/rooms`, d),
  updRoom:      (id: string, d: any) => api.put(`/logistics/accommodation/rooms/${id}`, d),
  delRoom:      (id: string) => api.delete(`/logistics/accommodation/rooms/${id}`),
  assignments:  (params?: { projectId?: string; scope?: string }) => api.get('/logistics/accommodation/assignments', { params }),
  addAssignment:(d: any) => api.post('/logistics/accommodation/assignments', d),
  updAssignment:(id: string, d: any) => api.put(`/logistics/accommodation/assignments/${id}`, d),
  delAssignment:(id: string) => api.delete(`/logistics/accommodation/assignments/${id}`),
  needs:        (projectId: string) => api.get('/logistics/accommodation/needs', { params: { projectId } }),
  rooming:      (projectId: string) => api.get('/logistics/accommodation/rooming', { params: { projectId } }),
};

// ── Transport operations (SYS-12.C) — hire vehicles/drivers for productions ────
export const transportApi = {
  // Vehicles (in-house OR hired)
  vehicles:      (params?: { projectId?: string; scope?: string; source?: string }) => api.get('/logistics/transport/vehicles', { params }),
  addVehicle:    (d: any) => api.post('/logistics/transport/vehicles', d),
  updVehicle:    (id: string, d: any) => api.put(`/logistics/transport/vehicles/${id}`, d),
  delVehicle:    (id: string) => api.delete(`/logistics/transport/vehicles/${id}`),
  fleetVehicles: () => api.get('/logistics/transport/fleet-vehicles'),
  // Drivers (in-house OR hired)
  drivers:       (params?: { source?: string }) => api.get('/logistics/transport/drivers', { params }),
  addDriver:     (d: any) => api.post('/logistics/transport/drivers', d),
  updDriver:     (id: string, d: any) => api.put(`/logistics/transport/drivers/${id}`, d),
  delDriver:     (id: string) => api.delete(`/logistics/transport/drivers/${id}`),
  fleetDrivers:  () => api.get('/logistics/transport/fleet-drivers'),
  // Pickers
  suppliers:     () => api.get('/logistics/transport/suppliers'),
  travelers:     (projectId: string) => api.get('/logistics/transport/travelers', { params: { projectId } }),
  // Orders / movements
  orders:        (params?: { projectId?: string; scope?: string; date?: string; status?: string }) => api.get('/logistics/transport/orders', { params }),
  addOrder:      (d: any) => api.post('/logistics/transport/orders', d),
  updOrder:      (id: string, d: any) => api.put(`/logistics/transport/orders/${id}`, d),
  delOrder:      (id: string) => api.delete(`/logistics/transport/orders/${id}`),
  addPassenger:  (orderId: string, travelerId: string) => api.post(`/logistics/transport/orders/${orderId}/passengers`, { travelerId }),
  delPassenger:  (id: string) => api.delete(`/logistics/transport/passengers/${id}`),
  // Daily Movement Board
  movementBoard: (date: string, projectId?: string) => api.get('/logistics/transport/movement-board', { params: { date, projectId } }),
  // Fuel (SYS-12.E)
  fuel:          (params?: { projectId?: string; transportVehicleId?: string }) => api.get('/logistics/transport/fuel', { params }),
  addFuel:       (d: any) => api.post('/logistics/transport/fuel', d),
  delFuel:       (id: string) => api.delete(`/logistics/transport/fuel/${id}`),
  fuelReport:    (projectId: string) => api.get('/logistics/transport/fuel-report', { params: { projectId } }),
  // Car rental → Two-Ledger (SYS-12.E)
  commitVehicle: (id: string) => api.post(`/logistics/transport/vehicles/${id}/commit`),
  postVehicle:   (id: string) => api.post(`/logistics/transport/vehicles/${id}/post`),
};

// ── Shuttle & bus scheduling (SYS-12.D) ───────────────────────────────────────
export const shuttleApi = {
  routes:    (params?: { projectId?: string; scope?: string }) => api.get('/logistics/shuttle/routes', { params }),
  route:     (id: string) => api.get(`/logistics/shuttle/routes/${id}`),
  addRoute:  (d: any) => api.post('/logistics/shuttle/routes', d),
  updRoute:  (id: string, d: any) => api.put(`/logistics/shuttle/routes/${id}`, d),
  delRoute:  (id: string) => api.delete(`/logistics/shuttle/routes/${id}`),
  addStop:   (routeId: string, d: any) => api.post(`/logistics/shuttle/routes/${routeId}/stops`, d),
  updStop:   (id: string, d: any) => api.put(`/logistics/shuttle/stops/${id}`, d),
  delStop:   (id: string) => api.delete(`/logistics/shuttle/stops/${id}`),
  reorderStops: (routeId: string, ids: string[]) => api.post(`/logistics/shuttle/routes/${routeId}/reorder-stops`, { ids }),
  addRider:  (routeId: string, d: any) => api.post(`/logistics/shuttle/routes/${routeId}/riders`, d),
  delRider:  (id: string) => api.delete(`/logistics/shuttle/riders/${id}`),
  manifest:  (routeId: string) => api.get(`/logistics/shuttle/routes/${routeId}/manifest`),
  travelers: (projectId: string) => api.get('/logistics/shuttle/travelers', { params: { projectId } }),
};

// ── Arrival operations (SYS-12.F) ─────────────────────────────────────────────
export const arrivalApi = {
  list:      (params?: { projectId?: string; scope?: string; date?: string; status?: string }) => api.get('/logistics/arrivals', { params }),
  dashboard: (projectId?: string, date?: string) => api.get('/logistics/arrivals/dashboard', { params: { projectId, date } }),
  expected:  (projectId: string) => api.get('/logistics/arrivals/expected', { params: { projectId } }),
  create:    (d: any) => api.post('/logistics/arrivals', d),
  update:    (id: string, d: any) => api.put(`/logistics/arrivals/${id}`, d),
  advance:   (id: string) => api.post(`/logistics/arrivals/${id}/advance`),
  remove:    (id: string) => api.delete(`/logistics/arrivals/${id}`),
};

// ── Logistics & executive reports (SYS-12.G) ──────────────────────────────────
export const logisticsReportsApi = {
  summary:  (projectId: string) => api.get('/logistics/reports/summary', { params: { projectId } }),
  overview: () => api.get('/logistics/reports/overview'),
};

// ── Contracts & Deal Memos ───────────────────────────────────────────────────
export const contractsApi = {
  // Masters
  templates:    () => api.get('/contracts/templates'),
  template:     (id: string) => api.get(`/contracts/templates/${id}`),
  addTemplate:  (d: any) => api.post('/contracts/templates', d),
  updTemplate:  (id: string, d: any) => api.put(`/contracts/templates/${id}`, d),
  clauses:      () => api.get('/contracts/clauses'),
  addClause:    (d: any) => api.post('/contracts/clauses', d),
  // Project contracts
  dashboard:    () => api.get('/contracts/dashboard'),
  list:         (arg?: string | { projectId?: string; scope?: string }) => api.get('/contracts', { params: typeof arg === 'string' ? { projectId: arg } : (arg || {}) }),
  get:          (id: string) => api.get(`/contracts/${id}`),
  generate:     (d: any) => api.post('/contracts/generate', d),
  send:         (id: string, d: any = {}) => api.post(`/contracts/${id}/send`, d),
  markSigned:   (id: string) => api.post(`/contracts/${id}/mark-signed`),
  // DocuSign-style webhook (used here to simulate signing from the UI)
  simulateSign: (d: any) => api.post('/contracts/webhooks/esign', d),
};

// ── Casting & Recruitment ────────────────────────────────────────────────────
export const castingApi = {
  // Master talent
  unions:        () => api.get('/casting/unions'), // performer unions/guilds from the Labor master
  talent:        (params?: any) => api.get('/casting/talent', { params }),
  getTalent:     (id: string) => api.get(`/casting/talent/${id}`),
  talentReadiness:(id: string, projectId?: string) => api.get(`/casting/talent/${id}/readiness`, { params: { projectId } }),
  // Talent intelligence — performance reviews (V2.0, internal-only)
  reviews:        (id: string) => api.get(`/casting/talent/${id}/reviews`),
  addReview:      (id: string, d: any) => api.post(`/casting/talent/${id}/reviews`, d),
  // V3-B Representation & Credits
  reps:           (id: string) => api.get(`/casting/talent/${id}/representations`),
  addRep:         (id: string, d: any) => api.post(`/casting/talent/${id}/representations`, d),
  updRep:         (id: string, d: any) => api.put(`/casting/representations/${id}`, d),
  delRep:         (id: string) => api.delete(`/casting/representations/${id}`),
  credits:        (id: string) => api.get(`/casting/talent/${id}/credits`),
  addCredit:      (id: string, d: any) => api.post(`/casting/talent/${id}/credits`, d),
  delCredit:      (id: string) => api.delete(`/casting/credits/${id}`),
  // V3-C CRM
  interactions:   (id: string, projectId?: string) => api.get(`/casting/talent/${id}/interactions`, { params: { projectId } }),
  addInteraction: (id: string, d: any) => api.post(`/casting/talent/${id}/interactions`, d),
  delInteraction: (id: string) => api.delete(`/casting/interactions/${id}`),
  relScores:      (id: string) => api.get(`/casting/talent/${id}/relationship-scores`),
  // V3-D Character history
  characterHistory: (id: string) => api.get(`/casting/characters/${id}/history`),
  // V3-F Matching engine
  characterMatches: (id: string) => api.get(`/casting/characters/${id}/matches`),
  match:            (characterId: string, talentId: string) => api.get('/casting/match', { params: { characterId, talentId } }),
  // V3-G Expanded pipeline
  pipeline:         () => api.get('/casting/pipeline'),
  setStage:         (submissionId: string, status: string) => api.patch(`/casting/submissions/${submissionId}/pipeline`, { status }),
  // V3-H Self-tape management
  packages:         (callId: string) => api.get(`/casting/calls/${callId}/packages`),
  addPackage:       (callId: string, d: any) => api.post(`/casting/calls/${callId}/packages`, d),
  updPackage:       (id: string, d: any) => api.put(`/casting/packages/${id}`, d),
  delPackage:       (id: string) => api.delete(`/casting/packages/${id}`),
  selfTapes:        (params: { packageId?: string; submissionId?: string }) => api.get('/casting/self-tapes', { params }),
  addSelfTape:      (d: any) => api.post('/casting/self-tapes', d),
  setSelfTapeStatus:(id: string, status: string) => api.patch(`/casting/self-tapes/${id}/status`, { status }),
  delSelfTape:      (id: string) => api.delete(`/casting/self-tapes/${id}`),
  // V3-E Advanced search + saved searches + lists
  search:         (filters: any) => api.post('/casting/talent-search', filters),
  savedSearches:  () => api.get('/casting/saved-searches'),
  saveSearch:     (d: any) => api.post('/casting/saved-searches', d),
  delSavedSearch: (id: string) => api.delete(`/casting/saved-searches/${id}`),
  talentLists:    (projectId?: string) => api.get('/casting/talent-lists', { params: { projectId } }),
  talentList:     (id: string) => api.get(`/casting/talent-lists/${id}`),
  createList:     (d: any) => api.post('/casting/talent-lists', d),
  delList:        (id: string) => api.delete(`/casting/talent-lists/${id}`),
  addToList:      (listId: string, talentId: string, notes?: string) => api.post(`/casting/talent-lists/${listId}/members`, { talentId, notes }),
  delListMember:  (id: string) => api.delete(`/casting/talent-list-members/${id}`),
  addTalent:     (d: any) => api.post('/casting/talent', d),
  updTalent:     (id: string, d: any) => api.put(`/casting/talent/${id}`, d),
  withdrawConsent:(id: string, reason?: string) => api.post(`/casting/talent/${id}/withdraw-consent`, { reason }),
  // Casting calls
  dashboard:     () => api.get('/casting/dashboard'),
  calls:         (arg?: string | { projectId?: string; scope?: string }) => api.get('/casting/calls', { params: typeof arg === 'string' ? { projectId: arg } : (arg || {}) }),
  createCall:    (d: any) => api.post('/casting/calls', d),
  call:          (id: string) => api.get(`/casting/calls/${id}`),
  characters:    (projectId?: string) => api.get('/casting/characters', { params: { projectId } }),
  character:     (id: string) => api.get(`/casting/characters/${id}`),
  addCharacter:  (d: any) => api.post('/casting/characters', d),
  updCharacter:  (id: string, d: any) => api.put(`/casting/characters/${id}`, d),
  addCall:       (d: any) => api.post('/casting/calls', d),
  fromBreakdown: (d: any) => api.post('/casting/calls/from-breakdown', d),
  updCall:       (id: string, d: any) => api.put(`/casting/calls/${id}`, d),
  setCallStatus: (id: string, status: string) => api.patch(`/casting/calls/${id}/status`, { status }),
  // Submissions / review
  submissions:   (callId: string) => api.get(`/casting/calls/${callId}/submissions`),
  review:        (id: string, d: any) => api.patch(`/casting/submissions/${id}/review`, d),
  setVerdict:    (id: string, verdict: string) => api.patch(`/casting/submissions/${id}/verdict`, { verdict }),
  select:        (id: string, d: any = {}) => api.post(`/casting/submissions/${id}/select`, d),
  // Negotiation (V2.0)
  negotiation:    (submissionId: string) => api.get(`/casting/submissions/${submissionId}/negotiation`),
  openNegotiation:(submissionId: string) => api.post(`/casting/submissions/${submissionId}/negotiation`),
  updNegotiation: (id: string, d: any) => api.put(`/casting/negotiations/${id}`, d),
  agreeNegotiation:(id: string, d: any = {}) => api.post(`/casting/negotiations/${id}/agree`, d),
  // Operations Hub (V2.0)
  operations:     (projectId: string) => api.get('/casting/operations', { params: { projectId } }),
  projectTalent:  (projectId: string) => api.get('/casting/project-talent', { params: { projectId } }),
  opsChecklist:   (submissionId: string, d: any) => api.put(`/casting/submissions/${submissionId}/ops-checklist`, d),
  // Auditions (drag-drop scheduling)
  scheduleAudition: (submissionId: string, d: any) => api.post(`/casting/submissions/${submissionId}/auditions`, d),
  updateAudition:   (id: string, d: any) => api.put(`/casting/auditions/${id}`, d),
  // Public talent portal
  publicCall:    (id: string) => api.get(`/casting/public/calls/${id}`),
  publicSubmit:  (d: any) => api.post('/casting/public/submit', d),
};

// ── CRM (leads & pipeline) ───────────────────────────────────────────────────
export const crmApi = {
  pipeline:     () => api.get('/crm/pipeline'),
  leads:        (params?: any) => api.get('/crm/leads', { params }),
  createLead:   (data: any) => api.post('/crm/leads', data),
  updateLead:   (id: string, data: any) => api.put(`/crm/leads/${id}`, data),
  removeLead:   (id: string) => api.delete(`/crm/leads/${id}`),
  convertLead:  (id: string, data: any) => api.post(`/crm/leads/${id}/convert`, data),
  opportunities:(params?: any) => api.get('/crm/opportunities', { params }),
  createOpp:    (data: any) => api.post('/crm/opportunities', data),
  updateOpp:    (id: string, data: any) => api.put(`/crm/opportunities/${id}`, data),
  setStage:     (id: string, stage: string, lostReason?: string) => api.patch(`/crm/opportunities/${id}/stage`, { stage, lostReason }),
  removeOpp:    (id: string) => api.delete(`/crm/opportunities/${id}`),
  toQuotation:  (id: string) => api.post(`/crm/opportunities/${id}/quotation`),
};

// ── Reports Center ───────────────────────────────────────────────────────────
export const reportsApi = {
  catalog: () => api.get('/reports/catalog'),
  run: (key: string, params?: any) => api.get(`/reports/${key}`, { params }),
};

// ── Collections (reminders + statements) ─────────────────────────────────────
export const collectionsApi = {
  aging:          () => api.get('/finance/collections/aging'),
  getSettings:    () => api.get('/finance/collections/settings'),
  updateSettings: (data: any) => api.put('/finance/collections/settings', data),
  logs:           (invoiceId: string) => api.get(`/finance/collections/reminder-logs/${invoiceId}`),
  remind:         (invoiceId: string, level?: string) => api.post(`/finance/collections/reminders/${invoiceId}`, { level }),
  scan:           () => api.post('/finance/collections/scan'),
  statement:      (clientId: string, from?: string, to?: string) => api.get(`/finance/collections/statement/${clientId}`, { params: { from, to } }),
  emailStatement: (clientId: string, from?: string, to?: string) => api.post(`/finance/collections/statement/${clientId}/email`, { from, to }),
  testEmail:      (to: string) => api.post('/finance/collections/test-email', { to }),
};

// ── Master Script Library (SYS-13b P5) ───────────────────────────────────────
export const masterScriptApi = {
  list:          (params?: any) => api.get('/production/master-scripts', { params }),
  stats:         () => api.get('/production/master-scripts/stats'),
  get:           (id: string) => api.get(`/production/master-scripts/${id}`),
  create:        (data: any) => api.post('/production/master-scripts', data),
  update:        (id: string, data: any) => api.put(`/production/master-scripts/${id}`, data),
  remove:        (id: string) => api.delete(`/production/master-scripts/${id}`),
  addRevision:   (id: string, formData: FormData) => api.post(`/production/master-scripts/${id}/revision`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeRevision:(id: string) => api.delete(`/production/master-scripts/revision/${id}`),
  setPalette:    (id: string, data: any) => api.put(`/production/master-scripts/${id}/palette`, data),
  link:          (id: string, projectId: string) => api.post(`/production/master-scripts/${id}/link/${projectId}`),
};

// ── ScriptON Audio (SYS-13c) ─────────────────────────────────────────────────
export const scriptAudioApi = {
  // engines + routing (admin)
  engines:       () => api.get('/production/audio/engines'),
  engineVoices:  (key: string) => api.get(`/production/audio/engines/${encodeURIComponent(key)}/voices`),
  seedEngines:   () => api.post('/production/audio/engines/seed'),
  createEngine:  (data: any) => api.post('/production/audio/engines', data),
  updateEngine:  (id: string, data: any) => api.put(`/production/audio/engines/${id}`, data),
  routing:       (scope = 'ORG', projectId?: string) => api.get('/production/audio/routing', { params: { scope, projectId } }),
  setRouting:    (capability: string, data: any) => api.put(`/production/audio/routing/${capability}`, data),
  routingResolved: (projectId?: string) => api.get('/production/audio/routing-resolved', { params: { projectId } }),
  // casting + profiles
  detect:        (revisionId: string) => api.get(`/production/audio/casting/${revisionId}`),
  autoCast:      (revisionId: string, projectId?: string) => api.post(`/production/audio/casting/${revisionId}/autocast`, { projectId }),
  assign:        (revisionId: string, name: string, data: any) => api.put(`/production/audio/casting/${revisionId}/character/${encodeURIComponent(name)}`, data),
  unassign:      (id: string) => api.delete(`/production/audio/casting/assignment/${id}`),
  voiceProfiles: (params?: any) => api.get('/production/audio/voice-profiles', { params }),
  createProfile: (data: any) => api.post('/production/audio/voice-profiles', data),
  updateProfile: (id: string, data: any) => api.put(`/production/audio/voice-profiles/${id}`, data),
  removeProfile: (id: string) => api.delete(`/production/audio/voice-profiles/${id}`),
  // pronunciation
  pronunciation:    (params?: any) => api.get('/production/audio/pronunciation', { params }),
  addPronunciation: (data: any) => api.post('/production/audio/pronunciation', data),
  editPronunciation:(id: string, data: any) => api.put(`/production/audio/pronunciation/${id}`, data),
  removePronunciation:(id: string) => api.delete(`/production/audio/pronunciation/${id}`),
  // render + library
  estimate:      (revisionId: string, opts: any = {}) => api.post(`/production/audio/render/estimate/${revisionId}`, opts),
  speak:         (revisionId: string, data: any) => api.post(`/production/audio/speak/${revisionId}`, data),
  render:        (revisionId: string, opts: any = {}) => api.post(`/production/audio/render/${revisionId}`, opts),
  runJob:        (jobId: string) => api.post(`/production/audio/render/run/${jobId}`),
  renderPlan:    (revisionId: string) => api.get(`/production/audio/render/plan/${revisionId}`),
  jobs:          (projectId: string) => api.get(`/production/audio/jobs/${projectId}`),
  job:           (id: string) => api.get(`/production/audio/job/${id}`),
  library:       (projectId: string) => api.get(`/production/audio/library/${projectId}`),
  archiveAsset:  (id: string) => api.post(`/production/audio/library/${id}/archive`),
  usage:         (projectId: string) => api.get(`/production/audio/usage/${projectId}`),
  quota:         (projectId: string) => api.get(`/production/audio/quota/${projectId}`),
  // layers
  cues:          (revisionId: string) => api.get(`/production/audio/layers/cues/${revisionId}`),
  suggestCues:   (revisionId: string) => api.post(`/production/audio/layers/suggest/${revisionId}`),
  upsertCue:     (data: any) => api.post('/production/audio/layers/cue', data),
  cueStatus:     (id: string, status: string) => api.put(`/production/audio/layers/cue/${id}/status`, { status }),
  approveAllCues:(revisionId: string) => api.post(`/production/audio/layers/approve-all/${revisionId}`),
  removeCue:     (id: string) => api.delete(`/production/audio/layers/cue/${id}`),
  layerAssets:   (params?: any) => api.get('/production/audio/layers/assets', { params }),
  uploadLayerAsset: (file: File, body: any = {}) => { const fd = new FormData(); fd.append('file', file); Object.entries(body).forEach(([k, v]) => fd.append(k, String(v ?? ''))); return api.post('/production/audio/layers/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  uploadCueAudio:(cueId: string, file: File) => { const fd = new FormData(); fd.append('file', file); return api.post(`/production/audio/layers/cue/${cueId}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  // share & deliver
  shareLinks:    (assetId: string) => api.get(`/production/audio/share/asset/${assetId}`),
  createShare:   (data: any) => api.post('/production/audio/share', data),
  revokeShare:   (id: string) => api.post(`/production/audio/share/${id}/revoke`),
  emailShare:    (id: string, data: any) => api.post(`/production/audio/share/${id}/email`, data),
  resolveShare:  (token: string, passcode?: string) => api.get(`/public/audio-share/${token}`, { params: passcode ? { passcode } : {} }),
};

// ── Master Location Library (SYS-07) ─────────────────────────────────────────
export const locationLibraryApi = {
  list:        (params?: any) => api.get('/locations-library', { params }),
  stats:       () => api.get('/locations-library/stats'),
  get:         (id: string) => api.get(`/locations-library/${id}`),
  create:      (data: any) => api.post('/locations-library', data),
  update:      (id: string, data: any) => api.put(`/locations-library/${id}`, data),
  archive:     (id: string) => api.patch(`/locations-library/${id}/archive`),
  addMedia:    (id: string, data: any) => api.post(`/locations-library/${id}/media`, data),
  setPrimary:  (mediaId: string) => api.patch(`/locations-library/media/${mediaId}/primary`),
  removeMedia: (mediaId: string) => api.delete(`/locations-library/media/${mediaId}`),
  linkToProject: (id: string, projectId: string, data?: any) => api.post(`/locations-library/${id}/link/${projectId}`, data || {}),
  promote:     (locationId: string) => api.post(`/locations-library/promote/${locationId}`),
  recompute:   (id: string) => api.post(`/locations-library/${id}/recompute-history`),
  analytics:   () => api.get('/locations-library/analytics'),
  expiring:    (days = 30) => api.get('/locations-library/expiring', { params: { days } }),
  mapPoints:   () => api.get('/locations-library/map-points'),
  mapConfig:   () => api.get('/locations-library/map-config'),
  // Slice 7 — permit authority directory
  authorities:      () => api.get('/locations-library/authorities'),
  upsertAuthority:  (data: any) => api.post('/locations-library/authorities', data),
  removeAuthority:  (id: string) => api.delete(`/locations-library/authorities/${id}`),
  // Slice 7 — standalone ops directly on a MASTER library location
  mPermits:    (id: string) => api.get(`/locations-library/${id}/permits`),
  mAddPermit:  (id: string, data: any) => api.post(`/locations-library/${id}/permits`, data),
  mDocs:       (id: string) => api.get(`/locations-library/${id}/documents`),
  mAddDoc:     (id: string, data: any) => api.post(`/locations-library/${id}/documents`, data),
  mSecurity:   (id: string) => api.get(`/locations-library/${id}/security`),
  mAddSecurity:(id: string, data: any) => api.post(`/locations-library/${id}/security`, data),
  mPayments:   (id: string) => api.get(`/locations-library/${id}/payments`),
  mPaySummary: (id: string) => api.get(`/locations-library/${id}/payments/summary`),
  mAddPayment: (id: string, data: any) => api.post(`/locations-library/${id}/payments`, data),
  // shared by-id mutations (either scope)
  updPermit:  (pid: string, data: any) => api.put(`/locations-library/permit/${pid}`, data),
  delPermit:  (pid: string) => api.delete(`/locations-library/permit/${pid}`),
  updDoc:     (did: string, data: any) => api.put(`/locations-library/document/${did}`, data),
  delDoc:     (did: string) => api.delete(`/locations-library/document/${did}`),
  updSecurity:(sid: string, data: any) => api.put(`/locations-library/security/${sid}`, data),
  delSecurity:(sid: string) => api.delete(`/locations-library/security/${sid}`),
  updPayment: (pid: string, data: any) => api.put(`/locations-library/payment/${pid}`, data),
  delPayment: (pid: string) => api.delete(`/locations-library/payment/${pid}`),
  markPaid:   (pid: string) => api.post(`/locations-library/payment/${pid}/paid`),
};

// ── Scouting (SYS-07 slice 2) ────────────────────────────────────────────────
export const scoutingApi = {
  assignments:     (params?: any) => api.get('/scouting/assignments', { params }),
  assignment:      (id: string) => api.get(`/scouting/assignments/${id}`),
  createAssignment:(data: any) => api.post('/scouting/assignments', data),
  updateAssignment:(id: string, data: any) => api.put(`/scouting/assignments/${id}`, data),
  submit:          (assignmentId: string, data: any) => api.post(`/scouting/assignments/${assignmentId}/submissions`, data),
  setSubStatus:    (id: string, status: string, reviewNotes?: string) => api.patch(`/scouting/submissions/${id}/status`, { status, reviewNotes }),
  accept:          (id: string, linkToProject?: boolean) => api.post(`/scouting/submissions/${id}/accept`, { linkToProject }),
};

// ── Location assessment: tech recces + weighted evaluation (SYS-07 slice 3) ───
// SYS-13 · D10 — email-OTP PII reveal
export const otpApi = {
  request: (data: { entityType: string; entityId: string; fields: string[] }) => api.post('/security/otp/request', data),
  verify: (challengeId: string, code: string) => api.post('/security/otp/verify', { challengeId, code }),
};

// Personal Identity & Security — self-service account area
export const accountApi = {
  profile:       () => api.get('/account/profile'),
  updateProfile: (data: { preferredName?: string; legalName?: string }) => api.patch('/account/profile', data),
  uploadAvatar:  (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/account/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  sessions:      () => api.get('/account/sessions'),
  revokeSession: (id: string) => api.delete(`/account/sessions/${id}`),
  revokeOthers:  () => api.delete('/account/sessions/others'),
  // HR/Finance review queue for legal-name changes
  pendingLegalNames: () => api.get('/account/legal-name/pending'),
  clearLegalName: (userId: string, approve: boolean) => api.patch(`/account/${userId}/legal-name/clear`, { approve }),
};

// Two-factor (TOTP) — authenticator-app enrol / confirm / disable
export const twoFactorApi = {
  setup:   () => api.post('/auth/2fa/setup'),
  enable:  (code: string) => api.post('/auth/2fa/enable', { code }),
  disable: (code: string) => api.post('/auth/2fa/disable', { code }),
  backupStatus:     () => api.get('/auth/2fa/backup-codes'),
  regenerateBackup: (code: string) => api.post('/auth/2fa/backup-codes/regenerate', { code }),
};

export const assessmentApi = {
  recces:       (locationId: string) => api.get(`/location-assessment/recces/${locationId}`),
  createRecce:  (locationId: string, data: any) => api.post(`/location-assessment/recces/${locationId}`, data),
  updateRecce:  (id: string, data: any) => api.put(`/location-assessment/recces/${id}`, data),
  upsertNote:   (recceId: string, data: any) => api.post(`/location-assessment/recces/${recceId}/notes`, data),
  removeNote:   (id: string) => api.delete(`/location-assessment/notes/${id}`),
  toggleNote:   (id: string, resolved: boolean) => api.post(`/location-assessment/notes/${id}/toggle`, { resolved }),
  rollup:       (locationId: string) => api.get(`/location-assessment/rollup/${locationId}`),
  checklist:    (department?: string) => api.get(`/location-assessment/checklist${department ? `?department=${department}` : ''}`),
  evaluations:  (locationId: string) => api.get(`/location-assessment/evaluations/${locationId}`),
  upsertEval:   (locationId: string, data: any) => api.post(`/location-assessment/evaluations/${locationId}`, data),
  compare:      (projectId: string) => api.get(`/location-assessment/compare/${projectId}`),
  pack:         (projectId: string) => api.get(`/location-assessment/pack/${projectId}`),
};

// ── Driver app (mobile / field) ──────────────────────────────────────────────
export const driverAppApi = {
  me:              () => api.get('/driver-app/me'),
  jobs:            () => api.get('/driver-app/jobs'),
  createSubmission:(data: any) => api.post('/driver-app/submissions', data),
  mySubmissions:   () => api.get('/driver-app/submissions'),
  pending:         () => api.get('/driver-app/submissions/pending'),
  review:          (id: string, status: string, notes?: string) => api.patch(`/driver-app/submissions/${id}/review`, { status, notes }),
};

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/notifications'),
  emailDigest: (to?: string) => api.post('/notifications/email-digest', { to }),
};

// ── Permissions / RBAC ───────────────────────────────────────────────────────
export const permissionsApi = {
  me:        () => api.get('/permissions/me'),
  matrix:    () => api.get('/permissions/matrix'),
  setRole:   (role: string, permissions: Record<string, number>) => api.put(`/permissions/matrix/${role}`, { permissions }),
};

// ── Compliance (renewals + e-invoicing) ─────────────────────────────────────
export const complianceApi = {
  renewals:      () => api.get('/compliance/renewals'),
  einvoicing:    () => api.get('/compliance/einvoicing'),
  invoicePeppol: (id: string) => api.get(`/compliance/einvoicing/invoice/${id}`),
};

// ── Preventive maintenance ───────────────────────────────────────────────────
export const pmApi = {
  plans:      (assetId?: string) => api.get('/pm/plans', { params: assetId ? { assetId } : undefined }),
  due:        () => api.get('/pm/due'),
  createPlan: (data: any) => api.post('/pm/plans', data),
  updatePlan: (id: string, data: any) => api.put(`/pm/plans/${id}`, data),
  complete:   (id: string, data: any) => api.post(`/pm/plans/${id}/complete`, data),
  deletePlan: (id: string) => api.delete(`/pm/plans/${id}`),
  readings:   (assetId: string, data: any) => api.patch(`/pm/assets/${assetId}/readings`, data),
};

// ── Condition reports (delivery / return inspections) ────────────────────────
export const conditionApi = {
  listByBooking: (bookingId: string) => api.get('/condition-reports', { params: { bookingId } }),
  get:           (id: string) => api.get(`/condition-reports/${id}`),
  create:        (data: any) => api.post('/condition-reports', data),
  remove:        (id: string) => api.delete(`/condition-reports/${id}`),
};

// ── Backups (database snapshots) ─────────────────────────────────────────────
export const backupsApi = {
  status: () => api.get('/backups/status'),
  list:   () => api.get('/backups'),
  create: (label?: string) => api.post('/backups', { label }),
  restore: (id: string) => api.post(`/backups/${id}/restore`),
  remove: (id: string) => api.delete(`/backups/${id}`),
  download: (id: string) => api.get(`/backups/${id}/download`, { responseType: 'blob' }),
};

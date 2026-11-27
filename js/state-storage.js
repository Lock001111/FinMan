// ==================== Application State, Sanitization, Persistence, Privacy & History Guard ====================

const monthNamesID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const monthShortID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// --- DEFAULT INITIAL STATE ---
const defaultAccounts = [
  { id: 'acc-1', name: 'Bank BCA', type: 'Bank', initialBalance: 5000000, isHidden: true, showOnDashboard: true },
  { id: 'acc-2', name: 'GoPay / OVO', type: 'E-Wallet', initialBalance: 350000, isHidden: true, showOnDashboard: true },
  { id: 'acc-3', name: 'Uang Tunai (Dompet)', type: 'Cash', initialBalance: 200000, isHidden: true, showOnDashboard: true }
];

const defaultCategories = [
  { id: 'cat-1', name: 'Makanan & Minuman', type: 'expense', expenseClass: 'dynamic', subcategories: ['Groceries', 'Kopi & Snack', 'Makan Siang', 'Restoran'] },
  { id: 'cat-2', name: 'Tempat Tinggal & Utilitas', type: 'expense', expenseClass: 'fixed', subcategories: ['Air PDAM', 'Internet WiFi', 'Listrik PLN', 'Sewa Kos/Rumah'] },
  { id: 'cat-3', name: 'Transportasi', type: 'expense', expenseClass: 'dynamic', subcategories: ['Bensin', 'Ojek Online', 'Parkir & Tol', 'Servis Motor/Mobil'] },
  { id: 'cat-4', name: 'Hiburan & Langganan', type: 'expense', expenseClass: 'periodic', subcategories: ['Game', 'Langganan Streaming', 'Nonton Bioskop', 'Pakaian'] },
  { id: 'cat-5', name: 'Pemasukan Utama', type: 'income', expenseClass: 'fixed', subcategories: ['Bonus & THR', 'Gaji Pokok', 'Tunjangan'] },
  { id: 'cat-6', name: 'Pemasukan Lain', type: 'income', expenseClass: 'dynamic', subcategories: ['Dividen & Bunga', 'Freelance', 'Penjualan Barang'] }
];

const now = new Date();
const curYear = now.getFullYear();
const curMonth = String(now.getMonth() + 1).padStart(2, '0');
const prevMonth = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0');
const prevYear = now.getMonth() === 0 ? curYear - 1 : curYear;

const defaultTransactions = [
  { id: 'tx-1', type: 'income', amount: 8500000, date: `${curYear}-${curMonth}-01`, accountId: 'acc-1', categoryId: 'cat-5', subcategory: 'Gaji Pokok', note: 'Gaji Bulanan' },
  { id: 'tx-2', type: 'expense', amount: 150000, date: `${curYear}-${curMonth}-02`, accountId: 'acc-2', categoryId: 'cat-1', subcategory: 'Restoran', note: 'Makan bersama tim' },
  { id: 'tx-3', type: 'expense', amount: 450000, date: `${curYear}-${curMonth}-04`, accountId: 'acc-1', categoryId: 'cat-2', subcategory: 'Internet WiFi', note: 'Tagihan WiFi rumah' },
  { id: 'tx-4', type: 'transfer', amount: 300000, adminFee: 1000, date: `${curYear}-${curMonth}-05`, accountId: 'acc-1', toAccountId: 'acc-2', categoryId: '', subcategory: '', note: 'Top up GoPay dari BCA' },
  { id: 'tx-5', type: 'expense', amount: 75000, date: `${curYear}-${curMonth}-06`, accountId: 'acc-3', categoryId: 'cat-3', subcategory: 'Bensin', note: 'Isi Pertalite mobil' },
  { id: 'tx-6', type: 'expense', amount: 180000, date: `${curYear}-${curMonth}-08`, accountId: 'acc-2', categoryId: 'cat-4', subcategory: 'Langganan Streaming', note: 'Netflix & Spotify' },
  { id: 'tx-7', type: 'income', amount: 8000000, date: `${prevYear}-${prevMonth}-01`, accountId: 'acc-1', categoryId: 'cat-5', subcategory: 'Gaji Pokok', note: 'Gaji Bulan Lalu' },
  { id: 'tx-8', type: 'expense', amount: 450000, date: `${prevYear}-${prevMonth}-04`, accountId: 'acc-1', categoryId: 'cat-2', subcategory: 'Internet WiFi', note: 'Tagihan WiFi rumah' }
];

const defaultBackupConfig = {
  frequency: 'on_change',
  retention: 'auto_remove',
  retentionLimit: 5,
  lastBackupTime: null
};

const defaultTxPreferences = {
  defaultAccountId: 'acc-3',
  defaultCategoryId: 'cat-1'
};

const defaultFsBackupConfig = {
  enabled: false,
  fileName: '',
  delaySeconds: 60,
  lastSynced: null
};

// --- APPLICATION STATE WITH SCHEMA VALIDATION & SANITIZATION ---
let accounts, categories, transactions, budgets, backupConfig, backupSnapshots, isNetWorthHidden, txPreferences, fsBackupConfig;
let budgetHistory = [];

// State Privasi Dashboard
let dashPrivacy = {
  income: true,
  expense: false,
  savings: true
};
	
	// ==================== INDEPENDENT SCROLL RETENTION PER MENU ====================
// Default posisi scroll selalu di paling atas (0) saat pertama kali dibuka
const tabScrollPositions = {
  dashboard: 0,
  transactions: 0,
  analysis: 0,
  budgets: 0,
  trends: 0,
  settings: 0
};

// ==================== MOBILE SWIPE GESTURE NAVIGATION ====================
const TABS_ORDER = ['dashboard', 'transactions', 'analysis', 'budgets', 'trends', 'settings'];

function initSwipeNavigation() {
  let touchStartX = null;
  let touchStartY = null;
  let touchStartTime = 0;

  window.addEventListener('touchstart', (e) => {
    // 1. Abaikan jika sentuhan lebih dari 1 jari (misal zoom)
    if (e.touches.length !== 1) {
      touchStartX = null;
      return;
    }

    // 2. Abaikan jika ada modal/pop-up yang sedang terbuka di layar
    const anyModalOpen = allModalIds.some(id => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    }) || document.getElementById('exit-confirm-modal')?.classList.contains('hidden') === false
       || document.getElementById('pwa-update-success-modal')?.classList.contains('hidden') === false
       || document.getElementById('app-lock-overlay')?.classList.contains('hidden') === false;

    if (anyModalOpen) {
      touchStartX = null;
      return;
    }

    // 3. Abaikan jika menu navigasi mobile (hamburger) sedang terbuka
    const mobMenu = document.getElementById('mobile-menu');
    if (mobMenu && !mobMenu.classList.contains('hidden')) {
      touchStartX = null;
      return;
    }

    // 4. Pengaman Edge Swipe: Hindari bentrokan dengan gesture Back/Forward bawaan Android/iOS
    const startX = e.touches[0].clientX;
    const edgeMargin = 25; // Abaikan sentuhan 25px dari tepi kiri dan kanan layar
    if (startX < edgeMargin || startX > (window.innerWidth - edgeMargin)) {
      touchStartX = null;
      return;
    }

    // 5. Pengecualian area interaktif (grafik/canvas, input/textarea/select, tabel scroll horizontal)
    let targetEl = e.target;
    while (targetEl && targetEl !== document.body) {
      const tag = targetEl.tagName;
      if (['CANVAS', 'INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        touchStartX = null;
        return;
      }
      // Abaikan jika jari menyentuh tabel/elemen yang memiliki scrollbar horizontal aktif
      if (targetEl.scrollWidth > targetEl.clientWidth && 
         (targetEl.classList.contains('overflow-x-auto') || targetEl.classList.contains('overflow-x-scroll'))) {
        touchStartX = null;
        return;
      }
      targetEl = targetEl.parentElement;
    }

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (touchStartX === null || touchStartY === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const duration = Date.now() - touchStartTime;

    touchStartX = null;
    touchStartY = null;

    // Filter Kenyamanan & Keamanan Gerakan:
    // - Jarak geser horizontal minimal 65px
    // - Dominan horizontal: gerakan samping minimal 1.5x lebih besar dari gerakan atas/bawah (bukan scroll halaman)
    // - Durasi gesek cepat maksimal 600ms (bukan menahan/drag lambat)
    if (Math.abs(deltaX) >= 65 && Math.abs(deltaX) > 1.5 * Math.abs(deltaY) && duration <= 600) {
      const curIdx = TABS_ORDER.indexOf(currentActiveTab);
      if (curIdx === -1) return;

      if (deltaX < 0) {
        // Geser Kiri (Swipe Left) -> Pindah ke tab berikutnya
        if (curIdx + 1 < TABS_ORDER.length) {
          switchTab(TABS_ORDER[curIdx + 1]);
        }
      } else {
        // Geser Kanan (Swipe Right) -> Pindah ke tab sebelumnya
        if (curIdx - 1 >= 0) {
          switchTab(TABS_ORDER[curIdx - 1]);
        }
      }
    }
  }, { passive: true });
}
	
	// State navigation & filters
let dashboardSelectedMonth = `${curYear}-${curMonth}`;
let dashboardSelectedYear = curYear;
let analysisScope = 'month';
let trendMode = 'standard';
let trendScope = 'year';
let trendEntity = 'category';
let compareType = 'month';
let compareEntity = 'category';

let trendAccordionState = { source: false, category: true, class: false };
let trendShowAvg = true;
let trendShowBudget = true;
let trendClassChartType = 'bar';

let yearlyCatSort = { by: 'nominal', dir: 'desc' };
let monthlyCatSort = { by: 'nominal', dir: 'desc' };
let activeExpandedAnalysisCatId = null;

let settingAccountSortBy = 'default';
let settingAccountFilterType = 'ALL';
let settingCategorySortBy = 'default';
let settingCategoryFilterType = 'ALL';
let settingCategoryFilterClass = 'ALL';

let pendingRestoreData = null;
let activeCalendarTargetInputId = null;
let activeCalendarCallback = null;

// --- NAVIGATION BACKSTACK ANTI-LOOP ---
const allModalIds = [
  'transaction-modal',
  'account-modal',
  'category-modal',
  'budget-modal',
  'restore-confirm-modal',
  'export-options-modal',
  'analysis-export-modal',
  'export-preview-modal',
  'calendar-picker-modal',
  'sync-badge-modal',
  'sync-conflict-modal',
  'budget-history-modal',
  'applock-reset-modal',
  'budget-overrun-modal',
  'chart-drilldown-modal',
  'recurring-bill-modal',
  'recurring-conflict-modal',
  'import-tx-preview-modal',
  'import-cat-preview-modal',
  'custom-parameter-modal'
];

// Data Siklus Tagihan Berulang Berbasis Masa Berlaku Hari
let recurringBills = [];
const defaultRecurringBills = [
  { id: 'rec-1', name: 'Paket Data Telkomsel', amount: 100000, validityDays: 28, lastPaidDate: getLocalDateStr(new Date(Date.now() - 25 * 86400000)), categoryId: 'cat-2', subcategory: 'Internet WiFi', notify: true },
  { id: 'rec-2', name: 'Langganan Wi-Fi Rumah', amount: 350000, validityDays: 30, lastPaidDate: getLocalDateStr(new Date(Date.now() - 15 * 86400000)), categoryId: 'cat-2', subcategory: 'Internet WiFi', notify: true },
  { id: 'rec-3', name: 'Langganan Streaming Musik', amount: 55000, validityDays: 30, lastPaidDate: getLocalDateStr(new Date(Date.now() - 28 * 86400000)), categoryId: 'cat-4', subcategory: 'Langganan Streaming', notify: true }
];
	
	// Data Parameter Kustom Panduan Catatan Transaksi
let customParameters = [];
// Default parameter awal dengan satuan
const defaultCustomParameters = [
  {
    id: 'param-1',
    categoryId: 'cat-3',
    subcategory: 'Bensin',
    parameters: [
      { name: 'Harga/Liter', unit: 'Rp' },
      { name: 'SPBU', unit: '' },
      { name: 'Jarak Tempuh', unit: 'km' }
    ]
  }
];

let navStack = ['dashboard'];
let currentActiveTab = 'dashboard';
let suppressNextPopstate = false;

function sanitizeState() {
  try {
    accounts = JSON.parse(localStorage.getItem('vf_idr_accounts')) || defaultAccounts;
  } catch(e) { accounts = defaultAccounts; }
  if (!Array.isArray(accounts) || accounts.length === 0) accounts = JSON.parse(JSON.stringify(defaultAccounts));
  accounts.forEach((a, i) => {
    if (!a.id) a.id = 'acc-' + (i + 1);
    if (a.isHidden === undefined) a.isHidden = true;
    if (a.showOnDashboard === undefined) a.showOnDashboard = true;
    if (a.initialBalance === undefined) a.initialBalance = 0;
  });

  try {
    categories = JSON.parse(localStorage.getItem('vf_idr_categories')) || defaultCategories;
  } catch(e) { categories = defaultCategories; }
  if (!Array.isArray(categories) || categories.length === 0) categories = JSON.parse(JSON.stringify(defaultCategories));
  categories.forEach((c, i) => {
    if (!c.id) c.id = 'cat-' + (i + 1);
    if (!c.type) c.type = 'expense';
    if (!c.expenseClass) c.expenseClass = (c.type === 'income' ? 'fixed' : 'dynamic');
    if (!Array.isArray(c.subcategories)) c.subcategories = [];
    c.subcategories.sort((a, b) => a.localeCompare(b, 'id'));
  });

  try {
    transactions = JSON.parse(localStorage.getItem('vf_idr_transactions')) || defaultTransactions;
  } catch(e) { transactions = defaultTransactions; }
  if (!Array.isArray(transactions)) transactions = JSON.parse(JSON.stringify(defaultTransactions));
  transactions.forEach((t, i) => {
    if (!t.id) t.id = 'tx-' + (i + 1);
    t.amount = parseFloat(t.amount) || 0;
    t.adminFee = parseFloat(t.adminFee) || 0;
    t.date = t.date ? String(t.date).slice(0, 10) : getLocalDateStr();
    t.note = (t.note !== undefined && t.note !== null) ? String(t.note) : '';
    t.type = (t.type === 'income' || t.type === 'expense' || t.type === 'transfer') ? t.type : 'expense';
    if (!t.accountId || !accounts.some(a => a.id === t.accountId)) t.accountId = accounts[0].id;
    if (t.type === 'transfer') {
      if (!t.toAccountId || !accounts.some(a => a.id === t.toAccountId)) {
        t.toAccountId = accounts.find(a => a.id !== t.accountId)?.id || accounts[0].id;
      }
    } else {
      if (!t.categoryId || !categories.some(c => c.id === t.categoryId)) t.categoryId = categories[0].id;
    }
  });

  try {
    budgets = JSON.parse(localStorage.getItem('vf_idr_budgets')) || {};
  } catch(e) { budgets = {}; }

  try {
    budgetHistory = JSON.parse(localStorage.getItem('vf_budget_history')) || [];
  } catch(e) { budgetHistory = []; }

  try {
    backupConfig = JSON.parse(localStorage.getItem('vf_backup_config')) || defaultBackupConfig;
  } catch(e) { backupConfig = defaultBackupConfig; }

  try {
    backupSnapshots = JSON.parse(localStorage.getItem('vf_backup_snapshots')) || [];
  } catch(e) { backupSnapshots = []; }

  try {
    isNetWorthHidden = JSON.parse(localStorage.getItem('vf_nw_hidden')) ?? true;
  } catch(e) { isNetWorthHidden = true; }

  try {
    dashPrivacy = JSON.parse(localStorage.getItem('vf_dash_privacy')) || { income: true, expense: false, savings: true };
  } catch(e) { dashPrivacy = { income: true, expense: false, savings: true }; }

  try {
    txPreferences = JSON.parse(localStorage.getItem('vf_tx_prefs')) || defaultTxPreferences;
  } catch(e) { txPreferences = defaultTxPreferences; }
  if (!accounts.some(a => a.id === txPreferences.defaultAccountId)) txPreferences.defaultAccountId = accounts[0].id;
  if (!categories.some(c => c.id === txPreferences.defaultCategoryId)) txPreferences.defaultCategoryId = categories[0].id;

  try {
    fsBackupConfig = JSON.parse(localStorage.getItem('vf_fs_backup_config')) || defaultFsBackupConfig;
  } catch(e) { fsBackupConfig = defaultFsBackupConfig; }
	  
	  try {
    recurringBills = JSON.parse(localStorage.getItem('vf_recurring_bills')) || defaultRecurringBills;
  } catch(e) { recurringBills = defaultRecurringBills; }
  if (!Array.isArray(recurringBills)) recurringBills = JSON.parse(JSON.stringify(defaultRecurringBills));
  
  // Kunci setiap reminder agar memiliki ID unik, subkategori valid, dan siklus ternormalisasi
  recurringBills.forEach((r, idx) => {
    if (!r.id || r.id === 'undefined') r.id = 'rec-' + Date.now() + '-' + idx;
    if (!r.subcategory) {
      const cat = categories.find(c => c.id === r.categoryId);
      r.subcategory = (cat && cat.subcategories && cat.subcategories.length > 0) ? cat.subcategories[0] : '';
    }
    if (!r.lastPaidDate) r.lastPaidDate = getLocalDateStr();

    // Pastikan cycleType tersimpan benar ('days', 'monthly', atau 'yearly')
    if (!r.cycleType) {
      if (r.dueMonth && parseInt(r.dueMonth) > 0) r.cycleType = 'yearly';
      else if (r.dueDay && parseInt(r.dueDay) > 0) r.cycleType = 'monthly';
      else r.cycleType = 'days';
    }

    const parsedInterval = parseInt(r.cycleInterval);
    r.cycleInterval = (!isNaN(parsedInterval) && parsedInterval >= 1) ? parsedInterval : 1;

    if (r.cycleType === 'yearly') {
      r.validityDays = 0;
      const lpParts = String(r.lastPaidDate).split('-').map(Number);
      const parsedMonth = parseInt(r.dueMonth);
      const parsedDay = parseInt(r.dueDay);
      r.dueMonth = (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) ? parsedMonth : (lpParts[1] || (new Date().getMonth() + 1));
      r.dueDay = (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) ? parsedDay : (lpParts[2] || 25);
    } else if (r.cycleType === 'monthly') {
      r.validityDays = 0;
      r.dueMonth = 0;
      const parsedDay = parseInt(r.dueDay);
      r.dueDay = (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) ? parsedDay : 25;
    } else {
      r.cycleType = 'days';
      const parsedDays = parseInt(r.validityDays);
      r.validityDays = (!isNaN(parsedDays) && parsedDays >= 1) ? parsedDays : 28;
      r.dueDay = 0;
      r.dueMonth = 0;
      r.cycleInterval = 1;
    }

    if (r.notify === undefined) r.notify = true;
  });
	  
	  try {
    customParameters = JSON.parse(localStorage.getItem('vf_custom_parameters')) || defaultCustomParameters;
  } catch(e) { customParameters = defaultCustomParameters; }
  if (!Array.isArray(customParameters)) customParameters = JSON.parse(JSON.stringify(defaultCustomParameters));
  customParameters.forEach((cp, idx) => {
    if (!cp.id) cp.id = 'param-' + Date.now() + '-' + idx;
    if (!Array.isArray(cp.parameters)) cp.parameters = [];
  });
}

sanitizeState();

// --- MODAL UTILITIES ---
function openModal(id) { 
  closeMobileMenu();
	  const el = document.getElementById(id); 
  if (el) {
    el.classList.remove('hidden'); 
    history.pushState({ modalId: id }, '');
  }
}

function closeModal(id) {
  closeInAppNumpad();
  if (id === 'export-preview-modal' && typeof cleanupPendingExportPreviewUrl === 'function') {
    cleanupPendingExportPreviewUrl();
    if (typeof pendingExportPreviewState !== 'undefined') pendingExportPreviewState = null;
  }
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('hidden');
  }
  if (history.state && history.state.modalId === id) {
    suppressNextPopstate = true;
    history.back();
  }
}

function closeAllOpenModals() {
  closeMobileMenu();
  if (typeof cleanupPendingExportPreviewUrl === 'function') {
    cleanupPendingExportPreviewUrl();
    if (typeof pendingExportPreviewState !== 'undefined') pendingExportPreviewState = null;
  }
  allModalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) {
      el.classList.add('hidden');
    }
  });
}

// Tutup pop-up otomatis saat user mengklik area gelap (backdrop) di luar kartu pop-up
const BACKDROP_CLOSABLE_MODALS = new Set([
  ...allModalIds,
  'exit-confirm-modal',
  'app-dialog-modal'
]);

let lastModalBackdropPointerDown = null;

document.addEventListener('pointerdown', (e) => {
  const target = e.target;
  if (target && target.id && BACKDROP_CLOSABLE_MODALS.has(target.id)) {
    lastModalBackdropPointerDown = target;
  } else {
    lastModalBackdropPointerDown = null;
  }
}, true);

document.addEventListener('click', (e) => {
  const target = e.target;
  if (!target || !target.id || !BACKDROP_CLOSABLE_MODALS.has(target.id)) return;
  if (lastModalBackdropPointerDown !== target) return;
  lastModalBackdropPointerDown = null;

  if (target.id === 'export-preview-modal') {
    if (typeof closeExportPreviewModal === 'function') closeExportPreviewModal();
    else closeModal('export-preview-modal');
    return;
  }
  if (target.id === 'exit-confirm-modal') {
    if (typeof closeExitConfirmModal === 'function') closeExitConfirmModal();
    else target.classList.add('hidden');
    return;
  }
  if (target.id === 'app-dialog-modal') {
    const cancelBtn = document.getElementById('app-dialog-cancel');
    const okBtn = document.getElementById('app-dialog-ok');
    if (cancelBtn && !cancelBtn.classList.contains('hidden')) cancelBtn.click();
    else if (okBtn) okBtn.click();
    return;
  }
  closeModal(target.id);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    closeAllOpenModals();
  }
});

let isExitingApplication = false; // Pengaman agar popstate tidak mencegat saat tombol Ya Keluar ditekan

window.addEventListener('popstate', (e) => {
  if (isExitingApplication) return;

  if (suppressNextPopstate) {
    suppressNextPopstate = false;
    return;
  }

  // =========================================================================
  // PRIORITAS 0: JIKA KEYPAD VIRTUAL TERBUKA, TUTUP KEYPAD TERLEBIH DAHULU
  // =========================================================================
  const numpadEl = document.getElementById('global-inapp-numpad');
  if (numpadEl && !numpadEl.classList.contains('hidden')) {
    closeInAppNumpad(false); // Tutup numpad tanpa memundurkan history ganda
    return; // Selesai, formulir di bawahnya tetap aman terbuka
  }

  // =========================================================================
  // PRIORITAS 1: JIKA ADA MODAL POP-UP TERBUKA, TUTUP MODAL TERLEBIH DAHULU!
  // (Modal selalu menutup layar utama, jadi tombol Back harus menutup modal)
  // =========================================================================
  let modalWasClosed = false;
  allModalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) {
      el.classList.add('hidden');
      modalWasClosed = true;
    }
  });

  if (modalWasClosed) {
    closeInAppNumpad(false);
    closeMobileMenu();
    lucide.createIcons();
    return; // Formulir ditutup dengan benar via fungsi Back
  }

  // =========================================================================
  // PRIORITAS 2: JIKA MENU MOBILE TERBUKA (DAN TIDAK ADA MODAL)
  // =========================================================================
  const mobMenu = document.getElementById('mobile-menu');
  if (mobMenu && !mobMenu.classList.contains('hidden')) {
    closeMobileMenu();
    return;
  }

  // =========================================================================
  // PRIORITAS 3: JIKA POP-UP KONFIRMASI KELUAR SEDANG MUNCUL
  // =========================================================================
  const exitModalEl = document.getElementById('exit-confirm-modal');
  const isExitModalOpen = exitModalEl && !exitModalEl.classList.contains('hidden');
  if (isExitModalOpen) {
    closeExitConfirmModal();
    history.pushState({ tab: 'dashboard' }, '', '#app');
    return;
  }

  // =========================================================================
  // PRIORITAS 4: JIKA KEMBALI KE AKAR APLIKASI (DASHBOARD)
  // =========================================================================
  const isAtRoot = (!e.state || e.state.root || window.location.hash === '#root' || window.location.hash === '');
  if (isAtRoot) {
    history.pushState({ tab: 'dashboard' }, '', '#app');
    if (currentActiveTab !== 'dashboard') {
      switchTab('dashboard', true);
    }
    showExitConfirmModal();
    return;
  }

  // =========================================================================
  // PRIORITAS 5: NAVIGASI MUNDUR ANTAR TAB
  // =========================================================================
  if (e.state && e.state.tab) {
    switchTab(e.state.tab, true);
    return;
  }
});

// --- PRIVACY CONTROLS ---
function toggleAccountPrivacy(accId) {
  const acc = accounts.find(a => a.id === accId);
  if (acc) {
    acc.isHidden = !acc.isHidden;
    persistState(false);
    renderDashboard();
    renderSettings();
  }
}

function toggleAccountDashboardVisibility(accId) {
  const acc = accounts.find(a => a.id === accId);
  if (acc) {
    acc.showOnDashboard = !(acc.showOnDashboard ?? true);
    persistState(false);
    renderDashboard();
    renderSettings();
  }
}

function toggleNetWorthPrivacyFromSettings() {
  isNetWorthHidden = !isNetWorthHidden;
  localStorage.setItem('vf_nw_hidden', JSON.stringify(isNetWorthHidden));
  renderDashboard();
  renderSettings();
}

function toggleDashCardPrivacy(type) {
  if (dashPrivacy[type] !== undefined) {
    dashPrivacy[type] = !dashPrivacy[type];
    localStorage.setItem('vf_dash_privacy', JSON.stringify(dashPrivacy));
    renderDashboard();
    renderTransactions();
    renderAnalysisView();
  }
}

function updateDefaultTxPreferences() {
  const accSel = document.getElementById('pref-default-account');
  const catSel = document.getElementById('pref-default-category');
  if (accSel && catSel) {
    txPreferences.defaultAccountId = accSel.value;
    txPreferences.defaultCategoryId = catSel.value;
    localStorage.setItem('vf_tx_prefs', JSON.stringify(txPreferences));
  }
}

// --- REPOSITORY PERSISTENCE ---
function persistState(triggerAutoBackup = true) {
  const savePrimaryData = () => {
    localStorage.setItem('vf_idr_accounts', JSON.stringify(accounts));
    localStorage.setItem('vf_idr_categories', JSON.stringify(categories));
    localStorage.setItem('vf_idr_transactions', JSON.stringify(transactions));
    localStorage.setItem('vf_idr_budgets', JSON.stringify(budgets));
    localStorage.setItem('vf_budget_history', JSON.stringify(budgetHistory));
    localStorage.setItem('vf_backup_config', JSON.stringify(backupConfig));
    localStorage.setItem('vf_nw_hidden', JSON.stringify(isNetWorthHidden));
    localStorage.setItem('vf_dash_privacy', JSON.stringify(dashPrivacy));
    localStorage.setItem('vf_tx_prefs', JSON.stringify(txPreferences));
    localStorage.setItem('vf_fs_backup_config', JSON.stringify(fsBackupConfig));
    localStorage.setItem('vf_recurring_bills', JSON.stringify(recurringBills));
    localStorage.setItem('vf_custom_parameters', JSON.stringify(customParameters));
  };

  try {
    savePrimaryData();
    localStorage.setItem('vf_backup_snapshots', JSON.stringify(backupSnapshots));
  } catch (err) {
    // Jika kuota localStorage penuh karena snapshot menumpuk, pangkas snapshot lama agar data utama tetap tersimpan
    console.warn('localStorage penuh, memangkas snapshot lama:', err);
    while (backupSnapshots.length > 0) {
      backupSnapshots.pop();
      try {
        savePrimaryData();
        localStorage.setItem('vf_backup_snapshots', JSON.stringify(backupSnapshots));
        break;
      } catch (retryErr) {
        if (backupSnapshots.length === 0) {
          try {
            localStorage.removeItem('vf_backup_snapshots');
            savePrimaryData();
          } catch (finalErr) {
            console.error('Gagal menyimpan ke localStorage:', finalErr);
          }
        }
      }
    }
  }

  if (triggerAutoBackup) {
    if (backupConfig.frequency === 'on_change') {
      createSnapshot('Otomatis (Perubahan Data)', false);
    }
    scheduleFsAutoBackup();
    scheduleCloudAutoPush();
  }
}

// --- CHART INSTANCES ---
let pieChartInstance = null;
let dashYearlyChartInstance = null;
let sourceTrendChartInstance = null;
let trendsChartInstance = null;
let classTrendChartInstance = null;

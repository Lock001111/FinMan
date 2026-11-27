// ==================== Settings: Accounts & Categories Management ====================

// ==================== PENGATURAN (ACCOUNTS & CATEGORIES) ====================
function openAccountModal(editId = null) {
  if (editId) {
    const acc = accounts.find(a => a.id === editId);
    if (!acc) return;
    setText('acc-modal-title', 'Ubah Sumber Dana');
    setVal('acc-id', acc.id);
    setVal('acc-name', acc.name);
    setVal('acc-type', acc.type);
    setVal('acc-balance', formatNumberWithDots(acc.initialBalance));
    const chk = document.getElementById('acc-hidden-chk');
    if (chk) chk.checked = acc.isHidden ?? true;
    const chkDash = document.getElementById('acc-show-dash-chk');
    if (chkDash) chkDash.checked = acc.showOnDashboard ?? true;
  } else {
    setText('acc-modal-title', 'Tambah Sumber Dana');
    setVal('acc-id', '');
    setVal('acc-name', '');
    setVal('acc-type', 'Bank');
    setVal('acc-balance', '0');
    const chk = document.getElementById('acc-hidden-chk');
    if (chk) chk.checked = true;
    const chkDash = document.getElementById('acc-show-dash-chk');
    if (chkDash) chkDash.checked = true;
  }
  openModal('account-modal');
}

function saveAccount(e) {
  e.preventDefault();
  const id = document.getElementById('acc-id')?.value;
  let name = document.getElementById('acc-name')?.value?.trim();
  const type = document.getElementById('acc-type')?.value || 'Bank';
  const initialBalance = parseDotsNumber(document.getElementById('acc-balance')?.value);
  const isHidden = document.getElementById('acc-hidden-chk')?.checked ?? true;
  const showOnDashboard = document.getElementById('acc-show-dash-chk')?.checked ?? true;

  if (!name) return;

  if (id) {
    // Mode Edit: Simpan persis sesuai ketikan user
    const idx = accounts.findIndex(a => a.id === id);
    if (idx !== -1) accounts[idx] = { id, name, type, initialBalance, isHidden, showOnDashboard };
  } else {
    // Mode Baru: Terapkan Smart Title Case
    const formattedName = toSmartTitleCase(name);
    accounts.push({ id: 'acc-' + Date.now(), name: formattedName, type, initialBalance, isHidden, showOnDashboard });
  }

  persistState(true);
  closeModal('account-modal');
  renderAll();
}

async function deleteAccount(id) {
  if (await showAppConfirm('Hapus rekening ini? Transaksi yang terhubung ke rekening ini akan tetap ada.', 'Hapus Rekening')) {
    accounts = accounts.filter(a => a.id !== id);
    if (accounts.length === 0) accounts = JSON.parse(JSON.stringify(defaultAccounts));
    persistState(true);
    renderAll();
  }
}

function openCategoryModal(editId = null) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  if (editId) {
    const cat = categories.find(c => c.id === editId);
    if (!cat) return;
    setText('cat-modal-title', 'Ubah Kategori');
    setVal('cat-id', cat.id);
    setVal('cat-name', cat.name);
    setVal('cat-type', cat.type);
    setVal('cat-class', cat.expenseClass || 'dynamic');
    setVal('cat-subs', (cat.subcategories || []).join(', '));
  } else {
    setText('cat-modal-title', 'Tambah Kategori');
    setVal('cat-id', '');
    setVal('cat-name', '');
    setVal('cat-type', 'expense');
    setVal('cat-class', 'dynamic');
    setVal('cat-subs', '');
  }
  openModal('category-modal');
}

function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById('cat-id')?.value;
  let name = document.getElementById('cat-name')?.value?.trim();
  const type = document.getElementById('cat-type')?.value || 'expense';
  const expenseClass = document.getElementById('cat-class')?.value || 'dynamic';
  let subsRaw = document.getElementById('cat-subs')?.value || '';

  if (!name) return;

  if (id) {
    // Mode Edit: Biarkan subkategori dan nama persis seperti editan user
    const subcategories = subsRaw ? subsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const idx = categories.findIndex(c => c.id === id);
    if (idx !== -1) categories[idx] = { id, name, type, expenseClass, subcategories };
  } else {
    // Mode Baru: Terapkan Smart Title Case pada nama dan subkategori
    const formattedName = toSmartTitleCase(name);
    const formattedSubs = formatSubcategoriesSmartTitleCase(subsRaw);
    const subcategories = formattedSubs ? formattedSubs.split(',').map(s => s.trim()).filter(Boolean) : [];

    categories.push({ id: 'cat-' + Date.now(), name: formattedName, type, expenseClass, subcategories });
  }

  persistState(true);
  closeModal('category-modal');
  renderAll();
}

async function deleteCategory(id) {
  if (await showAppConfirm('Hapus kategori ini?', 'Hapus Kategori')) {
    categories = categories.filter(c => c.id !== id);
    if (categories.length === 0) categories = JSON.parse(JSON.stringify(defaultCategories));
    persistState(true);
    renderAll();
  }
}

function changeAccountSort(val) {
  settingAccountSortBy = val;
  renderSettings();
}

function changeAccountFilter(val) {
  settingAccountFilterType = val;
  renderSettings();
}

function changeCategorySort(val) {
  settingCategorySortBy = val;
  renderSettings();
}

function changeCategoryFilterType(val) {
  settingCategoryFilterType = val;
  renderSettings();
}

function changeCategoryFilterClass(val) {
  settingCategoryFilterClass = val;
  renderSettings();
}

function resetAccountFilterAndSort() {
  settingAccountFilterType = 'ALL';
  settingAccountSortBy = 'default';
  setVal('setting-account-filter-type', 'ALL');
  setVal('setting-account-sort', 'default');
  renderSettings();
}

function clearSettingCategorySearch() {
  setVal('setting-category-search-input', '');
  const clearBtn = document.getElementById('setting-category-search-clear');
  if (clearBtn) clearBtn.classList.add('hidden');
  const searchInput = document.getElementById('setting-category-search-input');
  if (searchInput) searchInput.focus();
  renderSettings();
}

function resetCategoryFilterAndSort() {
  // 1. Kosongkan teks di search box
  setVal('setting-category-search-input', '');
  const clearBtn = document.getElementById('setting-category-search-clear');
  if (clearBtn) clearBtn.classList.add('hidden');

  // 2. Kembalikan filter tipe, klasifikasi, dan urutan ke awal
  settingCategoryFilterType = 'ALL';
  settingCategoryFilterClass = 'ALL';
  settingCategorySortBy = 'default';
  setVal('setting-category-filter-type', 'ALL');
  setVal('setting-category-filter-class', 'ALL');
  setVal('setting-category-sort', 'default');

  renderSettings();
}

function renderSettings() {
  const nwBtn = document.getElementById('btn-settings-nw-toggle');
  if (nwBtn) {
    if (isNetWorthHidden) {
      nwBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100';
      nwBtn.innerHTML = `<i data-lucide="eye-off" class="w-3.5 h-3.5"></i> Status: Disamarkan (Rp ••••••)`;
    } else {
      nwBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';
      nwBtn.innerHTML = `<i data-lucide="eye" class="w-3.5 h-3.5"></i> Status: Terlihat Terbuka`;
    }
  }

  let displayAccounts = [...accounts];
  if (settingAccountFilterType !== 'ALL') {
    displayAccounts = displayAccounts.filter(a => a.type === settingAccountFilterType);
  }
  if (settingAccountSortBy === 'name-asc') {
    displayAccounts.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  } else if (settingAccountSortBy === 'name-desc') {
    displayAccounts.sort((a, b) => b.name.localeCompare(a.name, 'id'));
  } else if (settingAccountSortBy === 'type-asc') {
    displayAccounts.sort((a, b) => a.type.localeCompare(b.type, 'id') || a.name.localeCompare(b.name, 'id'));
  }

  const accList = document.getElementById('accounts-settings-list');
  if (accList) {
    if (displayAccounts.length === 0) {
      accList.innerHTML = `<div class="col-span-full py-6 text-center text-xs text-slate-400">Tidak ada rekening yang sesuai dengan filter jenis.</div>`;
    } else {
      accList.innerHTML = displayAccounts.map(a => {
        const isHidden = a.isHidden ?? true;
        const isShownOnDash = a.showOnDashboard ?? true;
        return `
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">${escapeHtml(a.type)}</span>
                  <h4 class="font-bold text-slate-800 text-sm sm:text-base truncate">${escapeHtml(a.name)}</h4>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${isShownOnDash ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
                  ${isShownOnDash ? 'Di Dashboard' : 'Tersembunyi'}
                </span>
              </div>
              <div class="text-xs text-slate-500 mt-1.5">
                <span>Saldo Awal: <strong class="text-slate-700">${isHidden ? 'Rp ••••••' : formatCurrency(a.initialBalance)}</strong></span>
              </div>
            </div>
            <div class="flex items-center justify-end gap-1.5 pt-2.5 border-t border-slate-200/70">
              <button type="button" onclick="toggleAccountDashboardVisibility('${a.id}')" data-tooltip="${isShownOnDash ? 'Sembunyikan rekening dari Dashboard' : 'Tampilkan rekening di Dashboard'}" aria-label="${isShownOnDash ? 'Sembunyikan rekening dari Dashboard' : 'Tampilkan rekening di Dashboard'}" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border transition shrink-0 ${isShownOnDash ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600'}">
                <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
              </button>
              <button type="button" onclick="toggleAccountPrivacy('${a.id}')" data-tooltip="${isHidden ? 'Tampilkan saldo rekening' : 'Sembunyikan (samarkan) saldo rekening'}" aria-label="${isHidden ? 'Tampilkan saldo rekening' : 'Sembunyikan saldo rekening'}" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border transition shrink-0 ${isHidden ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}">
                <i data-lucide="${isHidden ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>
              </button>
              <button type="button" onclick="openAccountModal('${a.id}')" data-tooltip="Ubah data rekening" aria-label="Ubah data rekening" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button type="button" onclick="deleteAccount('${a.id}')" data-tooltip="Hapus rekening" aria-label="Hapus rekening" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shrink-0">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const accCountEl = document.getElementById('setting-account-count');
  if (accCountEl) {
    accCountEl.textContent = `Menampilkan ${displayAccounts.length} rekening`;
  }

  // Filter Kategori di Pengaturan
  let displayCategories = [...categories];
  if (settingCategoryFilterType !== 'ALL') {
    displayCategories = displayCategories.filter(c => c.type === settingCategoryFilterType);
  }
  if (settingCategoryFilterClass !== 'ALL') {
    displayCategories = displayCategories.filter(c => (c.expenseClass || 'dynamic') === settingCategoryFilterClass);
  }

  // =========================================================================
  // PENCARIAN REAL-TIME KATEGORI & SUBKATEGORI
  // =========================================================================
  const searchInput = document.getElementById('setting-category-search-input');
  const searchQuery = (searchInput?.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('setting-category-search-clear');
  if (clearBtn) {
    if (searchQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  if (searchQuery) {
    displayCategories = displayCategories.filter(c => {
      const matchCat = c.name.toLowerCase().includes(searchQuery);
      const matchSub = (c.subcategories || []).some(s => s.toLowerCase().includes(searchQuery));
      return matchCat || matchSub;
    });
  }
  // =========================================================================

  if (settingCategorySortBy === 'name-asc') {
    displayCategories.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  } else if (settingCategorySortBy === 'name-desc') {
    displayCategories.sort((a, b) => b.name.localeCompare(a.name, 'id'));
  } else if (settingCategorySortBy === 'class-fixed') {
    const order = { 'fixed': 1, 'periodic': 2, 'dynamic': 3 };
    displayCategories.sort((a, b) => (order[a.expenseClass || 'dynamic'] - order[b.expenseClass || 'dynamic']) || a.name.localeCompare(b.name, 'id'));
  } else if (settingCategorySortBy === 'class-dynamic') {
    const order = { 'dynamic': 1, 'periodic': 2, 'fixed': 3 };
    displayCategories.sort((a, b) => (order[a.expenseClass || 'dynamic'] - order[b.expenseClass || 'dynamic']) || a.name.localeCompare(b.name, 'id'));
  }

  const catList = document.getElementById('category-settings-list');
  if (catList) {
    if (displayCategories.length === 0) {
      if (searchQuery) {
        catList.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-400">Tidak ada kategori atau subkategori yang cocok dengan pencarian "<strong>${escapeHtml(searchQuery)}</strong>".</div>`;
      } else {
        catList.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-400">Tidak ada kategori yang sesuai dengan filter.</div>`;
      }
    } else {
      catList.innerHTML = displayCategories.map(c => {
        let classLabel = 'Dinamis';
        let classBadge = 'bg-slate-100 text-slate-700';
        if (c.expenseClass === 'fixed') {
          classLabel = 'Tetap (Fixed)';
          classBadge = 'bg-indigo-100 text-indigo-800';
        } else if (c.expenseClass === 'periodic') {
          classLabel = 'Berkala (Periodic)';
          classBadge = 'bg-amber-100 text-amber-800';
        }

        const sortedSubs = [...(c.subcategories || [])].sort((a, b) => a.localeCompare(b, 'id'));

        return `
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
            <div>
              <div class="flex items-start justify-between gap-2 mb-1.5">
                <h4 class="font-bold text-slate-800 text-sm min-w-0 break-words">${escapeHtml(c.name)}</h4>
                <div class="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${classBadge}">${classLabel}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${c.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                  </span>
                </div>
              </div>
              <div class="flex flex-wrap gap-1 mt-2">
                ${sortedSubs.length > 0 
                  ? sortedSubs.map(sub => `<span class="text-[11px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">${escapeHtml(sub)}</span>`).join('') 
                  : `<span class="text-xs text-slate-400 italic">Belum ada subkategori</span>`}
              </div>
            </div>
            <div class="flex items-center justify-end gap-1.5 mt-3 pt-2.5 border-t border-slate-200/70">
              <button type="button" onclick="openCategoryModal('${c.id}')" data-tooltip="Ubah kategori" aria-label="Ubah kategori" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button type="button" onclick="deleteCategory('${c.id}')" data-tooltip="Hapus kategori" aria-label="Hapus kategori" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shrink-0">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const catCountEl = document.getElementById('setting-category-count');
  if (catCountEl) {
    catCountEl.textContent = `Menampilkan ${displayCategories.length} kategori`;
  }

  // Perbarui badge jumlah total kategori pada header
  const headerBadge = document.getElementById('badge-cat-count-header');
  if (headerBadge) {
    headerBadge.textContent = `${categories.length} Kategori`;
  }
	  
	  // Perbarui badge jumlah rekening di header
	  const accHeaderBadge = document.getElementById('badge-acc-count-header');
  if (accHeaderBadge) {
    accHeaderBadge.textContent = `${accounts.length} Akun`;
  }

  // Terapkan status buka/tutup (collapse) yang tersimpan
	  applySettingAccountCollapseUI();
  applySettingCategoryCollapseUI();
	  applyRecurringCollapseUI();
	  applyCustomParamCollapseUI();
	  applySettingBackupCollapseUI();
	  
	  // Render daftar pengingat tagihan di pengaturan
  renderRecurringBillsWidget();
	  renderCustomParameters();
  renderBackupSettingsView();
  lucide.createIcons();
}
	
	// ==================== FITUR BUKA/TUTUP (COLLAPSE) SERAGAM DI PENGATURAN ====================
let isSettingAccountCollapsed = JSON.parse(localStorage.getItem('vf_setting_acc_collapsed') || 'false');
let isSettingBackupCollapsed = JSON.parse(localStorage.getItem('vf_setting_backup_collapsed') || 'false');

function toggleSettingAccountCollapse() {
  isSettingAccountCollapsed = !isSettingAccountCollapsed;
  localStorage.setItem('vf_setting_acc_collapsed', JSON.stringify(isSettingAccountCollapsed));
  applySettingAccountCollapseUI();
}

function applySettingAccountCollapseUI() {
  const body = document.getElementById('setting-account-body');
  const icon = document.getElementById('icon-chevron-acc-setting');
  if (!body) return;

  if (isSettingAccountCollapsed) {
    body.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    body.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }
  lucide.createIcons();
}

function toggleSettingBackupCollapse() {
  isSettingBackupCollapsed = !isSettingBackupCollapsed;
  localStorage.setItem('vf_setting_backup_collapsed', JSON.stringify(isSettingBackupCollapsed));
  applySettingBackupCollapseUI();
}

function applySettingBackupCollapseUI() {
  const body = document.getElementById('setting-backup-body');
  const icon = document.getElementById('icon-chevron-backup-setting');
  if (!body) return;

  if (isSettingBackupCollapsed) {
    body.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    body.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }
  lucide.createIcons();
}
	

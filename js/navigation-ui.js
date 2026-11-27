// ==================== Dropdown Selectors, Mobile Menu & Tab Navigation ====================

// ==================== DROPDOWN & FORM SELECTORS ====================
function populateDropdowns() {
  const txAccSelect = document.getElementById('tx-account');
  const prefAcc = document.getElementById('pref-default-account');

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const accOptions = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(a.type)})</option>`).join('');
  
  // Dropdown rekening pada form transaksi baru
  if (txAccSelect) txAccSelect.innerHTML = accOptions;

  // Dropdown preferensi akun di pengaturan
  if (prefAcc) {
    prefAcc.innerHTML = accOptions;
    prefAcc.value = accounts.some(a => a.id === txPreferences.defaultAccountId) ? txPreferences.defaultAccountId : (accounts[0]?.id || '');
  }

  // 1. Masukkan opsi rekening ke data dropdown pencarian transaksi
  searchableFilterData['filter-account'] = [
    { value: 'ALL', label: 'Semua Rekening' },
    ...sortedAccounts.map(a => ({ value: a.id, label: a.name }))
  ];
  const curAcc = document.getElementById('filter-account')?.value || 'ALL';
  const accOpt = searchableFilterData['filter-account'].find(o => o.value === curAcc) || searchableFilterData['filter-account'][0];
  const accLbl = document.getElementById('label-filter-account');
  if (accLbl) accLbl.textContent = accOpt.label;

  // 2. Perbarui opsi Kategori & Subkategori transaksi riil
  updateDynamicTransactionFilters();

  // =======================================================================
  // 3. POIN NOMOR 2: PENGISIAN SEARCHABLE KATEGORI TREN
  // =======================================================================
  const expenseCatsSorted = categories.filter(c => c.type === 'expense').sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const trendCatOptions = [
    { value: 'ALL', label: 'Semua Kategori' },
    ...expenseCatsSorted.map(c => ({ value: c.id, label: c.name }))
  ];
  searchableFilterData['trend-category-filter'] = trendCatOptions;

  const curTrendCatInput = document.getElementById('trend-category-filter');
  let curTrendCatVal = curTrendCatInput ? curTrendCatInput.value : 'ALL';
  if (curTrendCatVal !== 'ALL' && !expenseCatsSorted.some(c => c.id === curTrendCatVal)) {
    curTrendCatVal = 'ALL';
    if (curTrendCatInput) curTrendCatInput.value = 'ALL';
  }
  const optTrendCat = trendCatOptions.find(o => o.value === curTrendCatVal) || trendCatOptions[0];
  const labelTrendCat = document.getElementById('label-trend-category-filter');
  if (labelTrendCat) labelTrendCat.textContent = optTrendCat.label;

  updateTrendSubcategoryDropdown();
  // =======================================================================

  // Dropdown preferensi kategori di menu Pengaturan
  const prefCat = document.getElementById('pref-default-category');
  if (prefCat) {
    const sortedAllCats = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'id'));
    prefCat.innerHTML = sortedAllCats.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})</option>`).join('');
    prefCat.value = categories.some(c => c.id === txPreferences.defaultCategoryId) ? txPreferences.defaultCategoryId : (categories[0]?.id || '');
  }

  // Dropdown kategori di modal Limit Anggaran
  const budgetCatSelect = document.getElementById('budget-cat-select');
  if (budgetCatSelect) {
    budgetCatSelect.innerHTML = expenseCatsSorted.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  // Dropdown sumber dana di menu Tren
  const trendSourceSelect = document.getElementById('trend-source-select');
  if (trendSourceSelect) {
    trendSourceSelect.innerHTML = `<option value="ALL">Semua Rekening (Tampilkan Semua)</option>` + 
      sortedAccounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(a.type)})</option>`).join('');
  }

  onTxTypeChange();
}

function onTxTypeChange() {
  const typeRadio = document.querySelector('input[name="tx-type"]:checked');
  if (!typeRadio) return;
  const type = typeRadio.value;

  const catSubcatWrap = document.getElementById('tx-cat-subcat-wrap');
  const destWrap = document.getElementById('tx-transfer-dest-wrap');
  const accLabel = document.getElementById('tx-account-label');
  const toAccSelect = document.getElementById('tx-to-account');
  const txAccSelect = document.getElementById('tx-account');

  if (type === 'transfer') {
    if (catSubcatWrap) catSubcatWrap.classList.add('hidden');
    if (destWrap) destWrap.classList.remove('hidden');
    if (accLabel) accLabel.textContent = 'Rekening Asal (Dari)';

    if (toAccSelect && txAccSelect) {
      const fromAccId = txAccSelect.value;
      toAccSelect.innerHTML = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(a.type)})</option>`).join('');
      const altAcc = accounts.find(a => a.id !== fromAccId);
      if (altAcc) toAccSelect.value = altAcc.id;
    }
  } else {
    if (catSubcatWrap) catSubcatWrap.classList.remove('hidden');
    if (destWrap) destWrap.classList.add('hidden');
    if (accLabel) accLabel.textContent = 'Sumber Dana';

    const txCatSelect = document.getElementById('tx-category');
    if (txCatSelect) {
      const filtered = categories
        .filter(c => c.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));
      txCatSelect.innerHTML = filtered.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }
    populateSubcategoriesDropdown();
  }
}

function populateSubcategoriesDropdown() {
  const catId = document.getElementById('tx-category')?.value;
  const subSelect = document.getElementById('tx-subcategory');
  if (!subSelect) return;
  const cat = categories.find(c => c.id === catId);
  if (cat && cat.subcategories && cat.subcategories.length > 0) {
    const sorted = [...cat.subcategories].sort((a, b) => a.localeCompare(b, 'id'));
    subSelect.innerHTML = `<option value="">Tanpa Subkategori</option>` + sorted.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  } else {
    subSelect.innerHTML = `<option value="">Tanpa Subkategori</option>`;
  }
	  updateTxCustomParameterFields();
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('mobile-menu-icon');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'x');
  } else {
    menu.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'menu');
  }
  lucide.createIcons();
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('mobile-menu-icon');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'menu');
    lucide.createIcons();
  }
}

function switchTab(tabName, isBackNavigation = false) {
  if (!tabName) tabName = 'dashboard';
  if (currentActiveTab === tabName && !isBackNavigation) return;
	  
	  // AUTO-RESET: Jika sedang meninggalkan menu Transaksi yang dibuka dari grafik, bersihkan filter
  if (isDrillDownFilter && currentActiveTab === 'transactions' && tabName !== 'transactions') {
    resetDrillDownFilter();
  }

  // 1. Simpan posisi scroll menu saat ini sebelum berpindah
  if (currentActiveTab && tabScrollPositions.hasOwnProperty(currentActiveTab)) {
    tabScrollPositions[currentActiveTab] = window.scrollY || document.documentElement.scrollTop || 0;
  }

  // Upload instan jika ada pending data lokal
  flushPendingCloudPush();

  if (!isBackNavigation) {
    const targetHash = (tabName === 'dashboard') ? '#app' : '#' + tabName;
    history.pushState({ tab: tabName }, '', targetHash);
  }

  currentActiveTab = tabName;

  const tabs = ['dashboard', 'transactions', 'analysis', 'budgets', 'trends', 'settings'];
  tabs.forEach(t => {
    const viewEl = document.getElementById(`view-${t}`);
    const btnEl = document.getElementById(`tab-${t}`);
    const mobBtnEl = document.getElementById(`mob-tab-${t}`);

    if (viewEl) viewEl.classList.add('hidden');

    if (btnEl) {
      btnEl.classList.remove('text-emerald-700', 'bg-emerald-50');
      btnEl.classList.add('text-slate-600');
    }
    if (mobBtnEl) {
      mobBtnEl.classList.remove('text-emerald-700', 'bg-emerald-50');
      mobBtnEl.classList.add('text-slate-600');
    }
  });

  const activeView = document.getElementById(`view-${tabName}`);
  const activeBtn = document.getElementById(`tab-${tabName}`);
  const activeMobBtn = document.getElementById(`mob-tab-${tabName}`);

  if (activeView) activeView.classList.remove('hidden');

  if (activeBtn) {
    activeBtn.classList.add('text-emerald-700', 'bg-emerald-50');
    activeBtn.classList.remove('text-slate-600');
  }
  if (activeMobBtn) {
    activeMobBtn.classList.add('text-emerald-700', 'bg-emerald-50');
    activeMobBtn.classList.remove('text-slate-600');
  }

  closeMobileMenu();

  // Render dan sinkronisasi tab transaksi
  if (tabName === 'transactions') {
    renderTransactions();
    if (navigator.onLine && isGdriveSessionActive()) {
      autoPullFromCloud();
    }
  }

  if (tabName === 'analysis') {
    renderAnalysisView();
    setTimeout(syncHabitTrackerHeight, 100);
  }
  if (tabName === 'trends') {
    if (trendAccordionState.source) renderSourceTrendChart();
    if (trendAccordionState.category) renderTrendsChart();
    if (trendAccordionState.class) renderClassTrendChart();
  }
  if (tabName === 'budgets') renderBudgets();
  if (tabName === 'dashboard') {
    renderDashboard();
    renderDashboardYearlyChart();
  }
  lucide.createIcons();

  // 2. Kembalikan posisi scroll menu tujuan (instan tanpa animasi jump)
  const targetScroll = tabScrollPositions[tabName] || 0;
  window.scrollTo(0, targetScroll);
  requestAnimationFrame(() => {
    window.scrollTo(0, targetScroll);
  });
}
	

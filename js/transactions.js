// ==================== Transactions View, Filters, Pagination, Searchable Select & CRUD ====================

// ==================== TRANSACTIONS VIEW ====================
	function togglePeriodFilter() {
  const isAllTime = document.getElementById('filter-all-time')?.checked;
  const monthWrapper = document.getElementById('month-selector-wrapper');
  if (monthWrapper) {
    if (isAllTime) monthWrapper.classList.add('opacity-40', 'pointer-events-none');
    else monthWrapper.classList.remove('opacity-40', 'pointer-events-none');
  }
  allTimeCurrentPage = 1;
  updateDynamicTransactionFilters();
  renderTransactions();
}

function stepFilterMonth(step) {
  const input = document.getElementById('filter-month');
  if (!input || !input.value) return;
  const parts = input.value.split('-').map(Number);
  const d = new Date(parts[0] || curYear, (parts[1] || 1) - 1 + step, 1);
  input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  allTimeCurrentPage = 1;
  updateDynamicTransactionFilters();
  renderTransactions();
}

function resetTransactionFilterToCurrent() {
  const chk = document.getElementById('filter-all-time');
  if (chk) chk.checked = false;
  togglePeriodFilter();
  setVal('filter-month', `${curYear}-${curMonth}`);
  allTimeCurrentPage = 1;
  updateDynamicTransactionFilters();
  renderTransactions();
}

function resetTransactionFilters() {
  setVal('filter-search', '');
  setVal('filter-amount-op', 'ALL');
  setVal('filter-amount-val', '');

  // Reset semua searchable dropdown ke nilai 'ALL'
  const filterKeys = ['filter-account', 'filter-category', 'filter-subcategory', 'filter-type', 'filter-expense-class'];
  filterKeys.forEach(k => {
    const hiddenInput = document.getElementById(k);
    if (hiddenInput) hiddenInput.value = 'ALL';
    const labelEl = document.getElementById('label-' + k);
    const opt = (searchableFilterData[k] || []).find(o => o.value === 'ALL');
    if (labelEl && opt) labelEl.textContent = opt.label;
  });

  allTimeCurrentPage = 1;
  updateDynamicTransactionFilters();
  renderTransactions();
}
	
	// ==================== STATE PAGINASI SEMUA WAKTU ====================
let allTimeCurrentPage = 1;
let allTimePageSize = 25; // Pilihan: 25, 50, 100

// Data opsi dropdown pencarian
const searchableFilterData = {
  'filter-account': [],
  'filter-category': [],
  'filter-subcategory': [],
  'filter-type': [
    { value: 'ALL', label: 'Semua Tipe' },
    { value: 'expense', label: 'Pengeluaran' },
    { value: 'income', label: 'Pemasukan' },
    { value: 'transfer', label: 'Transfer' }
  ],
  'filter-expense-class': [
    { value: 'ALL', label: 'Semua Klasifikasi' },
    { value: 'fixed', label: 'Tetap (Fixed)' },
    { value: 'periodic', label: 'Berkala (Periodic)' },
    { value: 'dynamic', label: 'Dinamis (Dynamic)' }
  ],
  'trend-category-filter': [],
  'trend-subcategory-filter': []
};

// ==================== MESIN SEARCHABLE DROPDOWN ====================
function toggleSearchableDropdown(filterId, event) {
  if (event) event.stopPropagation();

  // 1. Tutup dropdown lain yang sedang terbuka
  const allFilterKeys = [
    'filter-account', 'filter-category', 'filter-subcategory', 'filter-type', 'filter-expense-class',
    'trend-category-filter', 'trend-subcategory-filter'
  ];
  allFilterKeys.forEach(k => {
    if (k !== filterId) {
      const d = document.getElementById('dropdown-' + k);
      if (d) d.classList.add('hidden');
    }
  });

  const dropdown = document.getElementById('dropdown-' + filterId);
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  if (isHidden) {
    dropdown.classList.remove('hidden');

    // =========================================================================
    // SMART AUTO-ALIGN TEPI KANAN (MENCEGAH DROPDOWN TERPOTONG BORDER)
    // =========================================================================
    // Reset posisi awal ke left-0 untuk mengukur posisi alaminya
    dropdown.classList.remove('right-0');
    dropdown.classList.add('left-0');

    // Hitung batas maksimal tepi kanan (border kartu atau tepi layar HP)
    const wrap = document.getElementById('wrap-' + filterId);
    const parentCard = wrap ? (wrap.closest('.bg-white') || wrap.closest('.searchable-filter-wrap')) : null;
    const boxRight = parentCard ? parentCard.getBoundingClientRect().right : window.innerWidth;
    const boundaryLimit = Math.min(window.innerWidth - 14, boxRight - 10);

    // Ukur posisi dropdown
    const rect = dropdown.getBoundingClientRect();
    if (rect.right > boundaryLimit) {
      // Jika menabrak atau mepet batas kanan, tempelkan ke kanan (right-0) agar melebar ke arah kiri
      dropdown.classList.remove('left-0');
      dropdown.classList.add('right-0');
    }
    // =========================================================================

    const searchInput = document.getElementById('input-search-' + filterId);
    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 60);
    }
    renderSearchableDropdownList(filterId, '');
    lucide.createIcons();
  } else {
    dropdown.classList.add('hidden');
  }
}

function onSearchableDropdownInput(filterId) {
  const searchInput = document.getElementById('input-search-' + filterId);
  const query = (searchInput?.value || '').trim();
  renderSearchableDropdownList(filterId, query);
}

function onSearchableDropdownKeydown(filterId, event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const listContainer = document.getElementById('list-' + filterId);
    const firstBtn = listContainer?.querySelector('button');
    if (firstBtn) firstBtn.click();
  }
}

function renderSearchableDropdownList(filterId, query = '') {
  const listContainer = document.getElementById('list-' + filterId);
  if (!listContainer) return;

  const currentVal = document.getElementById(filterId)?.value || 'ALL';
  const items = searchableFilterData[filterId] || [];
  const q = query.toLowerCase();

  // Filter pintar: utamakan yang diawali huruf/kata yang diketik, lalu yang mengandung kata
  let matchedItems = items;
  if (q) {
    matchedItems = items.filter(item => {
      const lbl = item.label.toLowerCase();
      const val = item.value.toLowerCase();
      return lbl.includes(q) || val.includes(q);
    });

    matchedItems.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.label.localeCompare(b.label, 'id');
    });
  }

  if (matchedItems.length === 0) {
    listContainer.innerHTML = `<div class="p-2.5 text-center text-slate-400 italic text-[11px]">Tidak ada pilihan cocok</div>`;
    return;
  }

  listContainer.innerHTML = matchedItems.map(item => {
    const isSelected = (item.value === currentVal);
    return `
      <button type="button" onclick="selectSearchableOption('${filterId}', '${escapeHtml(item.value)}', '${escapeHtml(item.label)}')" class="w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between text-xs ${isSelected ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-100 text-slate-700 font-medium'}">
        <span class="truncate">${escapeHtml(item.label)}</span>
        ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1"></i>' : ''}
      </button>
    `;
  }).join('');
  lucide.createIcons();
}

function selectSearchableOption(filterId, value, label) {
  const hiddenInput = document.getElementById(filterId);
  if (hiddenInput) hiddenInput.value = value;

  const labelEl = document.getElementById('label-' + filterId);
  if (labelEl) labelEl.textContent = label;

  const dropdown = document.getElementById('dropdown-' + filterId);
  if (dropdown) dropdown.classList.add('hidden');

  // Panggil aksi sesuai filter yang dipilih
  if (filterId === 'filter-category') {
    onFilterCategoryChange();
  } else if (filterId === 'trend-category-filter') {
    onTrendCategoryFilterChange();
  } else if (filterId === 'trend-subcategory-filter') {
    renderTrendsChart();
  } else {
    allTimeCurrentPage = 1;
    renderTransactions();
  }
}

// Tutup dropdown searchable jika user mengklik area lain
// Listener klik di luar area dropdown untuk menutup otomatis
document.addEventListener('click', (e) => {
  const allFilterKeys = [
    'filter-account', 'filter-category', 'filter-subcategory', 'filter-type', 'filter-expense-class',
    'trend-category-filter', 'trend-subcategory-filter'
  ];
  allFilterKeys.forEach(k => {
    const wrap = document.getElementById('wrap-' + k);
    const dropdown = document.getElementById('dropdown-' + k);
    if (wrap && dropdown && !wrap.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
});

// Memperbarui pilihan filter agar HANYA menampilkan kategori/subkategori yang ada pada transaksi periode terpilih
function updateDynamicTransactionFilters() {
  const isAllTime = document.getElementById('filter-all-time')?.checked;
  const selectedMonth = document.getElementById('filter-month')?.value;

  // 1. Ambil seluruh transaksi pada periode aktif
  const periodTxs = transactions.filter(tx => {
    if (!isAllTime && selectedMonth && tx.date && !tx.date.startsWith(selectedMonth)) return false;
    return true;
  });

  // 2. Kategori yang ADA pada transaksi periode ini
  const catNamesSet = new Set();
  periodTxs.forEach(tx => {
    if (tx.type !== 'transfer' && tx.categoryId) {
      const c = categories.find(cat => cat.id === tx.categoryId);
      if (c && c.name && c.name.trim()) catNamesSet.add(c.name.trim());
    }
  });

  const sortedCatNames = Array.from(catNamesSet).sort((a, b) => a.localeCompare(b, 'id'));
  searchableFilterData['filter-category'] = [
    { value: 'ALL', label: 'Semua Kategori' },
    ...sortedCatNames.map(name => ({ value: name, label: name }))
  ];

  // Jika kategori yang sedang aktif tidak ada di transaksi periode ini, kembalikan ke 'ALL'
  const curCatInput = document.getElementById('filter-category');
  let curCatVal = curCatInput ? curCatInput.value : 'ALL';
  if (curCatVal !== 'ALL' && !catNamesSet.has(curCatVal)) {
    curCatVal = 'ALL';
    if (curCatInput) curCatInput.value = 'ALL';
  }
  const curCatOpt = searchableFilterData['filter-category'].find(o => o.value === curCatVal) || searchableFilterData['filter-category'][0];
  const labelCat = document.getElementById('label-filter-category');
  if (labelCat) labelCat.textContent = curCatOpt.label;

  // 3. Subkategori yang ADA pada transaksi periode & kategori aktif
  const subNamesSet = new Set();
  periodTxs.forEach(tx => {
    if (tx.type !== 'transfer' && tx.subcategory && tx.subcategory.trim()) {
      if (curCatVal === 'ALL') {
        subNamesSet.add(tx.subcategory.trim());
      } else {
        const c = categories.find(cat => cat.id === tx.categoryId);
        if (c && c.name && c.name.trim().toLowerCase() === curCatVal.trim().toLowerCase()) {
          subNamesSet.add(tx.subcategory.trim());
        }
      }
    }
  });

  const sortedSubNames = Array.from(subNamesSet).sort((a, b) => a.localeCompare(b, 'id'));
  const subAllLabel = (curCatVal === 'ALL') ? 'Semua Subkategori' : `Semua Subkategori (${curCatVal})`;
  searchableFilterData['filter-subcategory'] = [
    { value: 'ALL', label: subAllLabel },
    ...sortedSubNames.map(name => ({ value: name, label: name }))
  ];

  // Jika subkategori aktif tidak ada di list baru, kembalikan ke 'ALL'
  const curSubInput = document.getElementById('filter-subcategory');
  let curSubVal = curSubInput ? curSubInput.value : 'ALL';
  if (curSubVal !== 'ALL' && !subNamesSet.has(curSubVal)) {
    curSubVal = 'ALL';
    if (curSubInput) curSubInput.value = 'ALL';
  }
  const curSubOpt = searchableFilterData['filter-subcategory'].find(o => o.value === curSubVal) || searchableFilterData['filter-subcategory'][0];
  const labelSub = document.getElementById('label-filter-subcategory');
  if (labelSub) labelSub.textContent = curSubOpt.label;
}

function onFilterCategoryChange() {
  allTimeCurrentPage = 1;
  updateDynamicTransactionFilters();
  renderTransactions();
}
	
	// ==================== INTERACTIVE CHART DRILL-DOWN ====================
let isDrillDownFilter = false;
	let drillDownSpecificDate = null;

function drillDownToTransactions(params) {
  isDrillDownFilter = true;

  const chkAllTime = document.getElementById('filter-all-time');
  if (chkAllTime) chkAllTime.checked = false;
  const monthWrapper = document.getElementById('month-selector-wrapper');
  if (monthWrapper) monthWrapper.classList.remove('opacity-40', 'pointer-events-none');

  // 1. Simpan tanggal spesifik jika dipicu dari Kalender
  if (params.date) {
    drillDownSpecificDate = params.date;
    setVal('filter-month', params.date.substring(0, 7));
  } else {
    drillDownSpecificDate = null;
    if (params.month) {
      setVal('filter-month', params.month);
    }
  }

  setVal('filter-search', '');
  setVal('filter-amount-op', 'ALL');
  setVal('filter-amount-val', '');
  setVal('filter-expense-class', 'ALL');
  const labelClass = document.getElementById('label-filter-expense-class');
  if (labelClass) labelClass.textContent = 'Semua Klasifikasi';

  const targetType = params.type || 'ALL';
  setVal('filter-type', targetType);
  const typeOpt = (searchableFilterData['filter-type'] || []).find(o => o.value === targetType);
  const labelType = document.getElementById('label-filter-type');
  if (labelType && typeOpt) labelType.textContent = typeOpt.label;

  updateDynamicTransactionFilters();

  const targetCat = params.category || 'ALL';
  setVal('filter-category', targetCat);
  const curCatOpt = (searchableFilterData['filter-category'] || []).find(o => o.value === targetCat) 
                 || { label: targetCat === 'ALL' ? 'Semua Kategori' : targetCat };
  const labelCat = document.getElementById('label-filter-category');
  if (labelCat) labelCat.textContent = curCatOpt.label;

  onFilterCategoryChange();

  if (params.subcategory && params.subcategory !== 'ALL') {
    setVal('filter-subcategory', params.subcategory);
    const curSubOpt = (searchableFilterData['filter-subcategory'] || []).find(o => o.value === params.subcategory) 
                   || { label: params.subcategory };
    const labelSub = document.getElementById('label-filter-subcategory');
    if (labelSub) labelSub.textContent = curSubOpt.label;
  }

  setVal('filter-account', 'ALL');
  const labelAcc = document.getElementById('label-filter-account');
  if (labelAcc) labelAcc.textContent = 'Semua Rekening';

  allTimeCurrentPage = 1;

  // Banner pemberitahuan filter khusus
  const banner = document.getElementById('drilldown-banner');
  const desc = document.getElementById('drilldown-desc');
  if (banner && desc) {
    let text = '';
    if (drillDownSpecificDate) {
      const dObj = new Date(drillDownSpecificDate + 'T00:00:00');
      text = `Tanggal: ${dObj.toLocaleDateString('id-ID', { dateStyle: 'full' })}`;
    } else {
      text = params.subcategory || (params.category !== 'ALL' ? params.category : '');
      if (params.type && params.type !== 'ALL') text += (text ? ' (' : '') + (params.type === 'income' ? 'Pemasukan' : 'Pengeluaran') + (text ? ')' : '');
      if (params.month) text += ' • ' + params.month;
    }
    desc.textContent = text || 'Rincian Khusus';
    banner.classList.remove('hidden');
  }

  switchTab('transactions');
}

function resetDrillDownFilter() {
  if (!isDrillDownFilter) return;
  isDrillDownFilter = false;
  drillDownSpecificDate = null; // Reset tanggal khusus

  const banner = document.getElementById('drilldown-banner');
  if (banner) banner.classList.add('hidden');

  const defaultMonth = dashboardSelectedMonth || `${curYear}-${curMonth}`;
  setVal('filter-month', defaultMonth);

  const chkAllTime = document.getElementById('filter-all-time');
  if (chkAllTime) chkAllTime.checked = false;
  const monthWrapper = document.getElementById('month-selector-wrapper');
  if (monthWrapper) monthWrapper.classList.remove('opacity-40', 'pointer-events-none');

  resetTransactionFilters();
}

function clearDrillDownView() {
  resetDrillDownFilter();
  renderTransactions();
}
	
// ==================== PENGENDALI DRILL-DOWN READ-ONLY MULTI-TITIK ====================
let activeChartDrillDownParams = null;
let drillDownOverlappingList = [];

function showChartDrillDownModal(paramsOrList) {
  const tabsContainer = document.getElementById('drilldown-modal-tabs');

  // Cek apakah parameter berupa daftar titik bertumpuk (Array) atau objek tunggal
  if (Array.isArray(paramsOrList)) {
    drillDownOverlappingList = paramsOrList;
    if (drillDownOverlappingList.length === 0) return;

    // Tampilkan deretan tab pemilih jika terdeteksi LEBIH DARI 1 garis pada titik tersebut
    if (tabsContainer && drillDownOverlappingList.length > 1) {
      tabsContainer.classList.remove('hidden');
      renderDrillDownModalTabs(0);
    } else if (tabsContainer) {
      tabsContainer.classList.add('hidden');
    }

    renderDrillDownContent(drillDownOverlappingList[0]);
  } else {
    drillDownOverlappingList = [paramsOrList];
    if (tabsContainer) tabsContainer.classList.add('hidden');
    renderDrillDownContent(paramsOrList);
  }

  openModal('chart-drilldown-modal');
  lucide.createIcons();
}

function renderDrillDownModalTabs(activeIdx = 0) {
  const tabsContainer = document.getElementById('drilldown-modal-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = drillDownOverlappingList.map((item, idx) => {
    const isActive = (idx === activeIdx);
    
    let tabLabel = '';
    if (item.subcategory && item.subcategory !== 'ALL') {
      tabLabel = item.subcategory;
    } else if (item.category && item.category !== 'ALL') {
      tabLabel = item.category;
    } else {
      tabLabel = 'Garis ' + (idx + 1);
    }

    const formattedAmt = formatCurrency(item.totalAmount || item.value || 0);

    return `
      <button type="button" onclick="switchDrillDownModalTab(${idx})" class="shrink-0 px-3 py-1.5 rounded-xl border font-bold text-xs whitespace-nowrap transition flex items-center gap-1.5 shadow-2xs ${
        isActive 
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
      }">
        <span>${escapeHtml(tabLabel)}</span>
        <span class="text-[10px] ${isActive ? 'text-emerald-100' : 'text-slate-400'} font-semibold">(${formattedAmt})</span>
      </button>
    `;
  }).join('');
}

function switchDrillDownModalTab(idx) {
  if (!drillDownOverlappingList[idx]) return;
  renderDrillDownModalTabs(idx);
  renderDrillDownContent(drillDownOverlappingList[idx]);
}

function renderDrillDownContent(params) {
  activeChartDrillDownParams = params;

  // 1. Filter transaksi sesuai tanggal / bulan yang diklik
  const filtered = transactions.filter(tx => {
    if (params.date) {
      if (tx.date !== params.date) return false;
    } else if (params.month) {
      if (!tx.date || !tx.date.startsWith(params.month)) return false;
    }

    if (params.type && params.type !== 'ALL' && tx.type !== params.type) return false;

    if (params.subcategory && params.subcategory !== 'ALL') {
      if ((tx.subcategory || '').trim().toLowerCase() !== params.subcategory.trim().toLowerCase()) return false;
    }

    if (params.category && params.category !== 'ALL') {
      const cat = categories.find(c => c.id === tx.categoryId);
      if (!cat || cat.name.trim().toLowerCase() !== params.category.trim().toLowerCase()) return false;
    }

    return true;
  }).sort((a, b) => {
    if (b.date !== a.date) return b.date > a.date ? 1 : -1;
    const cA = Number(a.createdAt) || 0;
    const cB = Number(b.createdAt) || 0;
    return cB - cA;
  });

  // 2. Hitung Arus Kas Masuk, Keluar, dan Bersih
  let totalIn = 0;
  let totalOut = 0;

  filtered.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    const fee = parseFloat(t.adminFee) || 0;

    if (t.type === 'income') {
      totalIn += amt;
    } else if (t.type === 'expense') {
      totalOut += amt;
    } else if (t.type === 'transfer') {
      if (fee > 0) totalOut += fee; // Biaya admin dihitung pengeluaran
    }
  });

  let totalDisplayStr = '';
  let totalColorClass = 'text-slate-800';
  const countLabelEl = document.getElementById('drilldown-modal-count');

  if (params.type === 'expense') {
    totalDisplayStr = `-${formatCurrency(totalOut)}`;
    totalColorClass = 'text-rose-600';
    if (countLabelEl) countLabelEl.innerHTML = `<span class="font-bold text-slate-700">${filtered.length} Transaksi</span>`;
  } else if (params.type === 'income') {
    totalDisplayStr = `+${formatCurrency(totalIn)}`;
    totalColorClass = 'text-emerald-600';
    if (countLabelEl) countLabelEl.innerHTML = `<span class="font-bold text-slate-700">${filtered.length} Transaksi</span>`;
  } else {
    // TAMPILAN ALL (SAAT TANGGAL KALENDER DIKLIK)
    const netCashflow = totalIn - totalOut;
    if (netCashflow > 0) {
      totalDisplayStr = `+${formatCurrency(netCashflow)}`;
      totalColorClass = 'text-emerald-600';
    } else if (netCashflow < 0) {
      totalDisplayStr = `-${formatCurrency(Math.abs(netCashflow))}`;
      totalColorClass = 'text-rose-600';
    } else {
      totalDisplayStr = formatCurrency(0);
      totalColorClass = 'text-slate-700';
    }

    if (countLabelEl) {
      countLabelEl.innerHTML = `
        <span class="font-bold text-slate-800 block sm:inline">${filtered.length} Transaksi</span>
        <span class="text-[10px] text-slate-400 block sm:inline sm:ml-1">
          (Masuk: <strong class="text-emerald-600">+${formatCurrency(totalIn)}</strong> • Keluar: <strong class="text-rose-600">-${formatCurrency(totalOut)}</strong>)
        </span>
      `;
    }
  }

  const totalEl = document.getElementById('drilldown-modal-total');
  if (totalEl) {
    totalEl.textContent = totalDisplayStr;
    totalEl.className = `text-sm sm:text-base font-extrabold ${totalColorClass}`;
  }

  // 3. Penentuan Judul Pop-up
  let displayTitle = '';
  let displaySubtitle = '';

  if (params.date) {
    // Format tanggal hari (misal: "Kamis, 5 November 2026")
    const dObj = new Date(params.date + 'T00:00:00');
    displayTitle = dObj.toLocaleDateString('id-ID', { dateStyle: 'full' });
    displaySubtitle = 'Rincian Arus Kas Harian';
  } else if (params.month && params.type === 'ALL' && (!params.category || params.category === 'ALL') && (!params.subcategory || params.subcategory === 'ALL')) {
    const p = params.month.split('-').map(Number);
    displayTitle = `${monthNamesID[(p[1] || 1) - 1]} ${p[0] || curYear}`;
    displaySubtitle = 'Rincian Arus Kas Bulanan';
  } else if (params.subcategory && params.subcategory !== 'ALL') {
    displayTitle = params.subcategory;
    displaySubtitle = params.parentCategory ? `Kategori: ${params.parentCategory}` : 'Subkategori Pengeluaran';
  } else if (params.category && params.category !== 'ALL') {
    displayTitle = params.category;
    displaySubtitle = params.type === 'income' ? 'Kategori Pemasukan' : 'Kategori Pengeluaran';
  } else {
    displayTitle = params.type === 'income' ? 'Semua Pemasukan' : (params.type === 'expense' ? 'Semua Pengeluaran' : 'Rincian Transaksi');
    displaySubtitle = 'Rincian Keseluruhan';
  }

  if (params.month && params.month.includes('-') && !params.date && !(params.type === 'ALL' && (!params.category || params.category === 'ALL') && (!params.subcategory || params.subcategory === 'ALL'))) {
    const p = params.month.split('-').map(Number);
    displaySubtitle += ` • ${monthNamesID[p[1] - 1]} ${p[0]}`;
  }

  setText('drilldown-modal-title', displayTitle);
  setText('drilldown-modal-subtitle', displaySubtitle);

  // Icon Header
  const iconWrap = document.getElementById('drilldown-modal-icon-wrap');
  if (iconWrap) {
    if (params.date || (params.month && params.type === 'ALL' && (!params.category || params.category === 'ALL'))) {
      iconWrap.className = 'p-2.5 rounded-2xl shrink-0 bg-blue-50 text-blue-600';
      iconWrap.innerHTML = '<i data-lucide="calendar" class="w-6 h-6"></i>';
    } else if (params.type === 'expense') {
      iconWrap.className = 'p-2.5 rounded-2xl shrink-0 bg-rose-50 text-rose-600';
      iconWrap.innerHTML = '<i data-lucide="receipt" class="w-6 h-6"></i>';
    } else {
      iconWrap.className = 'p-2.5 rounded-2xl shrink-0 bg-emerald-50 text-emerald-600';
      iconWrap.innerHTML = '<i data-lucide="arrow-down-left" class="w-6 h-6"></i>';
    }
  }

  // 4. Render Daftar Transaksi
  const listContainer = document.getElementById('drilldown-modal-list');
  if (listContainer) {
    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs italic">Tidak ada catatan transaksi di hari ini.</div>`;
    } else {
      listContainer.innerHTML = filtered.map(tx => {
        const accName = accounts.find(a => a.id === tx.accountId)?.name || 'Sumber Dana';
        const catName = categories.find(c => c.id === tx.categoryId)?.name || 'Kategori';

        let sourceHtml = escapeHtml(accName);
        let categoryBadgeHtml = '';
        let amountHtml = '';

        if (tx.type === 'transfer') {
          const toAcc = accounts.find(a => a.id === tx.toAccountId)?.name || 'Tujuan';
          const fee = parseFloat(tx.adminFee) || 0;

          sourceHtml = `<span class="text-slate-700 font-semibold">${escapeHtml(accName)}</span> <span class="text-blue-500 font-bold">→</span> <span class="text-slate-700 font-semibold">${escapeHtml(toAcc)}</span>`;
          categoryBadgeHtml = `<span class="bg-blue-50 text-blue-700 font-bold border border-blue-200 px-1.5 py-0.2 rounded text-[10px]">Transfer Antar Rekening</span>`;
          amountHtml = `
            <span class="font-bold text-xs sm:text-sm text-blue-600 whitespace-nowrap">⇄ ${formatCurrency(tx.amount)}</span>
            ${fee > 0 ? `<div class="text-[10px] text-rose-500 font-medium mt-0.5">(Admin: -${formatCurrency(fee)})</div>` : ''}
          `;
        } else if (tx.type === 'expense') {
          categoryBadgeHtml = `<span class="bg-rose-50 text-rose-700 font-semibold border border-rose-200 px-1.5 py-0.2 rounded text-[10px]">${escapeHtml(catName)}</span>`;
          if (tx.subcategory) {
            categoryBadgeHtml += `<span class="bg-slate-100 text-slate-600 font-medium px-1.5 py-0.2 rounded text-[10px] ml-1">${escapeHtml(tx.subcategory)}</span>`;
          }
          amountHtml = `<span class="font-bold text-xs sm:text-sm text-rose-600 whitespace-nowrap">-${formatCurrency(tx.amount)}</span>`;
        } else {
          categoryBadgeHtml = `<span class="bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">${escapeHtml(catName)}</span>`;
          if (tx.subcategory) {
            categoryBadgeHtml += `<span class="bg-slate-100 text-slate-600 font-medium px-1.5 py-0.2 rounded text-[10px] ml-1">${escapeHtml(tx.subcategory)}</span>`;
          }
          amountHtml = `<span class="font-bold text-xs sm:text-sm text-emerald-600 whitespace-nowrap">+${formatCurrency(tx.amount)}</span>`;
        }

        return `
          <div class="pt-2.5 pb-1 flex items-start justify-between gap-3 text-xs">
            <div class="space-y-1 flex-1 min-w-0">
              <div class="flex items-center gap-1.5 font-bold text-slate-800">
                <span class="truncate">${escapeHtml(tx.note || (tx.type === 'transfer' ? 'Pindah Dana' : catName))}</span>
              </div>
              <div class="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>${sourceHtml}</span>
                <span>•</span>
                <div>${categoryBadgeHtml}</div>
              </div>
            </div>
            <div class="text-right shrink-0">
              ${amountHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }
  lucide.createIcons();
}

// Fungsi tombol aksi jika user ingin pindah ke menu transaksi untuk mengedit
function openInTransactionsTabFromDrillDown() {
  closeModal('chart-drilldown-modal');
  if (activeChartDrillDownParams) {
    drillDownToTransactions(activeChartDrillDownParams);
  }
}
	
	// ==================== NAVIGASI PAGINASI (SEMUA WAKTU) ====================
function changeAllTimePage(delta) {
  setAllTimePage(allTimeCurrentPage + delta);
}

function setAllTimePage(pageNum) {
  allTimeCurrentPage = pageNum;
  renderTransactions();

  // Scroll halus kembali ke atas tabel saat berpindah halaman
  const tableWrap = document.getElementById('view-transactions');
  if (tableWrap) {
    const topPos = tableWrap.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
  }
}

function changeAllTimePageSize(val) {
  allTimePageSize = parseInt(val) || 25;
  allTimeCurrentPage = 1;
  renderTransactions();
}

function toggleNoteExpand(txId) {
  // Gunakan querySelectorAll pada kelas agar kedua tampilan (Desktop & HP) merespons seketika
  const prevElements = document.querySelectorAll(`.note-prev-${txId}`);
  const fullElements = document.querySelectorAll(`.note-full-${txId}`);
  prevElements.forEach(el => el.classList.toggle('hidden'));
  fullElements.forEach(el => el.classList.toggle('hidden'));
}

function toggleMobileIoMenu() {
  const menu = document.getElementById('menu-mobile-io');
  if (menu) menu.classList.toggle('hidden');
}

function getFilteredTransactions() {
  const isAllTime = document.getElementById('filter-all-time')?.checked;
  const selectedMonth = document.getElementById('filter-month')?.value;
  const accFilter = document.getElementById('filter-account')?.value || 'ALL';
  const catFilter = document.getElementById('filter-category')?.value || 'ALL';
  const subFilter = document.getElementById('filter-subcategory')?.value || 'ALL';
  const typeFilter = document.getElementById('filter-type')?.value || 'ALL';
  const expClassFilter = document.getElementById('filter-expense-class')?.value || 'ALL';

  const searchQuery = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const amountOp = document.getElementById('filter-amount-op')?.value || 'ALL';
  const amountValRaw = document.getElementById('filter-amount-val')?.value;
  const targetAmount = (amountValRaw && amountValRaw.trim() !== '') ? Math.abs(parseDotsNumber(amountValRaw)) : null;
	  
  const filtered = transactions.filter(tx => {
    if (drillDownSpecificDate) {
      if (tx.date !== drillDownSpecificDate) return false;
    } else {
      if (!isAllTime && selectedMonth && tx.date && !tx.date.startsWith(selectedMonth)) return false;
    }
    if (accFilter !== 'ALL' && tx.accountId !== accFilter && tx.toAccountId !== accFilter) return false;

    if (catFilter !== 'ALL') {
      const txCat = categories.find(c => c.id === tx.categoryId);
      if (!txCat || txCat.name.trim().toLowerCase() !== catFilter.toLowerCase()) return false;
    }

    if (subFilter !== 'ALL') {
      if ((tx.subcategory || '').trim().toLowerCase() !== subFilter.toLowerCase()) return false;
    }

    if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;

    if (expClassFilter !== 'ALL') {
      if (tx.type !== 'expense') return false;
      const cat = categories.find(c => c.id === tx.categoryId);
      const cls = cat?.expenseClass || 'dynamic';
      if (cls !== expClassFilter) return false;
    }

    if (searchQuery) {
      const noteText = String(tx.note || '').toLowerCase();
      if (!noteText.includes(searchQuery)) return false;
    }

    if (amountOp !== 'ALL' && targetAmount !== null) {
      const txAmount = Math.abs(parseFloat(tx.amount) || 0);
      if (amountOp === 'eq' && Math.abs(txAmount - targetAmount) > 0.01) return false;
      if (amountOp === 'gte' && txAmount < targetAmount) return false;
      if (amountOp === 'lte' && txAmount > targetAmount) return false;
    }

    return true;
  });

  filtered.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return filtered;
}

function moveTransaction(txId, direction) {
  const filtered = getFilteredTransactions();

  const curIdx = filtered.findIndex(t => t.id === txId);
  if (curIdx === -1) return;

  const targetIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
  if (targetIdx < 0 || targetIdx >= filtered.length) return;

  const currentTx = filtered[curIdx];
  const targetTx = filtered[targetIdx];

  if (String(currentTx.date).trim() !== String(targetTx.date).trim()) return;

  const globalIdxA = transactions.findIndex(t => t.id === currentTx.id);
  const globalIdxB = transactions.findIndex(t => t.id === targetTx.id);

  if (globalIdxA !== -1 && globalIdxB !== -1) {
    const temp = transactions[globalIdxA];
    transactions[globalIdxA] = transactions[globalIdxB];
    transactions[globalIdxB] = temp;

    persistState(false);
    renderTransactions();
  }
}

function renderTransactions() {
  const tbody = document.getElementById('transaction-table-body');
  const mobileCards = document.getElementById('transaction-mobile-cards');
  const noTx = document.getElementById('no-tx-msg');
  if (tbody) tbody.innerHTML = '';
  if (mobileCards) mobileCards.innerHTML = '';

  const filtered = getFilteredTransactions();

  // Ringkasan Periode (Total Pemasukan & Pengeluaran tetap menghitung SELURUH data yang cocok)
  let periodInflow = 0;
  let periodOutflow = 0;

  filtered.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;

    if (tx.type === 'income') {
      periodInflow += amt;
    } else if (tx.type === 'expense') {
      periodOutflow += amt;
    } else if (tx.type === 'transfer' && fee > 0) {
      periodOutflow += fee;
    }
  });

  const periodNetSavings = periodInflow - periodOutflow;
  const inDisplay = dashPrivacy.income ? 'Rp ••••••' : `+${formatCurrency(periodInflow)}`;
  const outDisplay = dashPrivacy.expense ? 'Rp ••••••' : `-${formatCurrency(periodOutflow)}`;
  const savDisplay = dashPrivacy.savings 
    ? 'Rp ••••••' 
    : (periodNetSavings >= 0 ? `+${formatCurrency(periodNetSavings)}` : formatCurrency(periodNetSavings));
  const savColor = periodNetSavings >= 0 ? 'text-blue-600' : 'text-rose-600';

  const summaryEl = document.getElementById('transaction-period-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="grid grid-cols-2 sm:flex sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 w-full">
        <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 py-0.5">
          <span class="text-slate-500 text-[11px] sm:text-xs">Total Transaksi:</span>
          <strong class="text-slate-800 text-xs sm:text-sm">${filtered.length} transaksi</strong>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 py-0.5">
          <span class="text-slate-500 text-[11px] sm:text-xs">Total Pemasukan:</span>
          <strong class="text-emerald-600 text-xs sm:text-sm font-bold">${inDisplay}</strong>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 py-0.5">
          <span class="text-slate-500 text-[11px] sm:text-xs">Total Pengeluaran:</span>
          <strong class="text-rose-600 text-xs sm:text-sm font-bold">${outDisplay}</strong>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 py-0.5">
          <span class="text-slate-500 text-[11px] sm:text-xs">Tabungan Bersih:</span>
          <strong class="${dashPrivacy.savings ? 'text-slate-800' : savColor} text-xs sm:text-sm font-bold">${savDisplay}</strong>
        </div>
      </div>
    `;
  }

  // ==================== LOGIKA PAGINASI ====================
  const isAllTime = document.getElementById('filter-all-time')?.checked;
  const paginationWrap = document.getElementById('all-time-pagination');

  let displayedTxs = filtered;

  if (isAllTime) {
    // Tampilkan bilah paginasi hanya pada mode "Semua Waktu"
    if (paginationWrap) paginationWrap.classList.remove('hidden');

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / allTimePageSize) || 1;

    if (allTimeCurrentPage > totalPages) allTimeCurrentPage = totalPages;
    if (allTimeCurrentPage < 1) allTimeCurrentPage = 1;

    const startIdx = (allTimeCurrentPage - 1) * allTimePageSize;
    const endIdx = Math.min(startIdx + allTimePageSize, totalRecords);

    displayedTxs = filtered.slice(startIdx, endIdx);

    // Perbarui Info Paginasi
    const infoText = document.getElementById('pagination-info-text');
    if (infoText) {
      infoText.textContent = totalRecords === 0 
        ? 'Tidak ada data' 
        : `Menampilkan ${startIdx + 1}–${endIdx} dari ${totalRecords} transaksi`;
    }

    const pagesBadge = document.getElementById('pagination-pages-badge');
    if (pagesBadge) {
      pagesBadge.textContent = `${allTimeCurrentPage} / ${totalPages}`;
    }

    const btnFirst = document.getElementById('btn-page-first');
    const btnPrev = document.getElementById('btn-page-prev');
    const btnNext = document.getElementById('btn-page-next');
    const btnLast = document.getElementById('btn-page-last');

    if (btnFirst) btnFirst.disabled = (allTimeCurrentPage <= 1);
    if (btnPrev) btnPrev.disabled = (allTimeCurrentPage <= 1);
    if (btnNext) btnNext.disabled = (allTimeCurrentPage >= totalPages);
    if (btnLast) btnLast.disabled = (allTimeCurrentPage >= totalPages);

    const pageSizeSelect = document.getElementById('pagination-page-size');
    if (pageSizeSelect) pageSizeSelect.value = String(allTimePageSize);
  } else {
    // Sembunyikan paginasi pada mode bulanan (seluruh transaksi bulan ini tertampil utuh)
    if (paginationWrap) paginationWrap.classList.add('hidden');
    displayedTxs = filtered;
  }

  if (displayedTxs.length === 0) {
    if (noTx) noTx.classList.remove('hidden');
    return;
  }
  if (noTx) noTx.classList.add('hidden');

  // Render tabel dan kartu mobile menggunakan data displayedTxs
  displayedTxs.forEach((tx, idx) => {
    const acc = accounts.find(a => a.id === tx.accountId)?.name || 'Tidak Diketahui';
    const isExpense = tx.type === 'expense';
    const isTransfer = tx.type === 'transfer';

    let sourceColHtml = escapeHtml(acc);
    let categoryColHtml = '';
    let subcatColHtml = escapeHtml(tx.subcategory || '-');
    let amountColHtml = '';

    if (isTransfer) {
      const toAcc = accounts.find(a => a.id === tx.toAccountId)?.name || 'Tidak Diketahui';
      const fee = parseFloat(tx.adminFee) || 0;
      sourceColHtml = `
        <span class="flex items-center gap-1 font-semibold text-slate-800">
          ${escapeHtml(acc)} <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-blue-500 inline shrink-0"></i> ${escapeHtml(toAcc)}
        </span>
      `;
      categoryColHtml = `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">Transfer</span>`;
      subcatColHtml = `<span class="text-slate-400">Pindah Dana</span>`;
      amountColHtml = `
        <span class="text-blue-600 font-bold whitespace-nowrap">⇄ ${formatCurrency(tx.amount)}</span>
        ${fee > 0 ? `<div class="text-[10px] text-rose-500 font-semibold mt-0.5">(Admin: ${formatCurrency(fee)})</div>` : ''}
      `;
    } else {
      const cat = categories.find(c => c.id === tx.categoryId)?.name || 'Kategori Lain';
      categoryColHtml = `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${isExpense ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}">${escapeHtml(cat)}</span>`;
      amountColHtml = `<span class="${isExpense ? 'text-rose-600' : 'text-emerald-600'} font-bold whitespace-nowrap">${isExpense ? '-' : '+'}${formatCurrency(tx.amount)}</span>`;
    }

    const canMoveUp = (idx > 0 && displayedTxs[idx - 1].date === tx.date);
    const canMoveDown = (idx < displayedTxs.length - 1 && displayedTxs[idx + 1].date === tx.date);

    const rawNote = String(tx.note || '');
    const isLongNote = rawNote.length > 35 || rawNote.includes('\n');
    const formattedFullNote = escapeHtml(rawNote).replace(/\n/g, '<br/>');
    const firstLineNote = escapeHtml(rawNote.split('\n')[0].slice(0, 35)) + (isLongNote ? '...' : '');

    let noteHtml = `<span class="text-slate-400 italic text-xs">-</span>`;
    if (rawNote.trim() !== '') {
      if (!isLongNote) {
        noteHtml = `<div class="whitespace-pre-line text-xs text-slate-700">${escapeHtml(rawNote)}</div>`;
      } else {
        // Gunakan kelas CSS khusus per ID transaksi agar tombol di HP dan PC 100% responsif
        noteHtml = `
          <div class="text-xs">
            <div class="note-prev-${tx.id} text-slate-700">
              <span>${firstLineNote}</span>
              <button type="button" onclick="toggleNoteExpand('${tx.id}')" class="ml-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 underline">
                Lihat
              </button>
            </div>
            <div class="note-full-${tx.id} hidden whitespace-pre-line text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1 shadow-sm leading-relaxed">
              ${formattedFullNote}
              <div class="mt-1">
                <button type="button" onclick="toggleNoteExpand('${tx.id}')" class="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Tampilan Desktop (Tabel)
    if (tbody) {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
      tr.innerHTML = `
        <td class="px-3 py-3 whitespace-nowrap text-slate-600 font-medium">${escapeHtml(tx.date)}</td>
        <td class="px-3 py-3">${sourceColHtml}</td>
        <td class="px-3 py-3">${categoryColHtml}</td>
        <td class="px-3 py-3 text-slate-500">${subcatColHtml}</td>
        <td class="px-3 py-3">${noteHtml}</td>
        <td class="px-3 py-3 text-right">${amountColHtml}</td>
        <td class="px-3 py-3 text-center whitespace-nowrap">
          <div class="inline-flex items-center justify-center gap-1.5">
            ${canMoveUp ? `
              <button type="button" onclick="moveTransaction('${tx.id}', 'up')" data-tooltip="Pindahkan transaksi ke atas" aria-label="Pindahkan transaksi ke atas" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
                <i data-lucide="arrow-up" class="w-4 h-4"></i>
              </button>
            ` : `
              <button type="button" disabled aria-label="Tidak dapat dipindah ke atas" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed shrink-0">
                <i data-lucide="arrow-up" class="w-4 h-4"></i>
              </button>
            `}
            ${canMoveDown ? `
              <button type="button" onclick="moveTransaction('${tx.id}', 'down')" data-tooltip="Pindahkan transaksi ke bawah" aria-label="Pindahkan transaksi ke bawah" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
                <i data-lucide="arrow-down" class="w-4 h-4"></i>
              </button>
            ` : `
              <button type="button" disabled aria-label="Tidak dapat dipindah ke bawah" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed shrink-0">
                <i data-lucide="arrow-down" class="w-4 h-4"></i>
              </button>
            `}
            <button type="button" onclick="editTransaction('${tx.id}')" data-tooltip="Ubah transaksi" aria-label="Ubah transaksi" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button type="button" onclick="deleteTransaction('${tx.id}')" data-tooltip="Hapus transaksi" aria-label="Hapus transaksi" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shrink-0">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Tampilan Mobile (Kartu Responsif)
    if (mobileCards) {
      const card = document.createElement('div');
      card.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5";
      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-100 pb-2 gap-2">
          <span class="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${escapeHtml(tx.date)}
          </span>
          <div class="shrink-0">${categoryColHtml}</div>
        </div>
        
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">Sumber / Rekening</span>
            <div class="text-xs font-bold text-slate-800">${sourceColHtml}</div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">Nominal</span>
            <div class="text-sm font-extrabold">${amountColHtml}</div>
          </div>
        </div>

        ${tx.subcategory && !isTransfer ? `
          <div class="text-[11px] text-slate-500 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg">
            <span class="text-slate-400">Subkategori:</span>
            <span class="font-semibold text-slate-700">${escapeHtml(tx.subcategory)}</span>
          </div>
        ` : ''}

        ${rawNote.trim() !== '' ? `
          <div class="text-xs bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
            ${noteHtml}
          </div>
        ` : ''}

        <div class="flex items-center justify-between pt-2 border-t border-slate-100">
          <div class="flex items-center gap-1.5">
            ${canMoveUp ? `
              <button type="button" onclick="moveTransaction('${tx.id}', 'up')" data-tooltip="Pindahkan ke atas" aria-label="Pindahkan ke atas" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
                <i data-lucide="arrow-up" class="w-4 h-4"></i>
              </button>
            ` : `
              <button type="button" disabled aria-label="Tidak dapat dipindah ke atas" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed shrink-0">
                <i data-lucide="arrow-up" class="w-4 h-4"></i>
              </button>
            `}
            ${canMoveDown ? `
              <button type="button" onclick="moveTransaction('${tx.id}', 'down')" data-tooltip="Pindahkan ke bawah" aria-label="Pindahkan ke bawah" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
                <i data-lucide="arrow-down" class="w-4 h-4"></i>
              </button>
            ` : `
              <button type="button" disabled aria-label="Tidak dapat dipindah ke bawah" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed shrink-0">
                <i data-lucide="arrow-down" class="w-4 h-4"></i>
              </button>
            `}
          </div>

          <div class="flex items-center gap-1.5">
            <button type="button" onclick="editTransaction('${tx.id}')" data-tooltip="Ubah transaksi" aria-label="Ubah transaksi" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button type="button" onclick="deleteTransaction('${tx.id}')" data-tooltip="Hapus transaksi" aria-label="Hapus transaksi" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shrink-0">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
      mobileCards.appendChild(card);
    }
  });

  lucide.createIcons();
}

let activePayingReminderId = '';

function openTransactionModal(editId = null, options = {}) {
	  closeMobileMenu();
  const form = document.getElementById('tx-form');
  if (form) form.reset();
	  
	  // Reset ukuran pop-up ke standar & status pembayaran reminder
	  isTxParamPanelOpen = false;
  applyTxParamPanelState();
  activePayingReminderId = (!editId && options && options.reminderId) ? String(options.reminderId) : '';

  if (typeof closeInAppNumpad === 'function') {
    closeInAppNumpad(false);
  }

  if (editId) {
    const tx = transactions.find(t => t.id === editId);
    if (!tx) return;

    setText('tx-modal-title', 'Ubah Transaksi');
    setVal('tx-id', tx.id);

    const radio = document.querySelector(`input[name="tx-type"][value="${tx.type}"]`);
    if (radio) radio.checked = true;

    setVal('tx-amount', formatNumberWithDots(tx.amount));
    setVal('tx-date', tx.date);
    setVal('tx-account', tx.accountId);

    onTxTypeChange();

    if (tx.type === 'transfer') {
      setVal('tx-to-account', tx.toAccountId || '');
      setVal('tx-admin-fee', formatNumberWithDots(tx.adminFee || 0));
    } else {
      setVal('tx-category', tx.categoryId);
      populateSubcategoriesDropdown();
      setVal('tx-subcategory', tx.subcategory || '');

      // PISAHKAN CATATAN UTAMA & NILAI PARAMETER SECARA TUNTAS
      const parsed = parseNoteAndParameters(tx.note || '');
      setVal('tx-note', parsed.mainNote); 
      updateTxCustomParameterFields(parsed.paramValues); 
    }
    setVal('tx-note', tx.note || '');
  } else {
    setText('tx-modal-title', options?.reminderId ? 'Bayar Tagihan Reminder' : 'Catat Transaksi Baru');
    setVal('tx-id', '');
    setVal('tx-date', getLocalDateStr());
    setVal('tx-admin-fee', '0');

    const defaultCat = categories.find(c => c.id === txPreferences.defaultCategoryId) || categories[0];
    const targetType = defaultCat ? defaultCat.type : 'expense';

    const radio = document.querySelector(`input[name="tx-type"][value="${targetType}"]`);
    if (radio) radio.checked = true;
    onTxTypeChange();

    if (txPreferences.defaultAccountId && accounts.some(a => a.id === txPreferences.defaultAccountId)) {
      setVal('tx-account', txPreferences.defaultAccountId);
    }
    if (defaultCat) {
      setVal('tx-category', defaultCat.id);
      populateSubcategoriesDropdown();
		  updateTxCustomParameterFields();
    }
  }

  openModal('transaction-modal');

  if (!options || !options.skipAutoNumpad) {
    setTimeout(() => {
      const amtInput = document.getElementById('tx-amount');
      if (amtInput) {
        if (isMobileDevice()) {
          openInAppNumpad(amtInput, 'Nominal Transaksi');
        } else {
          amtInput.focus();
          amtInput.select();
        }
      }
    }, 60);
  }
}

function editTransaction(id) {
  openTransactionModal(id);
}

function saveTransaction(e) {
  e.preventDefault();
  const existingId = document.getElementById('tx-id')?.value;
  const type = document.querySelector('input[name="tx-type"]:checked')?.value || 'expense';
  const amount = parseDotsNumber(document.getElementById('tx-amount')?.value);
  const date = document.getElementById('tx-date')?.value || getLocalDateStr();
  const accountId = document.getElementById('tx-account')?.value;
  const toAccountId = document.getElementById('tx-to-account')?.value;
  const adminFee = (type === 'transfer') ? parseDotsNumber(document.getElementById('tx-admin-fee')?.value) : 0;
  const categoryId = document.getElementById('tx-category')?.value;
  const subcategory = document.getElementById('tx-subcategory')?.value || '';
  
	  // ==================== SUSUN CATATAN MULTILINE ANTI-DUPLIKASI ====================
  let rawMainNote = (document.getElementById('tx-note')?.value || '').trim();
  
  // 1. Buang baris bullet apapun dari catatan utama agar TIDAK PERNAH terjadi duplikasi
  let cleanMain = stripBulletParameters(rawMainNote);

  const paramInputs = document.querySelectorAll('.tx-param-field-val');
  const paramLines = [];
  const seenParamKeys = new Set(); // Cegah parameter ganda

  paramInputs.forEach(inp => {
    const pName = (inp.getAttribute('data-param-name') || '').trim();
    const pUnit = (inp.getAttribute('data-param-unit') || '').trim();
    const pVal = inp.value.trim();
    const key = pName.toLowerCase();

    if (pName && pVal && !seenParamKeys.has(key)) {
      seenParamKeys.add(key);
      const formattedLine = `• ${pName}: ${pVal}${pUnit ? ' ' + pUnit : ''}`;
      paramLines.push(formattedLine);
    }
  });

  let finalCompiledNote = cleanMain;
  if (paramLines.length > 0) {
    finalCompiledNote = cleanMain ? `${cleanMain}\n${paramLines.join('\n')}` : paramLines.join('\n');
  }
  const note = finalCompiledNote;
  // ===============================================================================
	  
  if (type === 'transfer') {
    if (!toAccountId || accountId === toAccountId) {
      alert('Rekening asal dan rekening tujuan transfer tidak boleh sama!');
      return;
    }
  }

  // Deteksi apakah pengeluaran ini melampaui limit anggaran aktif
  let budgetWarningInfo = null;
  if (type === 'expense' && categoryId) {
    const txMonth = date.substring(0, 7);
    const monthBudgets = budgets[txMonth] || {};
    const limitAmount = parseFloat(monthBudgets[categoryId]) || 0;

    if (limitAmount > 0) {
      let currentSpent = 0;
      transactions.forEach(t => {
        if (t.type === 'expense' && t.categoryId === categoryId && t.date && t.date.startsWith(txMonth)) {
          if (!existingId || t.id !== existingId) {
            currentSpent += (parseFloat(t.amount) || 0);
          }
        }
      });
      const newTotalSpent = currentSpent + amount;
      if (newTotalSpent > limitAmount) {
        const catObj = categories.find(c => c.id === categoryId);
        budgetWarningInfo = {
          catName: catObj ? catObj.name : 'Kategori',
          limitAmount: limitAmount,
          totalSpent: newTotalSpent,
          overAmount: newTotalSpent - limitAmount,
          pct: Math.round((newTotalSpent / limitAmount) * 100),
          txMonth: txMonth
        };
      }
    }
  }

  if (existingId) {
    const idx = transactions.findIndex(t => t.id === existingId);
    if (idx !== -1) {
      transactions[idx] = { 
        id: existingId, 
        type, 
        amount, 
        adminFee,
        date, 
        accountId, 
        toAccountId: type === 'transfer' ? toAccountId : null, 
        categoryId: type === 'transfer' ? '' : categoryId, 
        subcategory: type === 'transfer' ? '' : subcategory, 
        note // PENTING: Saat mode edit, catatan disimpan 100% persis seperti ketikan user tanpa auto-capitalize
      };
    }
  } else {
    // PENTING: Saat transaksi baru, catatan otomatis diformat dengan Smart Title Case
    const formattedNote = toSmartTitleCase(note);
    transactions.unshift({
      id: 'tx-' + Date.now(),
      type,
      amount,
      adminFee,
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? '' : categoryId,
      subcategory: type === 'transfer' ? '' : subcategory,
      note: formattedNote
    });
  }

  const directReminderId = (!existingId) ? activePayingReminderId : '';
  activePayingReminderId = '';

  // Transaksi tetap langsung tersimpan aman
  persistState(true);
  closeModal('transaction-modal');
  renderAll();
	  
  if (!existingId && type === 'expense') {
    if (directReminderId) {
      const targetBill = recurringBills.find(r => String(r.id) === String(directReminderId));
      if (targetBill) {
        advanceRecurringBillSchedule(targetBill, date, amount);
        persistState(true);
        renderAll();
        const nextDueLabel = targetBill.customDueDate
          ? parseLocalDate(targetBill.customDueDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })
          : '-';
        showAppToast(
          'Tagihan Reminder Terbayar',
          `"${targetBill.name}" ditandai terbayar. Jatuh tempo berikutnya otomatis diperbarui ke ${nextDueLabel}.`,
          { tone: 'emerald', duration: 7000 }
        );
      }
    } else if (categoryId) {
      checkAndUpdateMatchingRecurringBills(categoryId, subcategory, date, amount);
    }
  }

  // Jika over budget, tampilkan pop-up peringatan detail
  if (budgetWarningInfo) {
    showBudgetOverrunNotification(budgetWarningInfo);
  }
}
	
	// Memeriksa dan meminta konfirmasi jika transaksi baru cocok (nominal, kategori, subkategori) dengan tagihan reminder H-1 / H-0
async function checkAndUpdateMatchingRecurringBills(catId, subcatName, txDate, txAmount) {
  if (!catId) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normSub = String(subcatName || '').trim().toLowerCase();
  const numAmount = parseFloat(txAmount) || 0;

  const matchedBills = recurringBills.filter(r => {
    if (String(r.categoryId) !== String(catId)) return false;
    if (String(r.subcategory || '').trim().toLowerCase() !== normSub) return false;
    if (Math.abs((parseFloat(r.amount) || 0) - numAmount) >= 0.01) return false;

    const resolved = resolveRecurringCycleInfo(r);
    const dueDateStr = r.customDueDate || calcDueDateStr(
      r.lastPaidDate,
      resolved.validityDays,
      resolved.cycleType,
      resolved.dueDay,
      resolved.cycleInterval,
      resolved.dueMonth
    );
    const dueDate = parseLocalDate(dueDateStr);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    return diffDays === 0 || diffDays === 1;
  });

  if (matchedBills.length === 1) {
    const bill = matchedBills[0];
    const resolved = resolveRecurringCycleInfo(bill);
    const dueStr = bill.customDueDate || calcDueDateStr(
      bill.lastPaidDate,
      resolved.validityDays,
      resolved.cycleType,
      resolved.dueDay,
      resolved.cycleInterval,
      resolved.dueMonth
    );
    const dueDate = parseLocalDate(dueStr);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    const dueBadge = diffDays === 0 ? 'Jatuh Tempo Hari Ini (H-0)' : 'Jatuh Tempo Besok (H-1)';
    const dueFormatted = dueDate.toLocaleDateString('id-ID', { dateStyle: 'medium' });

    const confirmed = await showAppConfirm(
      `Transaksi ini memiliki nominal (${formatCurrency(numAmount)}), kategori, dan subkategori yang sama dengan tagihan reminder:\n\n` +
      `• ${bill.name}\n• ${dueBadge} — ${dueFormatted}\n\n` +
      `Apakah transaksi ini untuk membayar tagihan pada reminder tersebut?`,
      'Konfirmasi Pembayaran Tagihan',
      { okLabel: 'Ya, Bayar Tagihan', cancelLabel: 'Bukan' }
    );

    if (confirmed) {
      advanceRecurringBillSchedule(bill, txDate, numAmount);
      persistState(true);
      renderAll();
      const nextDueLabel = bill.customDueDate
        ? parseLocalDate(bill.customDueDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })
        : '-';
      showAppToast(
        'Tagihan Reminder Diperbarui',
        `"${bill.name}" ditandai terbayar. Jatuh tempo berikutnya: ${nextDueLabel}.`,
        { tone: 'emerald', duration: 7000 }
      );
    }
  } else if (matchedBills.length > 1) {
    promptSelectRecurringToUpdate(matchedBills, txDate, numAmount);
  }
}

function promptSelectRecurringToUpdate(candidates, newTxDate, txAmount = null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Urutkan prioritas berdasarkan deadline terdekat
  const sortedCandidates = candidates.map(c => {
    const dueDate = c.customDueDate ? parseLocalDate(c.customDueDate) : calcDueDate(c);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    return { ...c, dueDate, diffDays };
  }).sort((a, b) => a.diffDays - b.diffDays);

  const listContainer = document.getElementById('rec-conflict-candidates-list');
  if (!listContainer) return;

  listContainer.innerHTML = sortedCandidates.map((c, idx) => {
    const isNearest = (idx === 0);
    return `
      <div onclick="executeSingleRecurringUpdate('${c.id}', '${newTxDate}', ${txAmount !== null ? Number(txAmount) : 'null'})" class="p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
        isNearest 
          ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400 shadow-sm' 
          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
      }">
        <div class="space-y-0.5">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-slate-900">${escapeHtml(c.name)}</span>
            ${isNearest ? '<span class="text-[9px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">Deadline Terdekat</span>' : ''}
          </div>
          <div class="text-[11px] text-slate-500">
            <span>Nominal: <strong>${formatCurrency(c.amount)}</strong></span> • 
            <span>Tempo: <strong>${c.dueDate.toLocaleDateString('id-ID', { dateStyle: 'medium' })} (${c.diffDays === 0 ? 'H-0' : 'H-1'})</strong></span>
          </div>
        </div>
        <i data-lucide="check-circle" class="w-5 h-5 ${isNearest ? 'text-amber-600' : 'text-slate-400'} shrink-0 ml-2"></i>
      </div>
    `;
  }).join('');

  openModal('recurring-conflict-modal');
  lucide.createIcons();
}

function executeSingleRecurringUpdate(recId, newTxDate, txAmount = null) {
  const bill = recurringBills.find(r => String(r.id) === String(recId));
  if (bill) {
    advanceRecurringBillSchedule(bill, newTxDate, txAmount);
    persistState(true);
    renderAll();
    const nextDueLabel = bill.customDueDate
      ? parseLocalDate(bill.customDueDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })
      : '-';
    showAppToast(
      'Tagihan Reminder Diperbarui',
      `"${bill.name}" ditandai terbayar. Jatuh tempo berikutnya: ${nextDueLabel}.`,
      { tone: 'emerald', duration: 7000 }
    );
  }
  closeModal('recurring-conflict-modal');
}

async function deleteTransaction(id) {
  if (await showAppConfirm('Yakin ingin menghapus transaksi ini?', 'Hapus Transaksi')) {
    transactions = transactions.filter(t => t.id !== id);
    persistState(true);
    renderAll();
  }
}

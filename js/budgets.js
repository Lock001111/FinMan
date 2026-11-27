// ==================== Budgets Management & Historical Analytics ====================

// ==================== ANGGARAN & HISTORIS ====================
function calculateCategoryAnalytics(catId, targetMonthStr) {
  const parts = targetMonthStr.split('-').map(Number);
  const targetYear = parts[0] || curYear;
  const targetMonth = parts[1] || parseInt(curMonth);

  const refYear = (targetMonth <= 3) ? (targetYear - 1) : targetYear;
  const refYearStr = String(refYear);

  const elapsed = getElapsedMonthsCount(refYear);
  const maxAllowed = (refYear === targetYear) ? Math.min(targetMonth, elapsed) : elapsed;

  const monthlySpends = [];
  for (let m = 1; m <= maxAllowed; m++) {
    const mKey = `${refYearStr}-${String(m).padStart(2, '0')}`;
    const total = transactions.reduce((sum, tx) => {
      if (tx.type === 'expense' && tx.categoryId === catId && tx.date && tx.date.startsWith(mKey)) {
        return sum + (parseFloat(tx.amount) || 0);
      }
      return sum;
    }, 0);
    monthlySpends.push(total);
  }

  const nonZeroSpends = monthlySpends.filter(v => v > 0);
  const maxSpend = monthlySpends.length > 0 ? Math.max(...monthlySpends) : 0;
  const minSpend = nonZeroSpends.length > 0 ? Math.min(...nonZeroSpends) : 0;
  const totalSpend = monthlySpends.reduce((a, b) => a + b, 0);
  const avgSpend = monthlySpends.length > 0 ? (totalSpend / monthlySpends.length) : 0;

  return { refYear, maxSpend, minSpend, avgSpend };
}

function updateBudgetModalAnalytics() {
  const catSelect = document.getElementById('budget-cat-select');
  const monthInput = document.getElementById('budget-month-selector');
  const targetMonthStr = monthInput?.value || dashboardSelectedMonth;
  const catId = catSelect?.value;

  if (!catId) return;

  const ana = calculateCategoryAnalytics(catId, targetMonthStr);
  setText('budget-ref-year-label', `Acuan: Tahun ${ana.refYear}`);
  setText('budget-ref-max', formatCurrency(ana.maxSpend));
  setText('budget-ref-min', formatCurrency(ana.minSpend));
  setText('budget-ref-avg', formatCurrency(ana.avgSpend));

  // Cek apakah kategori ini sudah memiliki limit aktif di bulan terpilih
  const monthBudgets = budgets[targetMonthStr] || {};
  const activeLimit = parseFloat(monthBudgets[catId]) || 0;
  const refAvg = Math.round(ana.avgSpend) || 0;
  const btnDel = document.getElementById('btn-delete-budget');

  if (activeLimit > 0) {
    if (btnDel) btnDel.classList.remove('hidden');
    setBudgetAmountField(activeLimit, false, refAvg);
  } else {
    if (btnDel) btnDel.classList.add('hidden');
    setBudgetAmountField(refAvg, refAvg > 0, refAvg);
  }
  lucide.createIcons();
}

function renderBudgets() {
  const monthInput = document.getElementById('budget-month-selector');
  const month = monthInput?.value || dashboardSelectedMonth;
  const grid = document.getElementById('budget-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const monthBudgets = budgets[month] || {};
  let expenseCats = categories.filter(c => c.type === 'expense');

  // 1. Filter Klasifikasi
  const filterClass = document.getElementById('budget-filter-class')?.value || 'ALL';
  if (filterClass !== 'ALL') {
    expenseCats = expenseCats.filter(c => (c.expenseClass || 'dynamic') === filterClass);
  }

  // 2. Filter Pencarian Nama Kategori (Search)
  const searchInput = document.getElementById('budget-search-input');
  const searchQuery = (searchInput?.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('budget-search-clear');
  if (clearBtn) {
    if (searchQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  if (searchQuery) {
    expenseCats = expenseCats.filter(c => c.name.toLowerCase().includes(searchQuery));
  }

  // 3. Urutkan Nama Kategori
  const sortName = document.getElementById('budget-sort-name')?.value || 'default';
  if (sortName === 'name-asc') {
    expenseCats.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  } else if (sortName === 'name-desc') {
    expenseCats.sort((a, b) => b.name.localeCompare(a.name, 'id'));
  }

  const countEl = document.getElementById('budget-filter-count');
  if (countEl) countEl.textContent = `Menampilkan ${expenseCats.length} kategori`;

  const spending = {};
  transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.date && tx.date.startsWith(month)) {
      spending[tx.categoryId] = (spending[tx.categoryId] || 0) + (parseFloat(tx.amount) || 0);
    }
  });

  if (expenseCats.length === 0) {
    if (searchQuery) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs">Tidak ada kategori yang cocok dengan pencarian "<strong>${escapeHtml(searchQuery)}</strong>".</div>`;
    } else {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs">Tidak ada kategori pengeluaran yang cocok dengan filter klasifikasi ini.</div>`;
    }
    return;
  }

  expenseCats.forEach(cat => {
    const budgetLimit = monthBudgets[cat.id] || 0;
    const spent = spending[cat.id] || 0;

    const realPercentage = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : 0;
    const barWidth = Math.min(realPercentage, 100);
    
    let barColor = 'bg-emerald-500';
    let badgeStyle = 'bg-slate-100 text-slate-600';

    if (realPercentage > 100) {
      barColor = 'bg-rose-500';
      badgeStyle = 'bg-rose-100 text-rose-700 font-extrabold animate-pulse';
    } else if (realPercentage >= 80) {
      barColor = 'bg-amber-500';
      badgeStyle = 'bg-amber-100 text-amber-800 font-bold';
    }

    const ana = calculateCategoryAnalytics(cat.id, month);

    const card = document.createElement('div');
    card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between";
    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <h4 class="font-bold text-slate-800 text-sm sm:text-base min-w-0 break-words">${escapeHtml(cat.name)}</h4>
          <span class="text-[11px] px-2.5 py-0.5 rounded-full shrink-0 ${badgeStyle}">
            ${budgetLimit > 0 ? `${realPercentage}% Terpakai` : 'Tanpa Limit'}
          </span>
        </div>

        <div class="flex justify-between items-baseline gap-2 mb-2">
          <span class="text-lg font-bold text-slate-900">${formatCurrency(spent)}</span>
          <span class="text-xs text-slate-500">Limit: ${budgetLimit > 0 ? formatCurrency(budgetLimit) : 'Belum diatur'}</span>
        </div>

        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
          <div class="${barColor} h-2.5 rounded-full transition-all duration-300" style="width: ${budgetLimit > 0 ? barWidth : 0}%"></div>
        </div>

        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-[11px] space-y-1 mb-2">
          <div class="flex items-center justify-between text-slate-500 font-semibold text-[10px]">
            <span>Data Acuan Limit:</span>
            <span class="text-emerald-700 font-bold">Tahun ${ana.refYear}</span>
          </div>
          <div class="grid grid-cols-3 gap-1 pt-0.5 text-center">
            <div>
              <span class="text-[9px] text-slate-400 block uppercase">Tertinggi</span>
              <span class="font-bold text-slate-700">${formatCurrency(ana.maxSpend)}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 block uppercase">Terendah</span>
              <span class="font-bold text-slate-700">${formatCurrency(ana.minSpend)}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 block uppercase">Rata-rata</span>
              <span class="font-bold text-slate-700">${formatCurrency(ana.avgSpend)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end pt-2 border-t border-slate-100">
        <button type="button" onclick="quickSetBudget('${cat.id}', ${budgetLimit})" class="h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold inline-flex items-center gap-1.5 transition">
          <i data-lucide="sliders" class="w-3.5 h-3.5"></i>
          <span>${budgetLimit > 0 ? 'Ubah Limit' : 'Atur Limit'}</span>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
  lucide.createIcons();
}

// ==================== PENGENDALI MODAL ATUR LIMIT ANGGARAN ====================
function populateBudgetModalCategoryOptions(selectedCatId = null) {
  const catSelect = document.getElementById('budget-cat-select');
  if (!catSelect) return;

  const expenseCatsSorted = categories.filter(c => c.type === 'expense').sort((a, b) => a.name.localeCompare(b.name, 'id'));
  
  catSelect.innerHTML = expenseCatsSorted.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  // Pilih kategori yang sesuai target (misal saat klik Ubah/Atur Limit dari kartu tertentu)
  if (selectedCatId && expenseCatsSorted.some(c => c.id === selectedCatId)) {
    catSelect.value = selectedCatId;
  } else if (catSelect.value && expenseCatsSorted.some(c => c.id === catSelect.value)) {
    // Pertahankan kategori yang sedang terpilih
  } else if (expenseCatsSorted.length > 0) {
    catSelect.value = expenseCatsSorted[0].id;
  }
}

function onBudgetModalCatSearch(query) {
  populateBudgetModalCategoryOptions(query);
  updateBudgetModalAnalytics();
}

function openSetBudgetModal(selectedCatId = null) {
  const monthInput = document.getElementById('budget-month-selector');
  const targetMonthStr = monthInput?.value || dashboardSelectedMonth;
  const parts = targetMonthStr.split('-').map(Number);
  const selYear = parts[0] || curYear;
  const selMonth = parts[1] || parseInt(curMonth);
  const monthLabel = `${monthNamesID[selMonth - 1]} ${selYear}`;

  setText('budget-scope-single-text', `Hanya Bulan Ini (${monthLabel})`);
  setText('budget-scope-year-text', `Seluruh 12 Bulan di Tahun ${selYear}`);

  // 1. Isi opsi kategori ke dalam dropdown dan pilih kategori target
  populateBudgetModalCategoryOptions(selectedCatId);

  // 2. Perbarui analitik historis & nilai limit
  updateBudgetModalAnalytics();

  // 3. Buka pop-up modal
  openModal('budget-modal');
  lucide.createIcons();
}
	
	function quickSetBudget(catId, currentVal) {
   openSetBudgetModal(catId);
}

async function deleteActiveBudget() {
  const catSelect = document.getElementById('budget-cat-select');
  const monthInput = document.getElementById('budget-month-selector');
  const targetMonthStr = monthInput?.value || dashboardSelectedMonth;
  const parts = targetMonthStr.split('-').map(Number);
  const selYear = parts[0] || curYear;
  const catId = catSelect?.value;
  const cat = categories.find(c => c.id === catId);
  const catName = cat ? cat.name : 'Kategori';

  const scope = document.querySelector('input[name="budget-apply-scope"]:checked')?.value || 'single';
  const scopeDesc = (scope === 'year') ? `seluruh 12 bulan di Tahun ${selYear}` : `bulan ${targetMonthStr}`;

  if (!(await showAppConfirm(`Hapus dan nonaktifkan limit anggaran untuk ${catName} pada ${scopeDesc}?`, 'Hapus Limit Anggaran'))) {
    return;
  }

  const oldLimit = budgets[targetMonthStr]?.[catId] || 0;

  if (scope === 'year') {
    for (let m = 1; m <= 12; m++) {
      const mKey = `${selYear}-${String(m).padStart(2, '0')}`;
      if (budgets[mKey]) {
        delete budgets[mKey][catId];
      }
    }
    budgetHistory.unshift({
      id: 'bh-' + Date.now(),
      timestamp: new Date().toISOString(),
      categoryName: catName,
      period: `Tahun ${selYear} (12 Bulan)`,
      oldLimit: oldLimit,
      newLimit: 0
    });
  } else {
    if (budgets[targetMonthStr]) {
      delete budgets[targetMonthStr][catId];
    }
    budgetHistory.unshift({
      id: 'bh-' + Date.now(),
      timestamp: new Date().toISOString(),
      categoryName: catName,
      period: targetMonthStr,
      oldLimit: oldLimit,
      newLimit: 0
    });
  }

  if (budgetHistory.length > 50) budgetHistory = budgetHistory.slice(0, 50);
  localStorage.setItem('vf_budget_history', JSON.stringify(budgetHistory));

  persistState(true);
  closeModal('budget-modal');
  renderBudgets();
}

function showBudgetOverrunNotification(info) {
  setText('overrun-modal-cat', info.catName);
  setText('overrun-modal-limit', formatCurrency(info.limitAmount));
  setText('overrun-modal-spent', `${formatCurrency(info.totalSpent)} (${info.pct}%)`);
  setText('overrun-modal-diff', `+${formatCurrency(info.overAmount)}`);

  openModal('budget-overrun-modal');
  lucide.createIcons();
}

function saveBudget(e) {
  e.preventDefault();
  const monthInput = document.getElementById('budget-month-selector');
  const targetMonthStr = monthInput?.value || dashboardSelectedMonth;
  const parts = targetMonthStr.split('-').map(Number);
  const selYear = parts[0] || curYear;

  const catId = document.getElementById('budget-cat-select')?.value;
  let rawVal = document.getElementById('budget-amount')?.value;
  // Jika input kosong namun ada placeholder acuan, gunakan nilai acuan tersebut
  if ((!rawVal || rawVal.trim() === '') && document.getElementById('budget-amount')?.placeholder) {
    rawVal = document.getElementById('budget-amount').placeholder;
  }
  const amount = parseDotsNumber(rawVal);
  const scope = document.querySelector('input[name="budget-apply-scope"]:checked')?.value || 'single';
	  
  if (catId) {
    const cat = categories.find(c => c.id === catId);
    const oldLimit = budgets[targetMonthStr]?.[catId] || 0;

    if (scope === 'year') {
      for (let m = 1; m <= 12; m++) {
        const mKey = `${selYear}-${String(m).padStart(2, '0')}`;
        if (!budgets[mKey]) budgets[mKey] = {};
        budgets[mKey][catId] = amount;
      }
      budgetHistory.unshift({
        id: 'bh-' + Date.now(),
        timestamp: new Date().toISOString(),
        categoryName: cat?.name || 'Kategori',
        period: `Tahun ${selYear} (12 Bulan)`,
        oldLimit: oldLimit,
        newLimit: amount
      });
    } else {
      if (!budgets[targetMonthStr]) budgets[targetMonthStr] = {};
      budgets[targetMonthStr][catId] = amount;

      budgetHistory.unshift({
        id: 'bh-' + Date.now(),
        timestamp: new Date().toISOString(),
        categoryName: cat?.name || 'Kategori',
        period: targetMonthStr,
        oldLimit: oldLimit,
        newLimit: amount
      });
    }

    if (budgetHistory.length > 50) budgetHistory = budgetHistory.slice(0, 50);
    localStorage.setItem('vf_budget_history', JSON.stringify(budgetHistory));

    persistState(true);
    closeModal('budget-modal');
    renderBudgets();
  }
}

function openBudgetHistoryModal() {
  const tbody = document.getElementById('budget-history-tbody');
  const noMsg = document.getElementById('no-budget-history-msg');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (budgetHistory.length === 0) {
    if (noMsg) noMsg.classList.remove('hidden');
  } else {
    if (noMsg) noMsg.classList.add('hidden');
    tbody.innerHTML = budgetHistory.map(item => {
      const t = new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
      const diff = item.newLimit - item.oldLimit;
      const isRaised = diff > 0;
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">${t}</td>
          <td class="px-3.5 py-2.5 font-bold text-slate-800">${escapeHtml(item.categoryName)}</td>
          <td class="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">${escapeHtml(item.period)}</td>
          <td class="px-3.5 py-2.5 text-right whitespace-nowrap">
            <span class="text-slate-400 line-through text-[10px] mr-1">${formatCurrency(item.oldLimit)}</span>
            <span class="font-bold text-slate-900">${formatCurrency(item.newLimit)}</span>
            <span class="text-[9px] font-extrabold ml-1 px-1.5 py-0.5 rounded ${isRaised ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              ${isRaised ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  openModal('budget-history-modal');
  lucide.createIcons();
}

function resetBudgetFilterAndSort() {
  // 1. Kosongkan teks di search box
  setVal('budget-search-input', '');
  
  // 2. Sembunyikan ikon silang (x) pembersih search
  const clearBtn = document.getElementById('budget-search-clear');
  if (clearBtn) clearBtn.classList.add('hidden');

  // 3. Kembalikan filter klasifikasi dan urutan ke awal
  setVal('budget-filter-class', 'ALL');
  setVal('budget-sort-name', 'default');

  // 4. Render ulang seluruh kartu anggaran
  renderBudgets();
}
	
	function clearBudgetSearch() {
  setVal('budget-search-input', '');
  const clearBtn = document.getElementById('budget-search-clear');
  if (clearBtn) clearBtn.classList.add('hidden');
  const searchInput = document.getElementById('budget-search-input');
  if (searchInput) searchInput.focus();
  renderBudgets();
}

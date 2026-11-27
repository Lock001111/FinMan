// ==================== Financial Analysis, Emergency Fund, Habit Calendar & Weekly Burn Rate ====================

// ==================== TAB 3: FINANCIAL ANALYSIS ====================
function setAnalysisScope(scope) {
  // Reset sorotan kalender dan status expand saat berganti antara mode Bulanan dan Tahunan
  activeHighlightedHabitItem = null;
  isHabitTrackerExpanded = false;

  analysisScope = scope;
  const btnM = document.getElementById('btn-ana-scope-month');
  const btnY = document.getElementById('btn-ana-scope-year');
  const wrapM = document.getElementById('ana-month-wrap');
  const wrapY = document.getElementById('ana-year-wrap');

  if (scope === 'month') {
    if (btnM) btnM.className = 'px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white transition';
    if (btnY) btnY.className = 'px-3 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900 transition';
    if (wrapM) wrapM.classList.remove('hidden');
    if (wrapY) wrapY.classList.add('hidden');
  } else {
    if (btnY) btnY.className = 'px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white transition';
    if (btnM) btnM.className = 'px-3 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900 transition';
    if (wrapY) wrapY.classList.remove('hidden');
    if (wrapM) wrapM.classList.add('hidden');
  }
  renderAnalysisView();
}

function renderAnalysisView() {
  let filterPrefix = '';
  if (analysisScope === 'month') {
    filterPrefix = document.getElementById('analysis-month-picker')?.value || dashboardSelectedMonth;
  } else {
    filterPrefix = document.getElementById('analysis-year-picker')?.value || String(curYear);
  }

  const periodTxs = transactions.filter(t => t.date && t.date.startsWith(filterPrefix));

  let totalInflow = 0;
  let totalOutflow = 0;
  let fixedIncome = 0;
  let dynamicIncome = 0;
  let fixedExpense = 0;
  let periodicExpense = 0;
  let dynamicExpense = 0;

  periodTxs.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    const cat = categories.find(c => c.id === t.categoryId);
    const cls = cat?.expenseClass || 'dynamic';

    if (t.type === 'income') {
      totalInflow += amt;
      if (cls === 'fixed') fixedIncome += amt;
      else dynamicIncome += amt;
    } else if (t.type === 'expense') {
      totalOutflow += amt;
      if (cls === 'fixed') fixedExpense += amt;
      else if (cls === 'periodic') periodicExpense += amt;
      else dynamicExpense += amt;
    } else if (t.type === 'transfer') {
      const fee = parseFloat(t.adminFee) || 0;
      if (fee > 0) {
        totalOutflow += fee;
        dynamicExpense += fee;
      }
    }
  });

  const netCashFlow = totalInflow - totalOutflow;
  const savingRatio = totalInflow > 0 ? ((netCashFlow / totalInflow) * 100) : 0;

  const netEl = document.getElementById('ana-net-cashflow');
  if (netEl) {
    if (dashPrivacy.income || dashPrivacy.expense) {
      netEl.textContent = 'Rp ••••••';
      netEl.className = 'text-2xl font-bold mt-2 text-slate-800';
    } else {
      netEl.textContent = (netCashFlow >= 0 ? '+' : '') + formatCurrency(netCashFlow);
      netEl.className = `text-2xl font-bold mt-2 ${netCashFlow >= 0 ? 'text-slate-900' : 'text-rose-600'}`;
    }
  }

  setText('ana-total-inflow', dashPrivacy.income ? 'Rp ••••••' : `+${formatCurrency(totalInflow)}`);
  setText('ana-inflow-fixed-desc', dashPrivacy.income ? 'Tetap: Rp •••••• | Dinamis: Rp ••••••' : `Tetap: ${formatCurrency(fixedIncome)} | Dinamis: ${formatCurrency(dynamicIncome)}`);
  setText('ana-total-outflow', dashPrivacy.expense ? 'Rp ••••••' : `-${formatCurrency(totalOutflow)}`);

  const savingRatioEl = document.getElementById('ana-saving-ratio');
  const badgeEl = document.getElementById('ana-saving-badge');
  const descEl = document.getElementById('ana-saving-desc');

  if (savingRatioEl) {
    savingRatioEl.textContent = (dashPrivacy.income || dashPrivacy.expense) ? '••%' : `${savingRatio.toFixed(1)}%`;
  }
  if (badgeEl && descEl) {
    if (savingRatio >= 30) {
      badgeEl.textContent = 'Sangat Sehat';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
      descEl.textContent = 'Alokasi tabungan optimal (>30%).';
    } else if (savingRatio >= 20) {
      badgeEl.textContent = 'Sehat';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800';
      descEl.textContent = 'Memenuhi standar 50/30/20.';
    } else if (savingRatio >= 10) {
      badgeEl.textContent = 'Cukup';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800';
      descEl.textContent = 'Masih surplus, bisa ditingkatkan.';
    } else if (savingRatio >= 0) {
      badgeEl.textContent = 'Waspada (<10%)';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800';
      descEl.textContent = 'Tabungan tipis untuk dana darurat.';
    } else {
      badgeEl.textContent = 'Defisit';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800';
      descEl.textContent = 'Pengeluaran melebihi pemasukan!';
    }
  }

  const fixedPct = totalOutflow > 0 ? ((fixedExpense / totalOutflow) * 100).toFixed(1) : 0;
  const periodicPct = totalOutflow > 0 ? ((periodicExpense / totalOutflow) * 100).toFixed(1) : 0;
  const dynamicPct = totalOutflow > 0 ? ((dynamicExpense / totalOutflow) * 100).toFixed(1) : 0;

  setText('ana-fixed-exp', dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(fixedExpense));
  setText('ana-fixed-pct', `${fixedPct}% dari pengeluaran`);
  setText('ana-periodic-exp', dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(periodicExpense));
  setText('ana-periodic-pct', `${periodicPct}% dari pengeluaran`);
  setText('ana-dynamic-exp', dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(dynamicExpense));
  setText('ana-dynamic-pct', `${dynamicPct}% dari pengeluaran`);

  const setWidth = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = `${pct}%`; };
  setWidth('bar-fixed', fixedPct);
  setWidth('bar-periodic', periodicPct);
  setWidth('bar-dynamic', dynamicPct);

  const expenseTxs = periodTxs.filter(t => t.type === 'expense');
  const rankedList = [...expenseTxs].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 5);
  const rankContainer = document.getElementById('analysis-ranking-list');
  
  if (rankContainer) {
    if (rankedList.length === 0) {
      rankContainer.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center">Belum ada pengeluaran pada periode ini.</div>`;
    } else {
      rankContainer.innerHTML = rankedList.map((tx, idx) => {
        const cat = categories.find(c => c.id === tx.categoryId)?.name || 'Kategori';
        const pct = totalOutflow > 0 ? ((parseFloat(tx.amount) / totalOutflow) * 100).toFixed(1) : 0;
        return `
          <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
            <div class="flex items-center gap-3">
              <span class="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">#${idx + 1}</span>
              <div>
                <div class="text-sm font-bold text-slate-800">${escapeHtml(tx.note) || escapeHtml(cat)}</div>
                <div class="text-xs text-slate-400">${escapeHtml(tx.date)} • ${escapeHtml(cat)}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-rose-600">${formatCurrency(tx.amount)}</div>
              <div class="text-[10px] text-slate-400 font-semibold">${pct}% total belanja</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const categoryAverages = {};
  categories.filter(c => c.type === 'expense').forEach(c => {
    const catTxs = transactions.filter(t => t.type === 'expense' && t.categoryId === c.id);
    const catSum = catTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    categoryAverages[c.id] = catTxs.length > 0 ? (catSum / catTxs.length) : 0;
  });

  const abnormalTxs = expenseTxs.filter(tx => {
    const avg = categoryAverages[tx.categoryId] || 0;
    const amt = parseFloat(tx.amount) || 0;
    return (avg > 0 && amt > (2.5 * avg) && amt >= 150000);
  });

  const abnormalContainer = document.getElementById('analysis-abnormal-list');
  if (abnormalContainer) {
    if (abnormalTxs.length === 0) {
      abnormalContainer.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center">Pengeluaran teratur. Tidak ada anomali lonjakan ekstrem.</div>`;
    } else {
      abnormalContainer.innerHTML = abnormalTxs.map(tx => {
        const cat = categories.find(c => c.id === tx.categoryId)?.name || 'Kategori';
        const avg = categoryAverages[tx.categoryId] || 0;
        const ratio = (parseFloat(tx.amount) / avg).toFixed(1);
        return `
          <div class="p-2.5 rounded-xl border border-rose-100 bg-rose-50/50 flex items-center justify-between">
            <div>
              <div class="text-xs font-bold text-rose-900">${escapeHtml(tx.note) || cat} (${tx.date})</div>
              <div class="text-[11px] text-rose-700 font-medium">Melompat <strong>${ratio}x lebih besar</strong> dari rata-rata ${cat} (${formatCurrency(avg)})</div>
            </div>
            <div class="text-right">
              <span class="text-xs font-bold text-rose-800">${formatCurrency(tx.amount)}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
	  
	  // ==================== KALKULATOR DANA DARURAT (IDE #5) ====================
  let totalLiquidAssets = 0;
  accounts.forEach(a => {
    if (['Bank', 'E-Wallet', 'Cash'].includes(a.type)) {
      totalLiquidAssets += (parseFloat(a.initialBalance) || 0);
    }
  });
  // Hitung mutasi aset likuid
  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;
    if (tx.type === 'income') totalLiquidAssets += amt;
    else if (tx.type === 'expense') totalLiquidAssets -= amt;
    else if (tx.type === 'transfer' && fee > 0) totalLiquidAssets -= fee;
  });

  // Biaya hidup wajib per bulan = Pengeluaran Tetap + Pengeluaran Berkala (dibagi bulan berjalan jika mode tahunan)
  const emergencyDivisor = analysisScope === 'year'
    ? Math.max(1, getElapsedMonthsCount(parseInt(filterPrefix) || curYear))
    : 1;
  const mandatoryMonthlyCost = ((fixedExpense + periodicExpense) || totalOutflow || emergencyDivisor) / emergencyDivisor;
  const survivalMonths = Math.max(0, (totalLiquidAssets / mandatoryMonthlyCost)).toFixed(1);

  setText('emg-fund-liquid', formatCurrency(totalLiquidAssets));
  setText('emg-fund-cost', formatCurrency(mandatoryMonthlyCost));
  setText('emg-fund-months', `${survivalMonths} Bulan`);

  const emgBadge = document.getElementById('emg-fund-badge');
  const emgEval = document.getElementById('emg-fund-eval');
  const emgProgress = document.getElementById('emg-fund-progress');

  if (emgBadge && emgEval && emgProgress) {
    const pct = Math.min(100, Math.round((survivalMonths / 6) * 100));
    emgProgress.style.width = `${pct}%`;

    if (survivalMonths >= 6) {
      emgBadge.textContent = 'Sangat Kuat (Ideal)';
      emgBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
      emgEval.textContent = 'Dana darurat sangat kokoh (> 6 bulan biaya hidup).';
    } else if (survivalMonths >= 3) {
      emgBadge.textContent = 'Sehat & Cukup';
      emgBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300';
      emgEval.textContent = 'Memenuhi standar keamanan darurat (3–6 bulan).';
    } else if (survivalMonths >= 1) {
      emgBadge.textContent = 'Perlu Waspada';
      emgBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300';
      emgEval.textContent = 'Hanya cukup bertahan 1–2 bulan. Tingkatkan tabungan.';
    } else {
      emgBadge.textContent = 'Kritis (< 1 Bulan)';
      emgBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300';
      emgEval.textContent = 'Rentan terhadap guncangan finansial mendadak.';
    }
  }

  // ==================== RENDER KALENDER DOT & HABIT TRACKER ====================
  renderAnalysisCalendarDots(filterPrefix, periodTxs);
  renderAnalysisHabitTracker(periodTxs);

  renderAnalysisSummaryBreakdown(filterPrefix, periodTxs);
  lucide.createIcons();
}

function drillDownToAnalysisMonth(year, monthNum) {
  setAnalysisScope('month');
  const mStr = `${year}-${String(monthNum).padStart(2, '0')}`;
  setVal('analysis-month-picker', mStr);
  renderAnalysisView();
  const card = document.getElementById('ana-breakdown-container');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleAnalysisCategoryExpand(catId) {
  activeExpandedAnalysisCatId = (activeExpandedAnalysisCatId === catId) ? null : catId;

  let filterPrefix = '';
  if (analysisScope === 'month') {
    filterPrefix = document.getElementById('analysis-month-picker')?.value || dashboardSelectedMonth;
  } else {
    filterPrefix = document.getElementById('analysis-year-picker')?.value || String(curYear);
  }

  const periodTxs = transactions.filter(t => t.date && t.date.startsWith(filterPrefix) && t.type !== 'transfer');
  renderAnalysisSummaryBreakdown(filterPrefix, periodTxs);
  lucide.createIcons();
}

function sortMonthlyAnalysisCategories(by) {
  if (monthlyCatSort.by === by) {
    monthlyCatSort.dir = monthlyCatSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    monthlyCatSort.by = by;
    monthlyCatSort.dir = 'desc';
  }
  renderAnalysisView();
}

function sortYearlyAnalysisCategories(by) {
  if (yearlyCatSort.by === by) {
    yearlyCatSort.dir = yearlyCatSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    yearlyCatSort.by = by;
    yearlyCatSort.dir = 'desc';
  }
  renderAnalysisView();
}

function renderAnalysisSummaryBreakdown(filterPrefix, periodTxs) {
  const container = document.getElementById('ana-breakdown-content');
  const titleEl = document.getElementById('ana-breakdown-title');
  const subEl = document.getElementById('ana-breakdown-subtitle');
  const badgeEl = document.getElementById('ana-breakdown-badge');
  if (!container) return;

  if (analysisScope === 'month') {
    const parts = filterPrefix.split('-').map(Number);
    const selYear = parts[0] || curYear;
    const selMonth = parts[1] || parseInt(curMonth);
    const monthLabel = `${monthNamesID[selMonth - 1]} ${selYear}`;

    if (titleEl) titleEl.innerHTML = `<i data-lucide="pie-chart" class="w-4 h-4 text-emerald-600 inline mr-1"></i> Rincian Kategori & Subkategori (${monthLabel})`;
    if (subEl) subEl.textContent = 'Klik baris kategori untuk melihat subkategori. Biaya admin transfer dihitung sebagai pengeluaran.';
    if (badgeEl) badgeEl.textContent = 'Mode Bulanan';

    const expCatSums = {};
    const incCatSums = {};
    const expSubSums = {};
    const incSubSums = {};

    // Variabel penghitung frekuensi transaksi
    const expCatCounts = {};
    const incCatCounts = {};
    const expSubCounts = {};
    const incSubCounts = {};

    let totalExp = 0, totalInc = 0;
    let totalTransferAdminFee = 0;

    periodTxs.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      const fee = parseFloat(t.adminFee) || 0;

      if (t.type === 'transfer') {
        if (fee > 0) {
          totalExp += fee;
          totalTransferAdminFee += fee;
        }
        return;
      }

      let cat = categories.find(c => c.id === t.categoryId);
      if (cat && cat.type !== t.type) {
        const altCat = categories.find(c => c.name.toLowerCase() === cat.name.toLowerCase() && c.type === t.type);
        if (altCat) cat = altCat;
      }
      const catId = cat ? cat.id : t.categoryId;
      const subKey = (t.subcategory && t.subcategory.trim()) ? t.subcategory.trim() : 'Tanpa Subkategori';

      if (t.type === 'expense') {
        totalExp += amt;
        expCatSums[catId] = (expCatSums[catId] || 0) + amt;
        expCatCounts[catId] = (expCatCounts[catId] || 0) + 1;

        if (!expSubSums[catId]) expSubSums[catId] = {};
        if (!expSubCounts[catId]) expSubCounts[catId] = {};
        expSubSums[catId][subKey] = (expSubSums[catId][subKey] || 0) + amt;
        expSubCounts[catId][subKey] = (expSubCounts[catId][subKey] || 0) + 1;

      } else if (t.type === 'income') {
        totalInc += amt;
        incCatSums[catId] = (incCatSums[catId] || 0) + amt;
        incCatCounts[catId] = (incCatCounts[catId] || 0) + 1;

        if (!incSubSums[catId]) incSubSums[catId] = {};
        if (!incSubCounts[catId]) incSubCounts[catId] = {};
        incSubSums[catId][subKey] = (incSubSums[catId][subKey] || 0) + amt;
        incSubCounts[catId][subKey] = (incSubCounts[catId][subKey] || 0) + 1;
      }
    });

    let expenseCats = categories.filter(c => c.type === 'expense' && (expCatSums[c.id] || 0) > 0);
    let incomeCats = categories.filter(c => c.type === 'income' && (incCatSums[c.id] || 0) > 0);

    const sortCatList = (cats, sumMap) => {
      return [...cats].sort((a, b) => {
        if (monthlyCatSort.by === 'name') {
          return monthlyCatSort.dir === 'asc' ? a.name.localeCompare(b.name, 'id') : b.name.localeCompare(a.name, 'id');
        } else {
          const valA = sumMap[a.id] || 0;
          const valB = sumMap[b.id] || 0;
          return monthlyCatSort.dir === 'asc' ? valA - valB : valB - valA;
        }
      });
    };

    expenseCats = sortCatList(expenseCats, expCatSums);
    incomeCats = sortCatList(incomeCats, incCatSums);

    const renderCategoryBlock = (cats, sumMap, subMapCollection, totalAmount, isExpense) => {
      if (cats.length === 0) {
        return `<div class="py-4 text-center text-slate-400 italic text-xs">Belum ada transaksi ${isExpense ? 'pengeluaran' : 'pemasukan'} di bulan ini.</div>`;
      }

      return cats.map(c => {
        const val = sumMap[c.id] || 0;
        const pct = totalAmount > 0 ? ((val / totalAmount) * 100).toFixed(1) : 0;
        const isExpanded = (activeExpandedAnalysisCatId === c.id);
        const subMap = subMapCollection[c.id] || {};
        const subKeys = Object.keys(subMap).sort((a, b) => subMap[b] - subMap[a]);
        const catCount = (isExpense ? expCatCounts[c.id] : incCatCounts[c.id]) || 0;

        return `
          <div class="py-1.5 border-b border-slate-100 last:border-b-0">
            <div onclick="toggleAnalysisCategoryExpand('${c.id}')" class="flex items-center justify-between cursor-pointer select-none p-1.5 -mx-1.5 rounded-lg hover:bg-slate-100/70 transition">
              <div class="flex items-center gap-2">
                <span class="p-1 rounded-md text-slate-400 group-hover:text-emerald-600 transition shrink-0">
                  <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-emerald-600"></i>
                </span>
                <div>
                  <span class="font-semibold text-slate-800 text-xs sm:text-sm">${escapeHtml(c.name)}</span>
                  <span class="text-[10px] text-slate-400 block">${catCount}x transaksi • ${pct}% total</span>
                </div>
              </div>
              <span class="font-bold text-xs sm:text-sm ${isExpense ? 'text-rose-600' : 'text-emerald-600'}">
                ${dashPrivacy[isExpense ? 'expense' : 'income'] ? 'Rp ••••••' : formatCurrency(val)}
              </span>
            </div>

            ${isExpanded ? `
              <div class="mt-1 ml-6 pl-3 border-l-2 border-emerald-400 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5 shadow-sm">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rincian Subkategori (${escapeHtml(c.name)}):</div>
                ${subKeys.length > 0 ? subKeys.map(subKey => {
                  const subVal = subMap[subKey];
                  const subPct = val > 0 ? ((subVal / val) * 100).toFixed(1) : 0;
                  const subCount = (isExpense ? expSubCounts[c.id]?.[subKey] : incSubCounts[c.id]?.[subKey]) || 0;

                  return `
                    <div class="flex items-center justify-between text-[11px] py-0.5">
                      <span class="text-slate-600">${escapeHtml(subKey)} <span class="text-[10px] text-slate-400">(${subCount}x • ${subPct}%)</span></span>
                      <span class="font-semibold text-slate-800">${dashPrivacy[isExpense ? 'expense' : 'income'] ? 'Rp ••••••' : formatCurrency(subVal)}</span>
                    </div>
                  `;
                }).join('') : `<div class="text-[11px] text-slate-400 italic">Belum ada transaksi di subkategori ini.</div>`}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    };

    const adminFeePct = totalExp > 0 ? ((totalTransferAdminFee / totalExp) * 100).toFixed(1) : 0;

    container.innerHTML = `
      <div class="flex items-center justify-end gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/80 mb-3 text-xs">
        <span class="text-slate-400 font-semibold text-[11px] mr-1">Urutkan Kategori:</span>
        <button onclick="sortMonthlyAnalysisCategories('name')" class="px-2.5 py-1 rounded-lg border transition ${monthlyCatSort.by === 'name' ? 'bg-white border-slate-300 text-emerald-700 font-bold shadow-sm' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'}">
          Nama ${monthlyCatSort.by === 'name' ? (monthlyCatSort.dir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button onclick="sortMonthlyAnalysisCategories('nominal')" class="px-2.5 py-1 rounded-lg border transition ${monthlyCatSort.by === 'nominal' ? 'bg-white border-slate-300 text-emerald-700 font-bold shadow-sm' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'}">
          Nominal ${monthlyCatSort.by === 'nominal' ? (monthlyCatSort.dir === 'asc' ? '↑' : '↓') : ''}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        <!-- Kolom Pengeluaran per Kategori -->
        <div class="space-y-2 border border-rose-100 bg-rose-50/20 p-3.5 rounded-xl">
          <div class="flex items-center justify-between text-xs font-bold text-rose-900 border-b border-rose-100 pb-2">
            <span>Kategori Pengeluaran</span>
            <span>Total (${dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(totalExp)})</span>
          </div>
          <div class="text-xs">
            ${renderCategoryBlock(expenseCats, expCatSums, expSubSums, totalExp, true)}
            ${totalTransferAdminFee > 0 ? `
              <div class="py-2 flex items-center justify-between border-t border-rose-200/60 mt-1 pt-2 bg-rose-50/40 px-2 rounded-lg">
                <div class="flex items-center gap-2">
                  <span class="p-1 rounded-md text-rose-600 shrink-0">
                    <i data-lucide="arrow-right-left" class="w-4 h-4"></i>
                  </span>
                  <div>
                    <span class="font-bold text-slate-800 text-xs sm:text-sm">Biaya Admin Transfer</span>
                    <span class="text-[10px] text-slate-400 block">${adminFeePct}% dari pengeluaran</span>
                  </div>
                </div>
                <span class="font-bold text-xs sm:text-sm text-rose-600">
                  ${dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(totalTransferAdminFee)}
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Kolom Pemasukan per Kategori -->
        <div class="space-y-2 border border-emerald-100 bg-emerald-50/20 p-3.5 rounded-xl">
          <div class="flex items-center justify-between text-xs font-bold text-emerald-900 border-b border-emerald-100 pb-2">
            <span>Kategori Pemasukan</span>
            <span>Total (${dashPrivacy.income ? 'Rp ••••••' : formatCurrency(totalInc)})</span>
          </div>
          <div class="text-xs">
            ${renderCategoryBlock(incomeCats, incCatSums, incSubSums, totalInc, false)}
          </div>
        </div>
      </div>
    `;
  } else {
    // Mode Tahunan
    const targetYear = filterPrefix || String(curYear);
    if (titleEl) titleEl.innerHTML = `<i data-lucide="calendar" class="w-4 h-4 text-emerald-600 inline mr-1"></i> Rangkuman Arus Kas 12 Bulan (Tahun ${targetYear})`;
    if (subEl) subEl.textContent = 'Klik pada baris bulan untuk melihat analisis mendalam bulan tersebut.';
    if (badgeEl) badgeEl.textContent = 'Mode Tahunan';

    const monthRows = [];
    for (let m = 1; m <= 12; m++) {
      const mKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      let mIn = 0, mOut = 0;
      transactions.filter(t => t.date && t.date.startsWith(mKey)).forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') mIn += amt;
        else if (t.type === 'expense') mOut += amt;
        else if (t.type === 'transfer') {
          mOut += (parseFloat(t.adminFee) || 0);
        }
      });
      const mNet = mIn - mOut;
      monthRows.push({ mNum: m, mName: monthNamesID[m - 1], in: mIn, out: mOut, net: mNet });
    }

    const targetYearNum = parseInt(targetYear) || curYear;
    const elapsed = getElapsedMonthsCount(targetYearNum);
    const divisor = Math.max(1, elapsed);

    const catAverages = categories.map(c => {
      const totalCatSpend = transactions.reduce((sum, tx) => {
        if (tx.type === c.type && tx.categoryId === c.id && tx.date && tx.date.startsWith(targetYear)) {
          return sum + (parseFloat(tx.amount) || 0);
        }
        return sum;
      }, 0);
      const avgSpend = elapsed > 0 ? (totalCatSpend / divisor) : 0;
      return { id: c.id, name: c.name, type: c.type, total: totalCatSpend, avg: avgSpend };
    });

		const avgSubtitle = (targetYearNum === new Date().getFullYear() && elapsed < 12)
      ? `Total nominal dibagi ${elapsed} bulan yang telah berjalan.`
      : `Total nominal tahunan dibagi 12 bulan sebagai referensi anggaran.`;

    catAverages.sort((a, b) => {
      if (yearlyCatSort.by === 'name') {
        return yearlyCatSort.dir === 'asc' ? a.name.localeCompare(b.name, 'id') : b.name.localeCompare(a.name, 'id');
      } else {
        return yearlyCatSort.dir === 'asc' ? a.avg - b.avg : b.avg - a.avg;
      }
    });

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50 uppercase text-[10px] text-slate-400 border-b border-slate-200">
            <tr>
              <th class="px-3.5 py-2.5">Bulan</th>
              <th class="px-3.5 py-2.5 text-right">Pemasukan</th>
              <th class="px-3.5 py-2.5 text-right">Pengeluaran</th>
              <th class="px-3.5 py-2.5 text-right">Arus Kas Bersih</th>
              <th class="px-3.5 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${monthRows.map(r => `
              <tr onclick="drillDownToAnalysisMonth('${targetYear}', ${r.mNum})" class="hover:bg-emerald-50/70 cursor-pointer transition group">
                <td class="px-3.5 py-2.5 font-bold text-slate-800 flex items-center gap-1.5">
                  <span class="group-hover:text-emerald-700">${r.mName}</span>
                </td>
                <td class="px-3.5 py-2.5 text-right text-emerald-600 font-semibold">${dashPrivacy.income ? 'Rp ••••••' : `+${formatCurrency(r.in)}`}</td>
                <td class="px-3.5 py-2.5 text-right text-rose-600 font-semibold">${dashPrivacy.expense ? 'Rp ••••••' : `-${formatCurrency(r.out)}`}</td>
                <td class="px-3.5 py-2.5 text-right font-bold ${r.net >= 0 ? 'text-slate-900' : 'text-rose-600'}">${(dashPrivacy.income || dashPrivacy.expense) ? 'Rp ••••••' : (r.net >= 0 ? '+' : '') + formatCurrency(r.net)}</td>
                <td class="px-3.5 py-2.5 text-center">
                  <span class="text-[11px] font-semibold text-emerald-600 group-hover:underline flex items-center justify-center gap-0.5">
                    Buka <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="pt-4 border-t border-slate-100 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <i data-lucide="calculator" class="w-4 h-4 text-emerald-600"></i> Rata-Rata Kategori per Bulan (Tahun ${targetYear})
            </h4>
            <p class="text-[11px] text-slate-400">${avgSubtitle}</p>
          </div>

          <div class="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 text-xs font-semibold self-start sm:self-auto">
            <span class="text-slate-400 text-[11px] px-1">Urutkan:</span>
            <button type="button" onclick="sortYearlyAnalysisCategories('name')" class="px-2.5 py-1 rounded-lg border transition ${yearlyCatSort.by === 'name' ? 'bg-white border-slate-300 text-emerald-700 shadow-sm font-bold' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'}">
              Nama ${yearlyCatSort.by === 'name' ? (yearlyCatSort.dir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button type="button" onclick="sortYearlyAnalysisCategories('nominal')" class="px-2.5 py-1 rounded-lg border transition ${yearlyCatSort.by === 'nominal' ? 'bg-white border-slate-300 text-emerald-700 shadow-sm font-bold' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'}">
              Nominal ${yearlyCatSort.by === 'nominal' ? (yearlyCatSort.dir === 'asc' ? '↑' : '↓') : ''}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          ${catAverages.map(c => `
            <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-800 block truncate max-w-[130px]">${escapeHtml(c.name)}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold ${c.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold ${c.type === 'income' ? 'text-emerald-600' : 'text-rose-600'} block">
                  ${dashPrivacy[c.type === 'income' ? 'income' : 'expense'] ? 'Rp ••••••' : formatCurrency(c.avg)}
                </span>
                <span class="text-[9px] text-slate-400">per bulan</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  lucide.createIcons();
}
	
// ==================== STATE PENANDAAN TANGGAL KATEGORI ====================
let activeHighlightedHabitItem = null;

function toggleHabitHighlight(itemName) {
  if (activeHighlightedHabitItem && activeHighlightedHabitItem.toLowerCase() === itemName.toLowerCase()) {
    activeHighlightedHabitItem = null; // Batal sorot jika diklik ulang
  } else {
    activeHighlightedHabitItem = itemName; // Set item yang disorot
  }

  // Render ulang kalender dan daftar frekuensi agar efek visual langsung terpasang
  let filterPrefix = '';
  if (analysisScope === 'month') {
    filterPrefix = document.getElementById('analysis-month-picker')?.value || dashboardSelectedMonth;
  } else {
    filterPrefix = document.getElementById('analysis-year-picker')?.value || String(curYear);
  }
  const periodTxs = transactions.filter(t => t.date && t.date.startsWith(filterPrefix));

  renderAnalysisCalendarDots(filterPrefix, periodTxs);
  renderAnalysisHabitTracker(periodTxs);
}

function clearHabitHighlight() {
  activeHighlightedHabitItem = null;
  let filterPrefix = '';
  if (analysisScope === 'month') {
    filterPrefix = document.getElementById('analysis-month-picker')?.value || dashboardSelectedMonth;
  } else {
    filterPrefix = document.getElementById('analysis-year-picker')?.value || String(curYear);
  }
  const periodTxs = transactions.filter(t => t.date && t.date.startsWith(filterPrefix));

  renderAnalysisCalendarDots(filterPrefix, periodTxs);
  renderAnalysisHabitTracker(periodTxs);
}

// ==================== KALENDER DOT INTERAKTIF / KALENDER BULANAN TAHUNAN ====================
function renderAnalysisCalendarDots(filterPrefix, periodTxs) {
  const grid = document.getElementById('ana-calendar-grid');
  if (!grid) return;

  if (analysisScope === 'year') {
    renderAnalysisMonthlyCalendar(filterPrefix, periodTxs);
    return;
  }

  // Pastikan mode Bulanan menampilkan header hari, legenda titik, dan grid 7 kolom
  setText('ana-calendar-title-text', 'Kalender Aktivitas Transaksi');
  setText('ana-calendar-subtitle', 'Ketuk tanggal bertitik untuk rincian, atau ketuk item frekuensi untuk menandai tanggalnya.');
  const legendEl = document.getElementById('ana-calendar-legend');
  const weekdaysEl = document.getElementById('ana-calendar-weekdays');
  if (legendEl) legendEl.classList.remove('hidden');
  if (weekdaysEl) weekdaysEl.classList.remove('hidden');
  grid.className = 'grid grid-cols-7 gap-1.5 pt-1';

  const parts = filterPrefix.split('-').map(Number);
  const year = parts[0] || curYear;
  const month = (parts[1] || parseInt(curMonth)) - 1;

  // 1. Tampilkan Nama Bulan & Tahun secara dinamis pada Header Kalender
  setText('ana-calendar-month-year', `${monthNamesID[month]} ${year}`);

  // 2. Kelola Banner Sorotan
  const highlightBanner = document.getElementById('ana-calendar-highlight-banner');
  const highlightNameEl = document.getElementById('ana-calendar-highlight-name');
  if (highlightBanner && highlightNameEl) {
    if (activeHighlightedHabitItem) {
      highlightNameEl.textContent = activeHighlightedHabitItem;
      highlightBanner.classList.remove('hidden');
    } else {
      highlightBanner.classList.add('hidden');
    }
  }

  const firstDayIdx = (new Date(year, month, 1).getDay() + 6) % 7; // Mulai Senin (0=Senin, 6=Minggu)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Kumpulkan transaksi per tanggal
  const dayTransactionsMap = {};
  periodTxs.forEach(tx => {
    if (!tx.date) return;
    if (!dayTransactionsMap[tx.date]) {
      dayTransactionsMap[tx.date] = { hasExpense: false, hasIncome: false, hasTransfer: false, txs: [] };
    }
    if (tx.type === 'expense') dayTransactionsMap[tx.date].hasExpense = true;
    else if (tx.type === 'income') dayTransactionsMap[tx.date].hasIncome = true;
    else if (tx.type === 'transfer') {
      dayTransactionsMap[tx.date].hasTransfer = true;
      if (parseFloat(tx.adminFee) > 0) dayTransactionsMap[tx.date].hasExpense = true;
    }
    dayTransactionsMap[tx.date].txs.push(tx);
  });

  const todayStr = getLocalDateStr();
  let html = '';

  for (let i = 0; i < firstDayIdx; i++) {
    html += `<div class="h-11 rounded-xl bg-slate-50/40 opacity-30"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = dayTransactionsMap[dStr];
    const isToday = (dStr === todayStr);

    // Periksa apakah di tanggal ini terdapat transaksi dari item yang sedang disorot
    let isHighlightedDate = false;
    if (activeHighlightedHabitItem && data && data.txs.length > 0) {
      isHighlightedDate = data.txs.some(tx => {
        const subMatch = (tx.subcategory || '').trim().toLowerCase() === activeHighlightedHabitItem.trim().toLowerCase();
        const cat = categories.find(c => c.id === tx.categoryId);
        const catMatch = cat && cat.name.trim().toLowerCase() === activeHighlightedHabitItem.trim().toLowerCase();
        return subMatch || catMatch;
      });
    }

    let dotsHtml = '';
    if (data) {
      const dots = [];
      if (data.hasExpense) dots.push('<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>');
      if (data.hasIncome) dots.push('<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>');
      if (data.hasTransfer) dots.push('<span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>');

      if (dots.length > 0) {
        dotsHtml = `<div class="flex items-center gap-1 mt-0.5">${dots.join('')}</div>`;
      }
    }

    const clickable = Boolean(data);

    // Penentuan Hari dalam Minggu (0=Senin, 1=Selasa, ..., 5=Sabtu, 6=Minggu)
    const dayOfWeek = (firstDayIdx + (d - 1)) % 7;
    const isSaturday = (dayOfWeek === 5);
    const isSunday = (dayOfWeek === 6);

    // Penentuan gaya kotak tanggal
    let cellStyleClass = '';
    if (isHighlightedDate) {
      // Sorotan aktif kategori bernilai prioritas tertinggi
      cellStyleClass = 'cursor-pointer bg-amber-100 border-2 border-amber-500 ring-2 ring-amber-300 text-amber-950 font-black shadow-md scale-102';
    } else if (clickable) {
      // Tanggal yang ada transaksinya
      if (isSunday) {
        cellStyleClass = 'cursor-pointer bg-rose-50/70 border-rose-200 hover:bg-rose-100 text-rose-900 shadow-2xs';
      } else if (isSaturday) {
        cellStyleClass = 'cursor-pointer bg-blue-50/70 border-blue-200 hover:bg-blue-100 text-blue-900 shadow-2xs';
      } else {
        cellStyleClass = 'cursor-pointer bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 shadow-2xs';
      }
    } else {
      // Tanggal tanpa transaksi (warna pudar lembut)
      if (isSunday) {
        cellStyleClass = 'bg-rose-50/40 border-rose-100/70 text-rose-500/80';
      } else if (isSaturday) {
        cellStyleClass = 'bg-blue-50/40 border-blue-100/70 text-blue-500/80';
      } else {
        cellStyleClass = 'bg-slate-50/60 border-slate-100 text-slate-400';
      }
    }

    html += `
      <div onclick="${clickable ? `openCalendarDateDrillDown('${dStr}')` : ''}" class="h-11 rounded-xl border transition-all flex flex-col items-center justify-center p-0.5 ${cellStyleClass} ${isToday && !isHighlightedDate ? 'ring-2 ring-emerald-500 font-extrabold' : ''}" title="${isHighlightedDate ? `Terdapat transaksi ${escapeHtml(activeHighlightedHabitItem)} di tanggal ini` : ''}">
        <span class="text-xs ${isHighlightedDate ? 'font-black text-amber-950' : (clickable ? 'font-bold text-slate-800' : 'font-medium')}">${d}</span>
        ${dotsHtml}
      </div>
    `;
  }

  grid.innerHTML = html;
  lucide.createIcons();
	  
  // Render evaluasi perilaku belanja & arus kas (bulanan / tahunan)
  renderCalendarExtraAnalytics(filterPrefix, periodTxs);
}

function renderAnalysisMonthlyCalendar(filterPrefix, periodTxs) {
  const grid = document.getElementById('ana-calendar-grid');
  if (!grid) return;

  const targetYear = String(parseInt(filterPrefix) || curYear);

  setText('ana-calendar-title-text', 'Kalender Bulanan Transaksi');
  setText('ana-calendar-month-year', `Tahun ${targetYear}`);
  setText('ana-calendar-subtitle', 'Ketuk bulan untuk melihat rincian transaksi, atau ketuk item frekuensi untuk menandai bulannya.');

  // Mode tahunan: sembunyikan legenda titik & header nama hari, ubah grid menjadi 12 bulan tanpa dot
  const legendEl = document.getElementById('ana-calendar-legend');
  const weekdaysEl = document.getElementById('ana-calendar-weekdays');
  if (legendEl) legendEl.classList.add('hidden');
  if (weekdaysEl) weekdaysEl.classList.add('hidden');
  grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1';

  const highlightBanner = document.getElementById('ana-calendar-highlight-banner');
  const highlightNameEl = document.getElementById('ana-calendar-highlight-name');
  if (highlightBanner && highlightNameEl) {
    if (activeHighlightedHabitItem) {
      highlightNameEl.textContent = activeHighlightedHabitItem;
      highlightBanner.classList.remove('hidden');
    } else {
      highlightBanner.classList.add('hidden');
    }
  }

  const monthMap = {};
  periodTxs.forEach(tx => {
    if (!tx.date) return;
    const mKey = tx.date.slice(0, 7);
    if (!monthMap[mKey]) {
      monthMap[mKey] = { inSum: 0, outSum: 0, txs: [] };
    }
    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;
    if (tx.type === 'income') monthMap[mKey].inSum += amt;
    else if (tx.type === 'expense') monthMap[mKey].outSum += amt;
    else if (tx.type === 'transfer' && fee > 0) monthMap[mKey].outSum += fee;
    monthMap[mKey].txs.push(tx);
  });

  const currentMonthKey = `${curYear}-${curMonth}`;
  let html = '';

  for (let m = 1; m <= 12; m++) {
    const mKey = `${targetYear}-${String(m).padStart(2, '0')}`;
    const mName = monthNamesID[m - 1];
    const data = monthMap[mKey];
    const clickable = Boolean(data && data.txs.length > 0);
    const isCurrentMonth = (mKey === currentMonthKey);

    let isHighlightedMonth = false;
    let highlightedCount = 0;
    if (activeHighlightedHabitItem && data && data.txs.length > 0) {
      const targetLower = activeHighlightedHabitItem.trim().toLowerCase();
      data.txs.forEach(tx => {
        const subMatch = (tx.subcategory || '').trim().toLowerCase() === targetLower;
        const cat = categories.find(c => c.id === tx.categoryId);
        const catMatch = cat && cat.name.trim().toLowerCase() === targetLower;
        if (subMatch || catMatch) {
          isHighlightedMonth = true;
          highlightedCount++;
        }
      });
    }

    let cellStyleClass = '';
    if (isHighlightedMonth) {
      cellStyleClass = 'cursor-pointer bg-amber-100 border-2 border-amber-500 ring-2 ring-amber-300 text-amber-950 font-black shadow-md';
    } else if (clickable) {
      cellStyleClass = 'cursor-pointer bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 shadow-2xs';
    } else {
      cellStyleClass = 'bg-slate-50/60 border-slate-100 text-slate-400';
    }

    const net = data ? (data.inSum - data.outSum) : 0;
    const netText = (dashPrivacy.income || dashPrivacy.expense)
      ? 'Rp ••••••'
      : `${net >= 0 ? '+' : '-'}${formatCurrency(Math.abs(net))}`;

    html += `
      <div onclick="${clickable ? `openCalendarMonthDrillDown('${mKey}')` : ''}" class="min-h-[68px] rounded-xl border transition-all flex flex-col justify-between p-2.5 ${cellStyleClass} ${isCurrentMonth && !isHighlightedMonth ? 'ring-2 ring-emerald-500' : ''}" title="${isHighlightedMonth ? `Terdapat ${highlightedCount}x ${escapeHtml(activeHighlightedHabitItem)} di bulan ${mName}` : (clickable ? `Ketuk untuk rincian transaksi ${mName} ${targetYear}` : `Belum ada transaksi di ${mName} ${targetYear}`)}">
        <div class="flex items-center justify-between gap-1">
          <span class="text-xs sm:text-sm ${isHighlightedMonth ? 'font-black text-amber-950' : (clickable ? 'font-bold text-slate-800' : 'font-semibold text-slate-400')}">${mName}</span>
          ${isHighlightedMonth
            ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-extrabold">${highlightedCount}x</span>`
            : (clickable ? `<span class="text-[10px] font-semibold text-slate-400">${data.txs.length} Trx</span>` : '')}
        </div>
        <div class="text-[11px] font-bold truncate mt-1 ${!clickable ? 'text-slate-300 font-medium' : (isHighlightedMonth ? 'text-amber-900' : (net >= 0 ? 'text-emerald-700' : 'text-rose-600'))}">
          ${clickable ? netText : 'Tidak ada transaksi'}
        </div>
      </div>
    `;
  }

  grid.innerHTML = html;
  lucide.createIcons();
  renderCalendarExtraAnalytics(targetYear, periodTxs);
}

// ==================== REKAP HARIAN/TAHUNAN (IDE 1) & ARUS MINGGUAN/KUARTALAN (IDE 3) ====================
function renderCalendarExtraAnalytics(filterPrefix, periodTxs) {
  if (analysisScope === 'year') {
    const year = parseInt(filterPrefix) || curYear;
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeapYear ? 366 : 365;

    setText('stat-eval-section-title', `Evaluasi Perilaku Belanja Tahunan (${year})`);
    setText('stat-card1-label', `Bebas Belanja (${year})`);
    setText('stat-card2-label', 'Bulan Terboros');
    setText('stat-card3-label', 'Rata-Rata / Bulan Aktif');
    setText('stat-cashflow-section-title', `Laju Pengeluaran Kuartalan (Quarterly Cashflow)`);
    setText('stat-cashflow-section-sub', 'Total 4 Blok Kuartal');

    const dailyExpenseMap = {};
    const monthlyExpenseMap = {};
    let totalYearExpense = 0;

    periodTxs.forEach(t => {
      if (!t.date) return;
      const amt = parseFloat(t.amount) || 0;
      const fee = parseFloat(t.adminFee) || 0;
      let expenseAmt = 0;

      if (t.type === 'expense') expenseAmt = amt;
      else if (t.type === 'transfer' && fee > 0) expenseAmt = fee;

      if (expenseAmt > 0) {
        dailyExpenseMap[t.date] = (dailyExpenseMap[t.date] || 0) + expenseAmt;
        const mKey = t.date.slice(0, 7);
        monthlyExpenseMap[mKey] = (monthlyExpenseMap[mKey] || 0) + expenseAmt;
        totalYearExpense += expenseAmt;
      }
    });

    // 1. Hari bebas belanja dalam 1 tahun
    const activeSpendDaysCount = Object.keys(dailyExpenseMap).length;
    const noSpendDaysCount = Math.max(0, daysInYear - activeSpendDaysCount);
    const disciplinePct = Math.round((noSpendDaysCount / daysInYear) * 100);
    setText('stat-nospend-days', `${noSpendDaysCount} / ${daysInYear} Hari`);
    setText('stat-nospend-desc', `${disciplinePct}% hari bebas belanja setahun`);

    // 2. Bulan terboros dalam 1 tahun
    let peakMonthKey = '';
    let peakMonthAmount = 0;
    Object.keys(monthlyExpenseMap).forEach(mKey => {
      if (monthlyExpenseMap[mKey] > peakMonthAmount) {
        peakMonthAmount = monthlyExpenseMap[mKey];
        peakMonthKey = mKey;
      }
    });

    if (peakMonthAmount > 0 && peakMonthKey) {
      const mParts = peakMonthKey.split('-').map(Number);
      const mLabel = `${monthNamesID[(mParts[1] || 1) - 1]} ${mParts[0] || year}`;
      setText('stat-peak-day', mLabel);
      setText('stat-peak-amount', dashPrivacy.expense ? 'Puncak: Rp ••••••' : `Puncak: ${formatCurrency(peakMonthAmount)}`);
    } else {
      setText('stat-peak-day', 'Belum Ada');
      setText('stat-peak-amount', 'Pengeluaran: Rp 0');
    }

    // 3. Rata-rata pengeluaran per bulan aktif
    const activeSpendMonthsCount = Object.keys(monthlyExpenseMap).length;
    const avgActiveMonthSpend = activeSpendMonthsCount > 0 ? Math.round(totalYearExpense / activeSpendMonthsCount) : 0;
    setText('stat-avg-active-day', dashPrivacy.expense ? 'Rp ••••••' : `${formatCurrency(avgActiveMonthSpend)}/bln`);
    setText('stat-card3-desc', activeSpendMonthsCount > 0 ? `Khusus ${activeSpendMonthsCount} bulan ada pengeluaran` : 'Belum ada pengeluaran tercatat');

    // 4. Breakdown 4 Kuartal (Q1 - Q4)
    const weeklyContainer = document.getElementById('stat-weekly-breakdown');
    if (!weeklyContainer) return;

    const quarters = [
      { label: 'Kuartal 1 (Q1)', range: 'Jan–Mar', total: 0 },
      { label: 'Kuartal 2 (Q2)', range: 'Apr–Jun', total: 0 },
      { label: 'Kuartal 3 (Q3)', range: 'Jul–Sep', total: 0 },
      { label: 'Kuartal 4 (Q4)', range: 'Okt–Des', total: 0 }
    ];

    Object.keys(monthlyExpenseMap).forEach(mKey => {
      const mNum = parseInt(mKey.split('-')[1], 10);
      const amt = monthlyExpenseMap[mKey];
      if (mNum <= 3) quarters[0].total += amt;
      else if (mNum <= 6) quarters[1].total += amt;
      else if (mNum <= 9) quarters[2].total += amt;
      else quarters[3].total += amt;
    });

    weeklyContainer.innerHTML = quarters.map(q => {
      const pct = totalYearExpense > 0 ? Math.round((q.total / totalYearExpense) * 100) : 0;
      return `
        <div class="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-bold text-slate-800">${q.label}</span>
            <span class="text-[10px] text-slate-400 font-medium">${q.range}</span>
          </div>
          <div class="text-xs sm:text-sm font-black text-slate-900">${dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(q.total)}</div>
          <div class="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
            <div class="bg-emerald-600 h-full" style="width: ${pct}%"></div>
          </div>
          <div class="text-[9px] text-slate-400 text-right font-medium">${pct}% pengeluaran</div>
        </div>
      `;
    }).join('');

    setTimeout(syncHabitTrackerHeight, 50);
    return;
  }

  // ==================== MODE BULANAN (EVALUASI HARIAN & 4 BLOK MINGGU) ====================
  setText('stat-eval-section-title', 'Evaluasi Perilaku Belanja Harian');
  setText('stat-card1-label', 'Bebas Belanja');
  setText('stat-card2-label', 'Hari Terboros');
  setText('stat-card3-label', 'Rata-Rata Hari Aktif');
  setText('stat-card3-desc', 'Khusus hari ada transaksi');
  setText('stat-cashflow-section-title', 'Laju Pengeluaran Mingguan (Weekly Cashflow)');
  setText('stat-cashflow-section-sub', 'Total 4 Blok Minggu');

  const parts = filterPrefix.split('-').map(Number);
  const year = parts[0] || curYear;
  const month = (parts[1] || parseInt(curMonth)) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1. Kumpulkan pengeluaran per hari
  const dailyExpenseMap = {};
  let totalMonthExpense = 0;

  periodTxs.forEach(t => {
    if (!t.date) return;
    const amt = parseFloat(t.amount) || 0;
    const fee = parseFloat(t.adminFee) || 0;
    let expenseAmt = 0;

    if (t.type === 'expense') expenseAmt = amt;
    else if (t.type === 'transfer' && fee > 0) expenseAmt = fee;

    if (expenseAmt > 0) {
      dailyExpenseMap[t.date] = (dailyExpenseMap[t.date] || 0) + expenseAmt;
      totalMonthExpense += expenseAmt;
    }
  });

  // Hitung Hari Tanpa Belanja (No-Spend Days)
  const activeSpendDaysCount = Object.keys(dailyExpenseMap).length;
  const noSpendDaysCount = Math.max(0, daysInMonth - activeSpendDaysCount);
  const disciplinePct = Math.round((noSpendDaysCount / daysInMonth) * 100);

  setText('stat-nospend-days', `${noSpendDaysCount} / ${daysInMonth} Hari`);
  setText('stat-nospend-desc', `${disciplinePct}% hari bebas belanja`);

  // Cari Hari Terboros (Peak Spending Day)
  let peakDateStr = '';
  let peakAmount = 0;

  Object.keys(dailyExpenseMap).forEach(d => {
    if (dailyExpenseMap[d] > peakAmount) {
      peakAmount = dailyExpenseMap[d];
      peakDateStr = d;
    }
  });

  if (peakAmount > 0) {
    const dObj = new Date(peakDateStr + 'T00:00:00');
    const dayName = dObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    setText('stat-peak-day', dayName);
    setText('stat-peak-amount', dashPrivacy.expense ? 'Puncak: Rp ••••••' : `Puncak: ${formatCurrency(peakAmount)}`);
  } else {
    setText('stat-peak-day', 'Belum Ada');
    setText('stat-peak-amount', 'Pengeluaran: Rp 0');
  }

  // Rata-rata Belanja pada Hari Aktif
  const avgActiveSpend = activeSpendDaysCount > 0 ? Math.round(totalMonthExpense / activeSpendDaysCount) : 0;
  setText('stat-avg-active-day', dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(avgActiveSpend) + '/hari');

  // ==================== IDE 3: PEMBAGIAN 4 MINGGU (WEEKLY BURN RATE) ====================
  const weeklyContainer = document.getElementById('stat-weekly-breakdown');
  if (!weeklyContainer) return;

  const weeks = [
    { label: 'Minggu 1', range: 'Tgl 1–7', start: 1, end: 7, total: 0 },
    { label: 'Minggu 2', range: 'Tgl 8–14', start: 8, end: 14, total: 0 },
    { label: 'Minggu 3', range: 'Tgl 15–21', start: 15, end: 21, total: 0 },
    { label: 'Minggu 4+', range: `Tgl 22–${daysInMonth}`, start: 22, end: daysInMonth, total: 0 }
  ];

  Object.keys(dailyExpenseMap).forEach(dStr => {
    const dayNum = parseInt(dStr.split('-')[2]);
    const amt = dailyExpenseMap[dStr];
    if (dayNum <= 7) weeks[0].total += amt;
    else if (dayNum <= 14) weeks[1].total += amt;
    else if (dayNum <= 21) weeks[2].total += amt;
    else weeks[3].total += amt;
  });

  weeklyContainer.innerHTML = weeks.map(w => {
    const pct = totalMonthExpense > 0 ? Math.round((w.total / totalMonthExpense) * 100) : 0;
    return `
      <div class="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-1">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold text-slate-800">${w.label}</span>
          <span class="text-[10px] text-slate-400 font-medium">${w.range}</span>
        </div>
        <div class="text-xs sm:text-sm font-black text-slate-900">${dashPrivacy.expense ? 'Rp ••••••' : formatCurrency(w.total)}</div>
        <div class="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
          <div class="bg-emerald-600 h-full" style="width: ${pct}%"></div>
        </div>
        <div class="text-[9px] text-slate-400 text-right font-medium">${pct}% pengeluaran</div>
      </div>
    `;
  }).join('');

  setTimeout(syncHabitTrackerHeight, 50);
}

// ==================== BUKA POP-UP RINCIAN HARIAN / BULANAN SAAT KALENDER DIKLIK ====================
function openCalendarDateDrillDown(dateStr) {
  showChartDrillDownModal({
    date: dateStr,
    type: 'ALL',
    category: 'ALL'
  });
}

function openCalendarMonthDrillDown(monthStr) {
  showChartDrillDownModal({
    month: monthStr,
    type: 'ALL',
    category: 'ALL'
  });
}

// ==================== PELACAK KEBIASAAN FREKUENSI INTERAKTIF (> 1x & TOP 5 EXPAND) ====================
let isHabitTrackerExpanded = false; // Status apakah daftar sedang dibuka penuh

function toggleHabitTrackerExpand() {
  isHabitTrackerExpanded = !isHabitTrackerExpanded;

  let filterPrefix = '';
  if (analysisScope === 'month') {
    filterPrefix = document.getElementById('analysis-month-picker')?.value || dashboardSelectedMonth;
  } else {
    filterPrefix = document.getElementById('analysis-year-picker')?.value || String(curYear);
  }
  const periodTxs = transactions.filter(t => t.date && t.date.startsWith(filterPrefix));

  renderAnalysisHabitTracker(periodTxs);
  lucide.createIcons();
}

// ==================== PELACAK KEBIASAAN FREKUENSI (> 1x, PAS 4 ITEM DENGAN SCROLL) ====================
// ==================== KUNCI TINGGI OTOMATIS SEJAJAR DENGAN KALENDER ====================
function syncHabitTrackerHeight() {
  const calCard = document.getElementById('ana-calendar-card');
  const habitCard = document.getElementById('ana-habit-card');
  const habitList = document.getElementById('ana-top-frequency-list');
  const habitHeader = document.getElementById('ana-habit-header');

  if (!calCard || !habitList || !habitCard) return;

  // Pada layar PC / Desktop (lebar >= 1024px)
  if (window.innerWidth >= 1024) {
    // 1. Ambil tinggi riil kartu kalender di sebelah kiri
    const calHeight = calCard.offsetHeight;
    const headerHeight = habitHeader ? habitHeader.offsetHeight : 65;

    // 2. Kunci tinggi maksimal daftar agar tidak melebihi kalender (dikurangi header & padding 48px)
    const availableHeight = Math.max(180, calHeight - headerHeight - 60);

    habitCard.style.height = calHeight + 'px';
    habitList.style.maxHeight = availableHeight + 'px';
    habitList.style.height = 'auto';
  } else {
    // Pada layar HP / Mobile: kembalikan ke tinggi ringkas bawaan
    habitCard.style.height = 'auto';
    habitList.style.maxHeight = '350px';
    habitList.style.height = 'auto';
  }
}

// Pasang listener resize agar saat ukuran jendela browser diubah, tinggi langsung menyesuaikan
window.addEventListener('resize', syncHabitTrackerHeight);
	
function renderAnalysisHabitTracker(periodTxs) {
  const container = document.getElementById('ana-top-frequency-list');
  const badgeCount = document.getElementById('ana-habit-count-badge');
  const subEl = document.getElementById('ana-habit-subtitle');
  if (!container) return;

  const isYear = (analysisScope === 'year');

  const subcatStats = {};
  periodTxs.filter(t => t.type === 'expense' && t.subcategory && t.subcategory.trim()).forEach(t => {
    const sub = t.subcategory.trim();
    if (!subcatStats[sub]) {
      subcatStats[sub] = { count: 0, total: 0, catId: t.categoryId };
    }
    subcatStats[sub].count++;
    subcatStats[sub].total += (parseFloat(t.amount) || 0);
  });

  // Filter hanya yang frekuensinya lebih dari 1x (> 1); pada mode tahunan dibatasi maksimal 20 item tertinggi
  let sorted = Object.keys(subcatStats)
    .filter(sub => subcatStats[sub].count > 1)
    .map(sub => ({
      name: sub,
      count: subcatStats[sub].count,
      total: subcatStats[sub].total,
      avgTicket: subcatStats[sub].total / subcatStats[sub].count
    }))
    .sort((a, b) => b.count - a.count || b.total - a.total);

  if (isYear) {
    sorted = sorted.slice(0, 20);
  }

  if (badgeCount) {
    badgeCount.textContent = isYear ? `Top ${sorted.length} (Maks. 20)` : `${sorted.length} Subkategori`;
  }
  if (subEl) {
    subEl.textContent = isYear
      ? 'Maksimal 20 subkategori berulang terbanyak sepanjang tahun ini.'
      : 'Subkategori berulang terbanyak dalam periode ini.';
  }

  if (sorted.length === 0) {
    container.innerHTML = `<div class="py-12 text-center text-slate-400 text-xs italic">Belum ada pengeluaran berulang (&gt; 1x) bersubkategori di periode ini.</div>`;
    return;
  }

  const hintText = isYear ? 'Ketuk untuk menandai bulan di kalender' : 'Ketuk untuk menandai tanggal di kalender';

  // Tampilkan seluruh item dalam scrollable container (tertampil nyaman 4 item sekaligus)
  container.innerHTML = sorted.map((item, idx) => {
    const isSelected = (activeHighlightedHabitItem && activeHighlightedHabitItem.toLowerCase() === item.name.toLowerCase());

    return `
      <div onclick="toggleHabitHighlight('${escapeHtml(item.name)}')" class="p-3 rounded-xl border cursor-pointer select-none transition-all ${
        isSelected 
          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500 shadow-sm' 
          : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
      } space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold ${isSelected ? 'text-amber-950 font-black' : 'text-slate-800'} flex items-center gap-1.5 truncate">
            <span>#${idx + 1} ${escapeHtml(item.name)}</span>
            ${isSelected ? '<span class="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded-md font-extrabold uppercase shrink-0">Disorot</span>' : ''}
          </span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${isSelected ? 'bg-amber-200 text-amber-950' : 'bg-amber-100 text-amber-800'}">${item.count}x Transaksi</span>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
          <span>Total: <strong>${formatCurrency(item.total)}</strong></span>
          <span>Rata-rata: <strong>${formatCurrency(item.avgTicket)}</strong>/trx</span>
        </div>

        <div class="text-[10px] text-slate-400 flex items-center justify-between pt-0.5 border-t ${isSelected ? 'border-amber-200 text-amber-800 font-semibold' : 'border-slate-200/60'}">
          <span>${isSelected ? 'Klik lagi untuk melepas tanda' : hintText}</span>
          <i data-lucide="${isSelected ? 'check-circle-2' : 'crosshair'}" class="w-3.5 h-3.5 ${isSelected ? 'text-amber-600' : 'text-slate-400'}"></i>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();

  setTimeout(syncHabitTrackerHeight, 50);
}

// ==================== DATA ANALISA TERSTRUKTUR UNTUK EKSPOR EXCEL & PDF ====================
function computeAnalysisReportData(scope, filterPrefix) {
  const isYear = (scope === 'year');
  const periodTxs = transactions.filter(t => t.date && t.date.startsWith(filterPrefix));

  let totalInflow = 0, totalOutflow = 0;
  let fixedIncome = 0, dynamicIncome = 0;
  let fixedExpense = 0, periodicExpense = 0, dynamicExpense = 0;
  let totalTransferAdminFee = 0;

  const expCatSums = {}, incCatSums = {};
  const expCatCounts = {}, incCatCounts = {};
  const expSubSums = {}, incSubSums = {};
  const expSubCounts = {}, incSubCounts = {};
  const dailyExpenseMap = {};
  const monthlyExpenseMap = {};
  const subcatFreqMap = {};

  periodTxs.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    const fee = parseFloat(t.adminFee) || 0;
    let cat = categories.find(c => c.id === t.categoryId);
    if (cat && cat.type !== t.type && t.type !== 'transfer') {
      const altCat = categories.find(c => c.name.toLowerCase() === cat.name.toLowerCase() && c.type === t.type);
      if (altCat) cat = altCat;
    }
    const cls = cat?.expenseClass || 'dynamic';
    const catId = cat ? cat.id : t.categoryId;
    const subKey = (t.subcategory && t.subcategory.trim()) ? t.subcategory.trim() : 'Tanpa Subkategori';

    if (t.type === 'income') {
      totalInflow += amt;
      if (cls === 'fixed') fixedIncome += amt;
      else dynamicIncome += amt;

      incCatSums[catId] = (incCatSums[catId] || 0) + amt;
      incCatCounts[catId] = (incCatCounts[catId] || 0) + 1;
      if (!incSubSums[catId]) incSubSums[catId] = {};
      if (!incSubCounts[catId]) incSubCounts[catId] = {};
      incSubSums[catId][subKey] = (incSubSums[catId][subKey] || 0) + amt;
      incSubCounts[catId][subKey] = (incSubCounts[catId][subKey] || 0) + 1;
    } else if (t.type === 'expense') {
      totalOutflow += amt;
      if (cls === 'fixed') fixedExpense += amt;
      else if (cls === 'periodic') periodicExpense += amt;
      else dynamicExpense += amt;

      expCatSums[catId] = (expCatSums[catId] || 0) + amt;
      expCatCounts[catId] = (expCatCounts[catId] || 0) + 1;
      if (!expSubSums[catId]) expSubSums[catId] = {};
      if (!expSubCounts[catId]) expSubCounts[catId] = {};
      expSubSums[catId][subKey] = (expSubSums[catId][subKey] || 0) + amt;
      expSubCounts[catId][subKey] = (expSubCounts[catId][subKey] || 0) + 1;

      if (t.date) {
        dailyExpenseMap[t.date] = (dailyExpenseMap[t.date] || 0) + amt;
        const mKey = t.date.slice(0, 7);
        monthlyExpenseMap[mKey] = (monthlyExpenseMap[mKey] || 0) + amt;
      }

      if (t.subcategory && t.subcategory.trim()) {
        const subTrim = t.subcategory.trim();
        if (!subcatFreqMap[subTrim]) subcatFreqMap[subTrim] = { name: subTrim, count: 0, total: 0 };
        subcatFreqMap[subTrim].count++;
        subcatFreqMap[subTrim].total += amt;
      }
    } else if (t.type === 'transfer' && fee > 0) {
      totalOutflow += fee;
      dynamicExpense += fee;
      totalTransferAdminFee += fee;
      if (t.date) {
        dailyExpenseMap[t.date] = (dailyExpenseMap[t.date] || 0) + fee;
        const mKey = t.date.slice(0, 7);
        monthlyExpenseMap[mKey] = (monthlyExpenseMap[mKey] || 0) + fee;
      }
    }
  });

  const netCashFlow = totalInflow - totalOutflow;
  const savingRatio = totalInflow > 0 ? ((netCashFlow / totalInflow) * 100) : 0;

  let savingStatus = 'Defisit';
  if (savingRatio >= 30) savingStatus = 'Sangat Sehat';
  else if (savingRatio >= 20) savingStatus = 'Sehat';
  else if (savingRatio >= 10) savingStatus = 'Cukup';
  else if (savingRatio >= 0) savingStatus = 'Waspada (<10%)';

  // Dana Darurat
  let totalLiquidAssets = 0;
  accounts.forEach(a => {
    if (['Bank', 'E-Wallet', 'Cash'].includes(a.type)) totalLiquidAssets += (parseFloat(a.initialBalance) || 0);
  });
  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;
    if (tx.type === 'income') totalLiquidAssets += amt;
    else if (tx.type === 'expense') totalLiquidAssets -= amt;
    else if (tx.type === 'transfer' && fee > 0) totalLiquidAssets -= fee;
  });

  const targetYearNum = parseInt(filterPrefix.split('-')[0]) || curYear;
  const elapsedMonths = isYear ? Math.max(1, getElapsedMonthsCount(targetYearNum)) : 1;
  const mandatoryMonthlyCost = ((fixedExpense + periodicExpense) || totalOutflow || elapsedMonths) / elapsedMonths;
  const survivalMonths = Math.max(0, (totalLiquidAssets / mandatoryMonthlyCost));
  let emergencyStatus = 'Kritis (< 1 Bulan)';
  if (survivalMonths >= 6) emergencyStatus = 'Sangat Kuat (Ideal)';
  else if (survivalMonths >= 3) emergencyStatus = 'Sehat & Cukup';
  else if (survivalMonths >= 1) emergencyStatus = 'Perlu Waspada';

  // Frekuensi tertinggi (> 1x), max 20 untuk tahunan
  let topFrequencies = Object.values(subcatFreqMap)
    .filter(item => item.count > 1)
    .map(item => ({ ...item, avgTicket: item.total / item.count }))
    .sort((a, b) => b.count - a.count || b.total - a.total);
  if (isYear) topFrequencies = topFrequencies.slice(0, 20);

  // Top 5 & Anomali
  const expenseTxs = periodTxs.filter(t => t.type === 'expense');
  const top5Expenses = [...expenseTxs]
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
    .slice(0, 5)
    .map(tx => ({
      date: tx.date,
      note: tx.note || categories.find(c => c.id === tx.categoryId)?.name || 'Kategori',
      category: categories.find(c => c.id === tx.categoryId)?.name || 'Kategori',
      amount: parseFloat(tx.amount) || 0,
      pctOfOutflow: totalOutflow > 0 ? ((parseFloat(tx.amount) / totalOutflow) * 100) : 0
    }));

  const categoryAverages = {};
  categories.filter(c => c.type === 'expense').forEach(c => {
    const catTxs = transactions.filter(t => t.type === 'expense' && t.categoryId === c.id);
    const catSum = catTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    categoryAverages[c.id] = catTxs.length > 0 ? (catSum / catTxs.length) : 0;
  });

  const abnormalExpenses = expenseTxs
    .filter(tx => {
      const avg = categoryAverages[tx.categoryId] || 0;
      const amt = parseFloat(tx.amount) || 0;
      return (avg > 0 && amt > (2.5 * avg) && amt >= 150000);
    })
    .map(tx => {
      const cat = categories.find(c => c.id === tx.categoryId)?.name || 'Kategori';
      const avg = categoryAverages[tx.categoryId] || 0;
      return {
        date: tx.date,
        note: tx.note || cat,
        category: cat,
        amount: parseFloat(tx.amount) || 0,
        avgCategory: avg,
        ratio: avg > 0 ? (parseFloat(tx.amount) / avg) : 0
      };
    });

  // Evaluasi & Cashflow blocks (Mingguan vs Kuartalan)
  let periodLabel = '';
  let evalStats = {};
  let cashflowBlocks = [];
  let monthlyBreakdown12 = [];
  let yearlyCatAverages = [];

  if (isYear) {
    periodLabel = `Tahun ${targetYearNum}`;
    const isLeapYear = (targetYearNum % 4 === 0 && targetYearNum % 100 !== 0) || (targetYearNum % 400 === 0);
    const daysInYear = isLeapYear ? 366 : 365;
    const activeSpendDays = Object.keys(dailyExpenseMap).length;
    const noSpendDays = Math.max(0, daysInYear - activeSpendDays);

    let peakMonthKey = '', peakMonthAmount = 0;
    Object.keys(monthlyExpenseMap).forEach(mKey => {
      if (monthlyExpenseMap[mKey] > peakMonthAmount) {
        peakMonthAmount = monthlyExpenseMap[mKey];
        peakMonthKey = mKey;
      }
    });
    const peakLabel = peakMonthAmount > 0
      ? `${monthNamesID[(parseInt(peakMonthKey.split('-')[1], 10) || 1) - 1]} ${targetYearNum}`
      : 'Belum Ada';
    const activeMonthsCount = Object.keys(monthlyExpenseMap).length;

    evalStats = {
      noSpendLabel: `${noSpendDays} / ${daysInYear} Hari (${Math.round((noSpendDays / daysInYear) * 100)}%)`,
      peakLabel,
      peakAmount: peakMonthAmount,
      avgActiveLabel: `${formatCurrency(activeMonthsCount > 0 ? Math.round(totalOutflow / activeMonthsCount) : 0)}/bln (${activeMonthsCount} bln aktif)`
    };

    const qTotals = [0, 0, 0, 0];
    Object.keys(monthlyExpenseMap).forEach(mKey => {
      const mNum = parseInt(mKey.split('-')[1], 10);
      if (mNum <= 3) qTotals[0] += monthlyExpenseMap[mKey];
      else if (mNum <= 6) qTotals[1] += monthlyExpenseMap[mKey];
      else if (mNum <= 9) qTotals[2] += monthlyExpenseMap[mKey];
      else qTotals[3] += monthlyExpenseMap[mKey];
    });
    cashflowBlocks = [
      { label: 'Kuartal 1 (Jan–Mar)', total: qTotals[0], pct: totalOutflow > 0 ? (qTotals[0] / totalOutflow) * 100 : 0 },
      { label: 'Kuartal 2 (Apr–Jun)', total: qTotals[1], pct: totalOutflow > 0 ? (qTotals[1] / totalOutflow) * 100 : 0 },
      { label: 'Kuartal 3 (Jul–Sep)', total: qTotals[2], pct: totalOutflow > 0 ? (qTotals[2] / totalOutflow) * 100 : 0 },
      { label: 'Kuartal 4 (Okt–Des)', total: qTotals[3], pct: totalOutflow > 0 ? (qTotals[3] / totalOutflow) * 100 : 0 }
    ];

    for (let m = 1; m <= 12; m++) {
      const mKey = `${targetYearNum}-${String(m).padStart(2, '0')}`;
      let mIn = 0, mOut = 0, mCount = 0;
      periodTxs.filter(t => t.date && t.date.startsWith(mKey)).forEach(t => {
        mCount++;
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') mIn += amt;
        else if (t.type === 'expense') mOut += amt;
        else if (t.type === 'transfer') mOut += (parseFloat(t.adminFee) || 0);
      });
      monthlyBreakdown12.push({ monthName: monthNamesID[m - 1], txCount: mCount, inSum: mIn, outSum: mOut, net: mIn - mOut });
    }

    yearlyCatAverages = categories.map(c => {
      const totalCatSpend = periodTxs.reduce((sum, tx) => {
        if (tx.type === c.type && tx.categoryId === c.id) return sum + (parseFloat(tx.amount) || 0);
        return sum;
      }, 0);
      return { name: c.name, type: c.type, total: totalCatSpend, avgMonthly: totalCatSpend / elapsedMonths };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  } else {
    const parts = filterPrefix.split('-').map(Number);
    const y = parts[0] || curYear;
    const m = parts[1] || parseInt(curMonth);
    const daysInMonth = new Date(y, m, 0).getDate();
    periodLabel = `${monthNamesID[m - 1]} ${y}`;

    const activeSpendDays = Object.keys(dailyExpenseMap).length;
    const noSpendDays = Math.max(0, daysInMonth - activeSpendDays);
    let peakDateStr = '', peakAmount = 0;
    Object.keys(dailyExpenseMap).forEach(d => {
      if (dailyExpenseMap[d] > peakAmount) {
        peakAmount = dailyExpenseMap[d];
        peakDateStr = d;
      }
    });
    const peakLabel = peakAmount > 0
      ? new Date(peakDateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'Belum Ada';

    evalStats = {
      noSpendLabel: `${noSpendDays} / ${daysInMonth} Hari (${Math.round((noSpendDays / daysInMonth) * 100)}%)`,
      peakLabel,
      peakAmount,
      avgActiveLabel: `${formatCurrency(activeSpendDays > 0 ? Math.round(totalOutflow / activeSpendDays) : 0)}/hari (${activeSpendDays} hari aktif)`
    };

    const wTotals = [0, 0, 0, 0];
    Object.keys(dailyExpenseMap).forEach(dStr => {
      const dayNum = parseInt(dStr.split('-')[2], 10);
      if (dayNum <= 7) wTotals[0] += dailyExpenseMap[dStr];
      else if (dayNum <= 14) wTotals[1] += dailyExpenseMap[dStr];
      else if (dayNum <= 21) wTotals[2] += dailyExpenseMap[dStr];
      else wTotals[3] += dailyExpenseMap[dStr];
    });
    cashflowBlocks = [
      { label: 'Minggu 1 (Tgl 1–7)', total: wTotals[0], pct: totalOutflow > 0 ? (wTotals[0] / totalOutflow) * 100 : 0 },
      { label: 'Minggu 2 (Tgl 8–14)', total: wTotals[1], pct: totalOutflow > 0 ? (wTotals[1] / totalOutflow) * 100 : 0 },
      { label: 'Minggu 3 (Tgl 15–21)', total: wTotals[2], pct: totalOutflow > 0 ? (wTotals[2] / totalOutflow) * 100 : 0 },
      { label: `Minggu 4+ (Tgl 22–${daysInMonth})`, total: wTotals[3], pct: totalOutflow > 0 ? (wTotals[3] / totalOutflow) * 100 : 0 }
    ];
  }

  const expenseCategories = categories
    .filter(c => c.type === 'expense' && (expCatSums[c.id] || 0) > 0)
    .map(c => ({
      name: c.name,
      count: expCatCounts[c.id] || 0,
      total: expCatSums[c.id] || 0,
      pct: totalOutflow > 0 ? ((expCatSums[c.id] / totalOutflow) * 100) : 0,
      subcategories: Object.keys(expSubSums[c.id] || {})
        .map(sk => ({ name: sk, count: expSubCounts[c.id]?.[sk] || 0, total: expSubSums[c.id][sk] }))
        .sort((a, b) => b.total - a.total)
    }))
    .sort((a, b) => b.total - a.total);

  const incomeCategories = categories
    .filter(c => c.type === 'income' && (incCatSums[c.id] || 0) > 0)
    .map(c => ({
      name: c.name,
      count: incCatCounts[c.id] || 0,
      total: incCatSums[c.id] || 0,
      pct: totalInflow > 0 ? ((incCatSums[c.id] / totalInflow) * 100) : 0,
      subcategories: Object.keys(incSubSums[c.id] || {})
        .map(sk => ({ name: sk, count: incSubCounts[c.id]?.[sk] || 0, total: incSubSums[c.id][sk] }))
        .sort((a, b) => b.total - a.total)
    }))
    .sort((a, b) => b.total - a.total);

  return {
    scope,
    isYear,
    filterPrefix,
    periodLabel,
    txCount: periodTxs.length,
    totalInflow,
    totalOutflow,
    netCashFlow,
    savingRatio,
    savingStatus,
    fixedIncome,
    dynamicIncome,
    fixedExpense,
    periodicExpense,
    dynamicExpense,
    fixedPct: totalOutflow > 0 ? (fixedExpense / totalOutflow) * 100 : 0,
    periodicPct: totalOutflow > 0 ? (periodicExpense / totalOutflow) * 100 : 0,
    dynamicPct: totalOutflow > 0 ? (dynamicExpense / totalOutflow) * 100 : 0,
    totalTransferAdminFee,
    totalLiquidAssets,
    mandatoryMonthlyCost,
    survivalMonths,
    emergencyStatus,
    evalStats,
    cashflowBlocks,
    monthlyBreakdown12,
    yearlyCatAverages,
    expenseCategories,
    incomeCategories,
    topFrequencies,
    top5Expenses,
    abnormalExpenses
  };
}

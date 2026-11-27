// ==================== Dashboard View, Monthly Pie & Yearly Summary Charts ====================

// ==================== DASHBOARD VIEW ====================
function renderDashboard() {
  const selectedMonthVal = document.getElementById('dash-month-selector')?.value || dashboardSelectedMonth;
  dashboardSelectedMonth = selectedMonthVal;

  let selY = curYear, selM = parseInt(curMonth);
  if (selectedMonthVal && selectedMonthVal.includes('-')) {
    const parts = selectedMonthVal.split('-').map(Number);
    if (!isNaN(parts[0])) selY = parts[0];
    if (!isNaN(parts[1])) selM = parts[1];
  }
  const selMonthLabel = `${monthNamesID[Math.max(0, Math.min(11, selM - 1))]} ${selY}`;

  setText('dash-month-lbl1', selMonthLabel);
  setText('dash-month-lbl2', selMonthLabel);
  setText('dash-pie-month-title', selMonthLabel);

  let totalNetWorth = 0;
  const accountBalances = {};
  accounts.forEach(a => accountBalances[a.id] = parseFloat(a.initialBalance || 0));

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  const categorySpendMap = {};

  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    
    if (tx.type === 'income') {
      if (accountBalances[tx.accountId] !== undefined) accountBalances[tx.accountId] += amt;
    } else if (tx.type === 'expense') {
      if (accountBalances[tx.accountId] !== undefined) accountBalances[tx.accountId] -= amt;
    } else if (tx.type === 'transfer') {
      const fee = parseFloat(tx.adminFee) || 0;
      if (accountBalances[tx.accountId] !== undefined) accountBalances[tx.accountId] -= (amt + fee);
      if (accountBalances[tx.toAccountId] !== undefined) accountBalances[tx.toAccountId] += amt;
      if (tx.date && tx.date.startsWith(selectedMonthVal) && fee > 0) {
        monthlyExpense += fee;
      }
    }

    if (tx.date && tx.date.startsWith(selectedMonthVal)) {
      if (tx.type === 'income') {
        monthlyIncome += amt;
      } else if (tx.type === 'expense') {
        monthlyExpense += amt;
        categorySpendMap[tx.categoryId] = (categorySpendMap[tx.categoryId] || 0) + amt;
      }
    }
  });

  totalNetWorth = Object.values(accountBalances).reduce((a, b) => a + b, 0);

  setText('metric-total-balance', isNetWorthHidden ? 'Rp ••••••' : formatCurrency(totalNetWorth));
  setText('metric-monthly-income', dashPrivacy.income ? 'Rp ••••••' : `+${formatCurrency(monthlyIncome)}`);
  setText('metric-monthly-expense', dashPrivacy.expense ? 'Rp ••••••' : `-${formatCurrency(monthlyExpense)}`);
  setText('metric-monthly-savings', dashPrivacy.savings ? 'Rp ••••••' : formatCurrency(monthlyIncome - monthlyExpense));

  const iconInc = document.getElementById('icon-privacy-income');
  const iconExp = document.getElementById('icon-privacy-expense');
  const iconSav = document.getElementById('icon-privacy-savings');
  if (iconInc) iconInc.setAttribute('data-lucide', dashPrivacy.income ? 'eye-off' : 'eye');
  if (iconExp) iconExp.setAttribute('data-lucide', dashPrivacy.expense ? 'eye-off' : 'eye');
  if (iconSav) iconSav.setAttribute('data-lucide', dashPrivacy.savings ? 'eye-off' : 'eye');

  const accContainer = document.getElementById('dashboard-accounts-list');
  if (accContainer) {
    const visibleAccounts = accounts.filter(a => a.showOnDashboard ?? true);

    if (visibleAccounts.length === 0) {
      accContainer.innerHTML = `<div class="py-6 text-center text-xs text-slate-400">Tidak ada sumber dana yang dipilih untuk tampil di dashboard. Aktifkan melalui menu Pengaturan.</div>`;
    } else {
      accContainer.innerHTML = visibleAccounts.map(a => {
        const isHidden = a.isHidden ?? true;
        const balanceDisplay = isHidden ? 'Rp ••••••' : formatCurrency(accountBalances[a.id] || 0);
        return `
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div>
              <div class="text-sm font-semibold text-slate-800">${escapeHtml(a.name)}</div>
              <div class="text-xs text-slate-400">${escapeHtml(a.type)}</div>
            </div>
            <div class="text-sm font-bold ${(accountBalances[a.id] || 0) >= 0 ? 'text-slate-800' : 'text-rose-600'}">
              ${balanceDisplay}
            </div>
          </div>
        `;
      }).join('');
    }
  }
	  
	  // ==================== KALKULASI BATAS BELANJA HARIAN (IDE #3) ====================
  const today = new Date();
  const thisYear = today.getFullYear();
  const thisMonth = String(today.getMonth() + 1).padStart(2, '0');
  const isViewingCurrentMonth = (selectedMonthVal === `${thisYear}-${thisMonth}`);

  const parts = selectedMonthVal.split('-').map(Number);
  const daysInSelectedMonth = new Date(parts[0], parts[1], 0).getDate();
  
  let remainingDays = 1;
  if (isViewingCurrentMonth) {
    remainingDays = Math.max(1, daysInSelectedMonth - today.getDate() + 1);
  } else {
    remainingDays = daysInSelectedMonth;
  }

  // Hitung total limit bulan ini (atau gunakan sisa kas jika tanpa limit)
  const monthBudgets = budgets[selectedMonthVal] || {};
  const totalBudgetLimit = Object.values(monthBudgets).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  
  let availableFundsForDaily = 0;
  let basisText = '';

  if (totalBudgetLimit > 0) {
    availableFundsForDaily = Math.max(0, totalBudgetLimit - monthlyExpense);
    basisText = `Sisa Anggaran: ${formatCurrency(availableFundsForDaily)} • Sisa: ${remainingDays} Hari`;
  } else {
    // Jika belum ada anggaran, gunakan sisa arus kas (Pemasukan - Pengeluaran)
    availableFundsForDaily = Math.max(0, monthlyIncome - monthlyExpense);
    basisText = `Sisa Kas Bulanan: ${formatCurrency(availableFundsForDaily)} • Sisa: ${remainingDays} Hari`;
  }

  const safeDailyAmount = Math.floor(availableFundsForDaily / remainingDays);
  setText('daily-spend-amount', formatCurrency(safeDailyAmount) + ' / hari');
  setText('daily-spend-detail', basisText);

  const dailyBadge = document.getElementById('daily-spend-badge');
  if (dailyBadge) {
    if (safeDailyAmount <= 0) {
      dailyBadge.textContent = 'Anggaran Habis';
      dailyBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/80 text-white border border-rose-300';
    } else if (safeDailyAmount < 50000) {
      dailyBadge.textContent = 'Perlu Berhemat';
      dailyBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/80 text-white border border-amber-300';
    } else {
      dailyBadge.textContent = 'Aman & Terkendali';
      dailyBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/80 text-white border border-emerald-300';
    }
  }

  // Render daftar tagihan berulang
  renderRecurringBillsWidget();

  renderDashboardPie(categorySpendMap);
  lucide.createIcons();
}

function renderDashboardPie(spendMap) {
  const canvas = document.getElementById('categoryPieChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = [];
  const data = [];
  const palette = ['#10b981', '#f43f5e', '#6366f1', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#14b8a6'];

  Object.keys(spendMap).forEach(catId => {
    const cat = categories.find(c => c.id === catId);
    if (cat && spendMap[catId] > 0) {
      labels.push(cat.name);
      data.push(spendMap[catId]);
    }
  });

  if (pieChartInstance) pieChartInstance.destroy();

  if (data.length === 0) {
    pieChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Belum Ada Pengeluaran'],
        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
          legend: { 
            position: 'bottom',
            labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
          } 
        } 
      }
    });
    return;
  }

  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: palette.slice(0, labels.length) }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // ==================== DRILL-DOWN KLIK IRISAN PIE ====================
      onClick: (evt, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const catName = labels[idx];
          if (catName && catName !== 'Belum Ada Pengeluaran') {
            showChartDrillDownModal({
              month: dashboardSelectedMonth,
              category: catName,
              type: 'expense'
            });
          }
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
      },
      // ====================================================================
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${formatCurrency(item.raw)} (Klik untuk rincian)`
          }
        }
      }
    }
  });
}

function renderDashboardYearlyChart() {
  const yearInput = document.getElementById('dash-year-selector');
  const year = parseInt(yearInput?.value || dashboardSelectedYear) || curYear;
  dashboardSelectedYear = year;
  const canvas = document.getElementById('dashYearlyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const elapsed = getElapsedMonthsCount(year);
  const monthlyIncome = new Array(12).fill(0);
  const monthlyExpense = new Array(12).fill(0);

  transactions.forEach(tx => {
    if (!tx.date) return;
    const d = new Date(tx.date);
    if (d.getFullYear() === year) {
      const m = d.getMonth();
      if (m >= 0 && m < 12) {
        if (tx.type === 'income') monthlyIncome[m] += parseFloat(tx.amount) || 0;
        else if (tx.type === 'expense') monthlyExpense[m] += parseFloat(tx.amount) || 0;
        else if (tx.type === 'transfer') monthlyExpense[m] += (parseFloat(tx.adminFee) || 0);
      }
    }
  });

  // Nilai bulan berikutnya diset null agar bar tidak muncul
  for (let m = 0; m < 12; m++) {
    if (m + 1 > elapsed) {
      monthlyIncome[m] = null;
      monthlyExpense[m] = null;
    }
  }

  if (dashYearlyChartInstance) dashYearlyChartInstance.destroy();

  dashYearlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthShortID,
      datasets: [
        {
          label: 'Pemasukan (Inflow)',
          data: monthlyIncome,
          backgroundColor: '#10b981',
          borderRadius: 6
        },
        {
          label: 'Pengeluaran (Outflow)',
          data: monthlyExpense,
          backgroundColor: '#f43f5e',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // ==================== DRILL-DOWN KLIK BATANG GRAFIK ====================
      onClick: (evt, elements) => {
        if (elements && elements.length > 0) {
          const elem = elements[0];
          const monthIdx = elem.index; // 0 s.d. 11
          const datasetIdx = elem.datasetIndex; // 0 = Pemasukan, 1 = Pengeluaran

          // Abaikan jika batang bernilai null / belum berjalan
          const clickedVal = (datasetIdx === 0 ? monthlyIncome : monthlyExpense)[monthIdx];
          if (clickedVal === null || clickedVal === undefined) return;

          const targetMonthStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
          const targetType = (datasetIdx === 0) ? 'income' : 'expense';

          showChartDrillDownModal({
            month: targetMonthStr,
            type: targetType,
            category: 'ALL'
          });
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
      },
      // =======================================================================
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatCurrency(item.raw)} (Klik untuk rincian)`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => 'Rp ' + Number(val).toLocaleString('id-ID') }
        }
      }
    }
  });
}

// ==================== Trends & Multi-Period Comparison Charts ====================

// ==================== TREN & GRAFIK (3 AKORDEON) ====================
function toggleTrendAccordion(section) {
  trendAccordionState[section] = !trendAccordionState[section];
  const bodyEl = document.getElementById(`trend-${section}-body`);
  const iconEl = document.getElementById(`icon-chevron-trend-${section}`);

  if (bodyEl) {
    if (trendAccordionState[section]) {
      bodyEl.classList.remove('hidden');
      if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-up');
    } else {
      bodyEl.classList.add('hidden');
      if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-down');
    }
  }

  if (trendAccordionState[section]) {
    if (section === 'source') renderSourceTrendChart();
    else if (section === 'category') renderTrendsChart();
    else if (section === 'class') renderClassTrendChart();
  }
  lucide.createIcons();
}

function stepSourceTrendYear(delta) {
  const input = document.getElementById('trend-source-year');
  if (input) {
    input.value = parseInt(input.value || curYear) + delta;
    renderSourceTrendChart();
  }
}

function renderSourceTrendChart() {
  if (!trendAccordionState.source) return;
  const canvas = document.getElementById('sourceTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const sourceId = document.getElementById('trend-source-select')?.value || 'ALL';
  const year = parseInt(document.getElementById('trend-source-year')?.value || curYear) || curYear;
  const elapsed = getElapsedMonthsCount(year);
  const palette = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e', '#8b5cf6', '#06b6d4', '#64748b'];

  const timeKeys = [];
  for (let m = 1; m <= 12; m++) {
    timeKeys.push(`${year}-${String(m).padStart(2, '0')}`);
  }

  const targetAccounts = (sourceId === 'ALL')
    ? accounts
    : accounts.filter(a => a.id === sourceId);

  const datasets = [];

  targetAccounts.forEach((acc, idx) => {
    const color = palette[idx % palette.length];

    const dataPoints = timeKeys.map((mKey, mIdx) => {
      // Berhenti pada bulan saat ini
      if (mIdx + 1 > elapsed) return null;

      let bal = parseFloat(acc.initialBalance) || 0;

      transactions.forEach(tx => {
        if (!tx.date) return;
        if (tx.date.substring(0, 7) <= mKey) {
          const amt = parseFloat(tx.amount) || 0;
          const fee = parseFloat(tx.adminFee) || 0;

          if (tx.accountId === acc.id) {
            if (tx.type === 'income') bal += amt;
            else if (tx.type === 'expense') bal -= amt;
            else if (tx.type === 'transfer') bal -= (amt + fee);
          }
          if (tx.type === 'transfer' && tx.toAccountId === acc.id) {
            bal += amt;
          }
        }
      });

      return bal;
    });

    datasets.push({
      label: acc.name,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color,
      fill: false,
      tension: 0.25,
      pointRadius: 3.5,
      pointHoverRadius: 6
    });
  });

  if (sourceId === 'ALL' && targetAccounts.length > 1) {
    const totalBalances = timeKeys.map((_, mIdx) => {
      if (mIdx + 1 > elapsed) return null;
      return datasets.reduce((sum, ds) => sum + (ds.data[mIdx] !== null ? ds.data[mIdx] : 0), 0);
    });

    datasets.push({
      label: 'Total Seluruh Saldo',
      data: totalBalances,
      borderColor: '#0f172a',
      backgroundColor: '#0f172a',
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 2,
      fill: false
    });
  }

  if (sourceTrendChartInstance) sourceTrendChartInstance.destroy();

  sourceTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthShortID,
      datasets: datasets.length > 0 ? datasets : [{
        label: 'Tidak ada data rekening',
        data: new Array(12).fill(0),
        borderColor: '#cbd5e1'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatCurrency(item.raw)}`
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: (val) => 'Rp ' + Number(val).toLocaleString('id-ID') }
        }
      }
    }
  });
}

function setTrendClassChartType(type) {
  trendClassChartType = type;
  const btnBar = document.getElementById('btn-trend-class-stacked');
  const btnLine = document.getElementById('btn-trend-class-line');
  if (type === 'bar') {
    if (btnBar) btnBar.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white transition';
    if (btnLine) btnLine.className = 'px-2.5 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900 transition';
  } else {
    if (btnLine) btnLine.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white transition';
    if (btnBar) btnBar.className = 'px-2.5 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900 transition';
  }
  renderClassTrendChart();
}

function stepClassTrendYear(delta) {
  const input = document.getElementById('trend-class-year');
  if (input) {
    input.value = parseInt(input.value || curYear) + delta;
    renderClassTrendChart();
  }
}

function renderClassTrendChart() {
  if (!trendAccordionState.class) return;
  const canvas = document.getElementById('classTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const year = parseInt(document.getElementById('trend-class-year')?.value || curYear) || curYear;
  const elapsed = getElapsedMonthsCount(year);

  const fixedSpend = new Array(12).fill(0);
  const periodicSpend = new Array(12).fill(0);
  const dynamicSpend = new Array(12).fill(0);

  transactions.forEach(tx => {
    if (!tx.date || !tx.date.startsWith(String(year))) return;
    const d = new Date(tx.date);
    const m = d.getMonth();
    if (m < 0 || m >= 12) return;

    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;

    if (tx.type === 'expense') {
      const cat = categories.find(c => c.id === tx.categoryId);
      const cls = cat?.expenseClass || 'dynamic';
      if (cls === 'fixed') fixedSpend[m] += amt;
      else if (cls === 'periodic') periodicSpend[m] += amt;
      else dynamicSpend[m] += amt;
    } else if (tx.type === 'transfer' && fee > 0) {
      dynamicSpend[m] += fee;
    }
  });

  // Nilai bulan berikutnya diset null agar garis/bar berhenti di bulan saat ini
  for (let m = 0; m < 12; m++) {
    if (m + 1 > elapsed) {
      fixedSpend[m] = null;
      periodicSpend[m] = null;
      dynamicSpend[m] = null;
    }
  }

  if (classTrendChartInstance) classTrendChartInstance.destroy();

  const isStackedBar = (trendClassChartType === 'bar');

  classTrendChartInstance = new Chart(ctx, {
    type: isStackedBar ? 'bar' : 'line',
    data: {
      labels: monthShortID,
      datasets: [
        {
          label: 'Biaya Tetap (Fixed)',
          data: fixedSpend,
          backgroundColor: isStackedBar ? '#6366f1' : 'rgba(99, 102, 241, 0.1)',
          borderColor: '#6366f1',
          fill: !isStackedBar,
          tension: 0.25,
          borderRadius: isStackedBar ? 4 : 0
        },
        {
          label: 'Biaya Berkala (Periodic)',
          data: periodicSpend,
          backgroundColor: isStackedBar ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)',
          borderColor: '#f59e0b',
          fill: !isStackedBar,
          tension: 0.25,
          borderRadius: isStackedBar ? 4 : 0
        },
        {
          label: 'Biaya Dinamis (Dynamic)',
          data: dynamicSpend,
          backgroundColor: isStackedBar ? '#f43f5e' : 'rgba(244, 63, 94, 0.1)',
          borderColor: '#f43f5e',
          fill: !isStackedBar,
          tension: 0.25,
          borderRadius: isStackedBar ? 4 : 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatCurrency(item.raw)}`
          }
        }
      },
      scales: {
        x: { stacked: isStackedBar },
        y: {
          stacked: isStackedBar,
          beginAtZero: true,
          ticks: { callback: (val) => 'Rp ' + Number(val).toLocaleString('id-ID') }
        }
      }
    }
  });
}

function toggleTrendLine(type) {
  if (type === 'avg') {
    trendShowAvg = document.getElementById('trend-toggle-avg')?.checked ?? true;
  } else {
    const chk = document.getElementById('trend-toggle-budget');
    if (chk && !chk.disabled) {
      trendShowBudget = chk.checked;
    }
  }
  renderTrendsChart();
}

function renderStandardTrendsChart() {
  const canvas = document.getElementById('trendsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const catFilter = document.getElementById('trend-category-filter')?.value || 'ALL';
  const subFilter = document.getElementById('trend-subcategory-filter')?.value || 'ALL';
  const palette = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e', '#8b5cf6', '#64748b', '#06b6d4', '#e11d48', '#84cc16'];

  let timeLabels = [];
  let timeKeys = [];
  let yearVal = curYear;
  let monthVal = dashboardSelectedMonth;

  if (trendScope === 'year') {
    yearVal = document.getElementById('trend-year-select')?.value || curYear;
    timeLabels = monthShortID;
    for (let m = 1; m <= 12; m++) {
      timeKeys.push(`${yearVal}-${String(m).padStart(2, '0')}`);
    }
  } else {
    monthVal = document.getElementById('trend-month-input')?.value || dashboardSelectedMonth;
    let y = curYear, m = parseInt(curMonth);
    if (monthVal && monthVal.includes('-')) {
      const parts = monthVal.split('-').map(Number);
      if (!isNaN(parts[0])) y = parts[0];
      if (!isNaN(parts[1])) m = parts[1];
    }
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      timeLabels.push(`Tgl ${d}`);
      timeKeys.push(`${monthVal}-${dayStr}`);
    }
  }

  const elapsed = (trendScope === 'year') ? getElapsedMonthsCount(parseInt(yearVal) || curYear) : 12;

  // =========================================================================
  // 1. PENGECEKAN STATUS AKTIF BATAS LIMIT ANGGARAN (DISABLE / ENABLE CHECKBOX)
  // =========================================================================
  let hasBudgetConfigured = false;

  if (trendScope === 'year') {
    const checkMonths = Array.from({ length: 12 }, (_, i) => `${yearVal}-${String(i + 1).padStart(2, '0')}`);

    for (const mKey of checkMonths) {
      const monthBudgets = (typeof budgets === 'object' && budgets !== null) ? (budgets[mKey] || {}) : {};

      if (trendEntity === 'subcategory') {
        // Mode Subkategori: limit hanya aktif jika kategori induk dipilih secara spesifik
        if (catFilter !== 'ALL') {
          if (parseFloat(monthBudgets[catFilter]) > 0) {
            hasBudgetConfigured = true;
            break;
          }
        }
      } else {
        // Mode Kategori
        if (catFilter !== 'ALL') {
          if (parseFloat(monthBudgets[catFilter]) > 0) {
            hasBudgetConfigured = true;
            break;
          }
        } else {
          // Semua Kategori: cek apakah ada setidaknya satu kategori yang limitnya > 0
          const anyLimit = Object.values(monthBudgets).some(v => parseFloat(v) > 0);
          if (anyLimit) {
            hasBudgetConfigured = true;
            break;
          }
        }
      }
    }
  }

  // Terapkan Disable / Enable pada elemen Checkbox dan Labelnya
  const budgetCheckbox = document.getElementById('trend-toggle-budget');
  const budgetLabel = document.getElementById('trend-toggle-budget-label');

  if (budgetCheckbox && budgetLabel) {
    if (!hasBudgetConfigured) {
      budgetCheckbox.disabled = true;
      budgetCheckbox.checked = false;
      budgetLabel.classList.add('opacity-30', 'cursor-not-allowed', 'pointer-events-none');

      if (trendScope !== 'year') {
        budgetLabel.title = "Batas limit hanya tersedia pada tampilan Tahunan (12 Bulan)";
      } else if (trendEntity === 'subcategory' && catFilter === 'ALL') {
        budgetLabel.title = "Pilih salah satu kategori terlebih dahulu untuk melihat batas limit";
      } else {
        budgetLabel.title = "Belum ada limit anggaran yang diatur untuk kategori/periode ini";
      }
    } else {
      budgetCheckbox.disabled = false;
      budgetCheckbox.checked = trendShowBudget;
      budgetLabel.classList.remove('opacity-30', 'cursor-not-allowed', 'pointer-events-none');
      budgetLabel.removeAttribute('title');
    }
  }

  // =========================================================================
  // 2. PEMILIHAN ENTITAS (KATEGORI vs SUBKATEGORI)
  // =========================================================================
  let seriesItems = [];

  if (trendEntity === 'category') {
    const targetCats = categories.filter(c => c.type === 'expense' && (catFilter === 'ALL' || c.id === catFilter));
    seriesItems = targetCats.map(c => ({ key: c.id, label: c.name }));
  } else {
    const targetCats = categories.filter(c => c.type === 'expense' && (catFilter === 'ALL' || c.id === catFilter));
    const subSet = new Set();

    targetCats.forEach(c => {
      (c.subcategories || []).forEach(sub => {
        if (sub && sub.trim()) subSet.add(sub.trim());
      });
    });

    transactions.forEach(tx => {
      if (tx.type === 'expense' && tx.subcategory && tx.subcategory.trim()) {
        if (catFilter === 'ALL' || tx.categoryId === catFilter) {
          subSet.add(tx.subcategory.trim());
        }
      }
    });

    let subList = Array.from(subSet).sort((a, b) => a.localeCompare(b, 'id'));
    if (subFilter !== 'ALL') {
      subList = subList.filter(s => s === subFilter);
    }
    seriesItems = subList.map(sub => ({ key: sub, label: sub }));
  }

  // =========================================================================
  // 3. PEMBUATAN DATASET GRAFIK
  // =========================================================================
  const datasets = [];
  let colorIndex = 0;

  seriesItems.forEach(item => {
    const dataPoints = timeKeys.map((timeKey, idx) => {
      if (trendScope === 'year' && (idx + 1) > elapsed) return null;

      return transactions.reduce((sum, tx) => {
        if (tx.type === 'expense' && tx.date) {
          const matchesTime = tx.date.startsWith(timeKey);
          if (matchesTime) {
            if (trendEntity === 'category' && tx.categoryId === item.key) {
              return sum + (parseFloat(tx.amount) || 0);
            } else if (trendEntity === 'subcategory' && (tx.subcategory || '').trim() === item.key) {
              if (catFilter === 'ALL' || tx.categoryId === catFilter) {
                return sum + (parseFloat(tx.amount) || 0);
              }
            }
          }
        }
        return sum;
      }, 0);
    });

    const totalSpent = dataPoints.reduce((a, b) => a + (b || 0), 0);
    if (totalSpent > 0 || (trendEntity === 'subcategory' && subFilter !== 'ALL') || seriesItems.length <= 3) {
      const color = palette[colorIndex % palette.length];
      datasets.push({
        label: item.label,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color,
        fill: false,
        tension: 0.25,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointHitRadius: 20 // Area sentuh jari diperlebar 20px agar sangat mudah diketuk di HP
      });
      colorIndex++;
    }
  });

  // =========================================================================
  // 4. GARIS RATA-RATA & GARIS BATAS LIMIT ANGGARAN
  // =========================================================================
  if (trendScope === 'year') {
    const year = yearVal;
    const divisor = Math.max(1, elapsed);

    // Garis Rata-Rata
    if (trendShowAvg && datasets.length > 0) {
      let avgVal = 0;
      if (trendEntity === 'subcategory' && subFilter !== 'ALL') {
        const totalSub = transactions.reduce((sum, tx) => {
          if (tx.type === 'expense' && (tx.subcategory || '').trim() === subFilter && tx.date && tx.date.startsWith(year)) {
            if (catFilter === 'ALL' || tx.categoryId === catFilter) {
              return sum + (parseFloat(tx.amount) || 0);
            }
          }
          return sum;
        }, 0);
        avgVal = elapsed > 0 ? (totalSub / divisor) : 0;
      } else if (catFilter !== 'ALL') {
        const totalCat = transactions.reduce((sum, tx) => {
          if (tx.type === 'expense' && tx.categoryId === catFilter && tx.date && tx.date.startsWith(year)) {
            return sum + (parseFloat(tx.amount) || 0);
          }
          return sum;
        }, 0);
        avgVal = elapsed > 0 ? (totalCat / divisor) : 0;
      } else {
        const totalAll = transactions.reduce((sum, tx) => {
          if (tx.type === 'expense' && tx.date && tx.date.startsWith(year)) {
            return sum + (parseFloat(tx.amount) || 0);
          }
          return sum;
        }, 0);
        avgVal = elapsed > 0 ? (totalAll / divisor) : 0;
      }

      const avgData = Array.from({ length: 12 }, (_, i) => (i + 1 <= elapsed ? avgVal : null));

      datasets.push({
        label: `Rata-rata (${formatCurrency(avgVal)}/bln)`,
        data: avgData,
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      });
    }

    // Garis Batas Limit Anggaran (Hanya muncul jika limit aktif dan checkbox dicentang)
    if (hasBudgetConfigured && trendShowBudget && budgetCheckbox && budgetCheckbox.checked) {
      const budgetData = timeKeys.map((timeKey, idx) => {
        if (idx + 1 > elapsed) return null;
        const monthBudgets = (typeof budgets === 'object' && budgets !== null) ? (budgets[timeKey] || {}) : {};
        if (catFilter !== 'ALL') {
          return parseFloat(monthBudgets[catFilter]) || 0;
        } else {
          return Object.values(monthBudgets).reduce((a, b) => a + (parseFloat(b) || 0), 0);
        }
      });

      datasets.push({
        label: (trendEntity === 'subcategory' || catFilter !== 'ALL') ? 'Batas Limit Kategori' : 'Total Limit Anggaran',
        data: budgetData,
        borderColor: '#f43f5e',
        borderDash: [3, 3],
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: '#f43f5e',
        fill: false
      });
    }
  }

  // =========================================================================
  // 5. RENDER INSTANCE CHART.JS BARU
  // =========================================================================
  if (trendsChartInstance) trendsChartInstance.destroy();

  trendsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: datasets.length > 0 ? datasets : [{
        label: trendEntity === 'subcategory' ? 'Tidak ada data subkategori' : 'Tidak ada data pengeluaran',
        data: new Array(timeLabels.length).fill(0),
        borderColor: '#cbd5e1'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      // ==================== SENSOR SENTUH JARAK 2D (AKURAT & ANTI-SALAH KATEGORI) ====================
      onClick: (evt) => {
        // 1. Dapatkan posisi koordinat piksel sentuhan jempol pada kanvas
        const canvasPos = Chart.helpers.getRelativePosition(evt, trendsChartInstance);
        const clickX = canvasPos.x;
        const clickY = canvasPos.y;

        // 2. Tentukan indeks waktu (X) terdekat
        const xScale = trendsChartInstance.scales.x;
        const timeIdx = xScale.getValueForPixel(clickX);
        if (timeIdx < 0 || timeIdx >= timeKeys.length) return;

        const targetTimeKey = timeKeys[timeIdx];
        const isSub = (trendEntity === 'subcategory');

        // 3. Cari titik garis yang paling dekat dengan jari berdasarkan jarak fisik 2D (X dan Y)
        let closestItem = null;
        let minDistance = Infinity;
        const candidates = [];

        trendsChartInstance.data.datasets.forEach((ds, dsIdx) => {
          // Abaikan garis referensi Rata-rata dan Batas Limit
          if (ds.label.startsWith('Rata-rata') || ds.label.startsWith('Batas Limit') || ds.label.startsWith('Total Limit')) return;

          const val = ds.data[timeIdx];
          if (val === null || val === undefined || val <= 0) return;

          const meta = trendsChartInstance.getDatasetMeta(dsIdx);
          if (!meta || !meta.data || !meta.data[timeIdx]) return;

          const pt = meta.data[timeIdx];
          // Hitung jarak Euclidean 2D riil antara jari dan titik lingkaran
          const dist = Math.hypot(pt.x - clickX, pt.y - clickY);

          candidates.push({ ds, dsIdx, val, pt, dist });

          if (dist < minDistance) {
            minDistance = dist;
            closestItem = { ds, dsIdx, val, pt, dist };
          }
        });

        // Jika jari menekan area kosong yang terlalu jauh (> 45px), abaikan
        if (!closestItem || minDistance > 45) return;

        // 4. Kumpulkan garis terdekat dan deteksi jika ada garis lain yang bertumpuk pada koordinat yang sama
        const overlappingItems = [];
        const seenKeys = new Set();

        const registerItem = (c) => {
          if (seenKeys.has(c.ds.label)) return;
          seenKeys.add(c.ds.label);

          let catName = 'ALL';
          let subName = '';
          let parentCatName = '';

          if (isSub) {
            subName = c.ds.label;
            if (catFilter !== 'ALL') {
              const foundCat = categories.find(cat => cat.id === catFilter);
              if (foundCat) { catName = foundCat.name; parentCatName = foundCat.name; }
            } else {
              // Cari kategori pemilik subkategori ini untuk keterangan di pop-up
              const foundCat = categories.find(cat => (cat.subcategories || []).includes(c.ds.label));
              if (foundCat) { parentCatName = foundCat.name; }
              catName = 'ALL';
            }
          } else {
            catName = c.ds.label;
          }

          overlappingItems.push({
            category: catName,
            subcategory: subName,
            parentCategory: parentCatName,
            type: 'expense',
            month: (trendScope === 'year') ? targetTimeKey : null,
            date: (trendScope === 'month') ? targetTimeKey : null,
            totalAmount: c.val
          });
        };

        // Masukkan item yang paling dekat secara fisik
        registerItem(closestItem);

        // Masukkan juga garis lain yang bertumpuk pada nilai yang sama (selisih < 1) atau koordinat titiknya berhimpitan (< 12px)
        candidates.forEach(c => {
          if (c !== closestItem && (Math.abs(c.val - closestItem.val) < 1 || Math.hypot(c.pt.x - closestItem.pt.x, c.pt.y - closestItem.pt.y) < 12)) {
            registerItem(c);
          }
        });

        if (overlappingItems.length > 0) {
          showChartDrillDownModal(overlappingItems);
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
      },
      // =====================================================================
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { 
            boxWidth: 10,
            padding: 8,
            font: { size: 10 }
          }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatCurrency(item.raw)}`
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

function renderComparisonChart() {
  const canvas = document.getElementById('trendsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let p1Key = '', p2Key = '', p1Label = '', p2Label = '';

  if (compareType === 'month') {
    p1Key = document.getElementById('cmp-month-1')?.value || '';
    p2Key = document.getElementById('cmp-month-2')?.value || '';
    if (p1Key) {
      const parts = p1Key.split('-').map(Number);
      p1Label = `${monthShortID[(parts[1] || 1) - 1]} ${parts[0] || curYear}`;
    }
    if (p2Key) {
      const parts = p2Key.split('-').map(Number);
      p2Label = `${monthShortID[(parts[1] || 1) - 1]} ${parts[0] || curYear}`;
    }
  } else {
    p1Key = document.getElementById('cmp-year-1')?.value || '';
    p2Key = document.getElementById('cmp-year-2')?.value || '';
    p1Label = `Tahun ${p1Key}`;
    p2Label = `Tahun ${p2Key}`;
  }

  let items = [];
  if (compareEntity === 'category') {
    items = categories.filter(c => c.type === 'expense').map(c => ({ id: c.id, name: c.name }));
  } else {
    const subSet = new Set();
    categories.filter(c => c.type === 'expense').forEach(c => (c.subcategories || []).forEach(s => subSet.add(s)));
    transactions.forEach(t => { if (t.type === 'expense' && t.subcategory) subSet.add(t.subcategory); });
    items = Array.from(subSet).map(s => ({ id: s, name: s }));
  }

  const p1Data = [];
  const p2Data = [];
  const labels = [];
  let totalP1 = 0;
  let totalP2 = 0;

  items.forEach(item => {
    let sum1 = 0;
    let sum2 = 0;

    transactions.forEach(tx => {
      if (tx.type === 'expense' && tx.date) {
        const matchesP1 = p1Key && tx.date.startsWith(p1Key);
        const matchesP2 = p2Key && tx.date.startsWith(p2Key);
        const matchesEntity = (compareEntity === 'category') ? (tx.categoryId === item.id) : (tx.subcategory === item.id);

        if (matchesEntity) {
          const amt = parseFloat(tx.amount) || 0;
          if (matchesP1) sum1 += amt;
          if (matchesP2) sum2 += amt;
        }
      }
    });

    if (sum1 > 0 || sum2 > 0) {
      labels.push(item.name);
      p1Data.push(sum1);
      p2Data.push(sum2);
    }

    totalP1 += sum1;
    totalP2 += sum2;
  });

  setText('cmp-p1-total', formatCurrency(totalP1));
  setText('cmp-p2-total', formatCurrency(totalP2));

  const diff = totalP2 - totalP1;
  const pct = totalP1 > 0 ? ((diff / totalP1) * 100).toFixed(1) : (totalP2 > 0 ? 100 : 0);
  const isHigher = diff > 0;

  const banner = document.getElementById('cmp-delta-banner');
  if (banner) {
    banner.className = `p-3 rounded-lg text-xs font-semibold flex items-center justify-between border ${isHigher ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`;
    banner.innerHTML = `
      <div class="flex items-center gap-1.5">
        <i data-lucide="${isHigher ? 'trending-up' : 'trending-down'}" class="w-4 h-4"></i>
        <span>Pengeluaran di ${p2Label} ${isHigher ? 'lebih TINGGI' : 'lebih HEMAT'} ${Math.abs(pct)}% (${formatCurrency(Math.abs(diff))}) dibandingkan ${p1Label}</span>
      </div>
      <span class="text-[11px] px-2 py-0.5 rounded ${isHigher ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'}">${isHigher ? 'Boros' : 'Efisien'}</span>
    `;
  }

  if (trendsChartInstance) trendsChartInstance.destroy();

  trendsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['Tidak ada data'],
      datasets: [
        {
          label: p1Label || 'Periode 1',
          data: p1Data.length > 0 ? p1Data : [0],
          backgroundColor: '#3b82f6',
          borderRadius: 6
        },
        {
          label: p2Label || 'Periode 2',
          data: p2Data.length > 0 ? p2Data : [0],
          backgroundColor: '#10b981',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatCurrency(item.raw)}`
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
  lucide.createIcons();
}

function setTrendMode(mode) {
  trendMode = mode;
  const btnStd = document.getElementById('btn-trend-mode-standard');
  const btnCmp = document.getElementById('btn-trend-mode-compare');
  const stdControls = document.getElementById('trend-standard-controls');
  const cmpControls = document.getElementById('trend-compare-controls');

  if (mode === 'standard') {
    if (btnStd) btnStd.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm transition whitespace-nowrap';
    if (btnCmp) btnCmp.className = 'px-3 py-1.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center gap-1 whitespace-nowrap';
    if (stdControls) stdControls.classList.remove('hidden');
    if (cmpControls) cmpControls.classList.add('hidden');
  } else {
    if (btnCmp) btnCmp.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-sm transition flex items-center gap-1 whitespace-nowrap';
    if (btnStd) btnStd.className = 'px-3 py-1.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition whitespace-nowrap';
    if (stdControls) stdControls.classList.add('hidden');
    if (cmpControls) cmpControls.classList.remove('hidden');
    updateCompareSelectors();
  }
  renderTrendsChart();
  lucide.createIcons();
}

function setTrendScope(scope) {
  trendScope = scope;
  const btnYear = document.getElementById('btn-trend-scope-year');
  const btnMonth = document.getElementById('btn-trend-scope-month');
  const yearWrap = document.getElementById('trend-year-selector-wrap');
  const monthWrap = document.getElementById('trend-month-selector-wrap');

  if (scope === 'year') {
    if (btnYear) btnYear.className = 'px-3 py-1 text-xs font-bold rounded-md bg-white text-slate-800 shadow-sm';
    if (btnMonth) btnMonth.className = 'px-3 py-1 text-xs font-bold rounded-md text-slate-600 hover:text-slate-900';
    if (yearWrap) yearWrap.classList.remove('hidden');
    if (monthWrap) monthWrap.classList.add('hidden');
  } else {
    if (btnMonth) btnMonth.className = 'px-3 py-1 text-xs font-bold rounded-md bg-white text-slate-800 shadow-sm';
    if (btnYear) btnYear.className = 'px-3 py-1 text-xs font-bold rounded-md text-slate-600 hover:text-slate-900';
    if (monthWrap) monthWrap.classList.remove('hidden');
    if (yearWrap) yearWrap.classList.add('hidden');
  }
  renderTrendsChart();
}

function stepTrendYear(delta) {
  const input = document.getElementById('trend-year-select');
  if (input) {
    input.value = parseInt(input.value || curYear) + delta;
    renderTrendsChart();
  }
}

function stepTrendMonth(delta) {
  const input = document.getElementById('trend-month-input');
  if (!input) return;
  const val = input.value || dashboardSelectedMonth;
  const parts = val.split('-').map(Number);
  const d = new Date(parts[0] || curYear, (parts[1] || 1) - 1 + delta, 1);
  input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderTrendsChart();
}

function resetTrendMonthToCurrent() {
  setVal('trend-month-input', `${curYear}-${curMonth}`);
  renderTrendsChart();
}
	
	function onTrendCategoryFilterChange() {
  updateTrendSubcategoryDropdown();
  renderTrendsChart();
}

function updateTrendSubcategoryDropdown() {
  const catFilter = document.getElementById('trend-category-filter')?.value || 'ALL';
  const curSubInput = document.getElementById('trend-subcategory-filter');
  const prevSub = curSubInput ? curSubInput.value : 'ALL';
  const subSet = new Set();

  const targetCats = categories.filter(c => c.type === 'expense' && (catFilter === 'ALL' || c.id === catFilter));
  targetCats.forEach(c => {
    (c.subcategories || []).forEach(sub => { 
      if (sub && sub.trim()) subSet.add(sub.trim()); 
    });
  });

  transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.subcategory && tx.subcategory.trim()) {
      if (catFilter === 'ALL' || tx.categoryId === catFilter) {
        subSet.add(tx.subcategory.trim());
      }
    }
  });

  const sortedSubs = Array.from(subSet).sort((a, b) => a.localeCompare(b, 'id'));
  const subOptions = [
    { value: 'ALL', label: 'Semua Subkategori' },
    ...sortedSubs.map(s => ({ value: s, label: s }))
  ];
  searchableFilterData['trend-subcategory-filter'] = subOptions;

  // Pertahankan nilai subkategori jika masih relevan di kategori baru
  let selectedVal = 'ALL';
  if (prevSub !== 'ALL' && subSet.has(prevSub)) {
    selectedVal = prevSub;
  }
  if (curSubInput) curSubInput.value = selectedVal;

  const optSub = subOptions.find(o => o.value === selectedVal) || subOptions[0];
  const labelSub = document.getElementById('label-trend-subcategory-filter');
  if (labelSub) labelSub.textContent = optSub.label;
}
	
function setTrendEntity(entity) {
  trendEntity = entity;
  const btnCat = document.getElementById('btn-trend-entity-cat');
  const btnSub = document.getElementById('btn-trend-entity-sub');
  const subWrap = document.getElementById('trend-subcat-filter-wrap');

  if (entity === 'category') {
    if (btnCat) btnCat.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white transition';
    if (btnSub) btnSub.className = 'px-2.5 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900 transition';
    if (subWrap) subWrap.classList.add('hidden');
  } else {
    if (btnSub) btnSub.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white transition';
    if (btnCat) btnCat.className = 'px-2.5 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900 transition';
    if (subWrap) {
      subWrap.classList.remove('hidden');
      updateTrendSubcategoryDropdown();
    }
  }
  renderTrendsChart();
  lucide.createIcons();
}

function setCompareType(type) {
  compareType = type;
  const btnMonth = document.getElementById('btn-cmp-type-month');
  const btnYear = document.getElementById('btn-cmp-type-year');

  if (type === 'month') {
    if (btnMonth) btnMonth.className = 'px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white';
    if (btnYear) btnYear.className = 'px-3 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900';
  } else {
    if (btnYear) btnYear.className = 'px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white';
    if (btnMonth) btnMonth.className = 'px-3 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900';
  }
  updateCompareSelectors();
  renderTrendsChart();
}

function setCompareEntity(entity) {
  compareEntity = entity;
  const btnCat = document.getElementById('btn-cmp-entity-cat');
  const btnSub = document.getElementById('btn-cmp-entity-sub');

  if (entity === 'category') {
    if (btnCat) btnCat.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white';
    if (btnSub) btnSub.className = 'px-2.5 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900';
  } else {
    if (btnSub) btnSub.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white';
    if (btnCat) btnCat.className = 'px-2.5 py-1 text-xs font-bold rounded text-slate-600 hover:text-slate-900';
  }
  renderTrendsChart();
}

function updateCompareSelectors() {
  const wrap1 = document.getElementById('cmp-period1-selector-wrap');
  const wrap2 = document.getElementById('cmp-period2-selector-wrap');
  if (!wrap1 || !wrap2) return;

  if (compareType === 'month') {
    wrap1.innerHTML = `
      <div class="flex items-center gap-1.5 w-full sm:w-auto">
        <input type="month" id="cmp-month-1" value="${prevYear}-${prevMonth}" onchange="renderTrendsChart()" class="h-9 flex-1 min-w-0 sm:flex-none sm:w-52 text-xs sm:text-sm font-semibold border border-slate-300 rounded-lg px-3 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
        <button type="button" onclick="openCalendarPicker('cmp-month-1', renderTrendsChart)" data-tooltip="Pilih bulan dari kalender" aria-label="Pilih bulan dari kalender" class="w-9 h-9 inline-flex items-center justify-center border border-slate-300 rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition shrink-0">
          <i data-lucide="calendar" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    wrap2.innerHTML = `
      <div class="flex items-center gap-1.5 w-full sm:w-auto">
        <input type="month" id="cmp-month-2" value="${curYear}-${curMonth}" onchange="renderTrendsChart()" class="h-9 flex-1 min-w-0 sm:flex-none sm:w-52 text-xs sm:text-sm font-semibold border border-slate-300 rounded-lg px-3 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
        <button type="button" onclick="openCalendarPicker('cmp-month-2', renderTrendsChart)" data-tooltip="Pilih bulan dari kalender" aria-label="Pilih bulan dari kalender" class="w-9 h-9 inline-flex items-center justify-center border border-slate-300 rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition shrink-0">
          <i data-lucide="calendar" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  } else {
    wrap1.innerHTML = `<input type="number" id="cmp-year-1" value="${curYear - 1}" onchange="renderTrendsChart()" class="h-9 text-xs sm:text-sm font-bold border border-slate-300 rounded-lg px-2 bg-white text-slate-800 w-24 text-center outline-none focus:ring-2 focus:ring-emerald-500" />`;
    wrap2.innerHTML = `<input type="number" id="cmp-year-2" value="${curYear}" onchange="renderTrendsChart()" class="h-9 text-xs sm:text-sm font-bold border border-slate-300 rounded-lg px-2 bg-white text-slate-800 w-24 text-center outline-none focus:ring-2 focus:ring-emerald-500" />`;
  }
  lucide.createIcons();
}

function renderTrendsChart() {
  if (trendMode === 'standard') {
    renderStandardTrendsChart();
  } else {
    renderComparisonChart();
  }
}

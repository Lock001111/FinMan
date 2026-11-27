// ==================== Recurring Bills, Due Cycles, Notifications (H-1/H-0) & Quick Pay ====================

	// ==================== STATE COLLAPSE & FILTER PENGINGAT ====================
let isRecurringCollapsed = JSON.parse(localStorage.getItem('vf_setting_rec_collapsed') || 'false');

function toggleRecurringCollapse() {
  isRecurringCollapsed = !isRecurringCollapsed;
  localStorage.setItem('vf_setting_rec_collapsed', JSON.stringify(isRecurringCollapsed));
  applyRecurringCollapseUI();
}

function applyRecurringCollapseUI() {
  const body = document.getElementById('setting-recurring-body');
  const icon = document.getElementById('icon-chevron-rec-setting');
  if (!body) return;

  if (isRecurringCollapsed) {
    body.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    body.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }
  lucide.createIcons();
}

function clearRecurringSearch() {
  setVal('rec-search-input', '');
  const btn = document.getElementById('rec-search-clear');
  if (btn) btn.classList.add('hidden');
  renderRecurringBillsWidget();
}

function resetRecurringFilterAndSort() {
  setVal('rec-search-input', '');
  const btn = document.getElementById('rec-search-clear');
  if (btn) btn.classList.add('hidden');
  setVal('rec-filter-cycle', 'ALL'); // Reset filter siklus
  setVal('rec-sort', 'due-asc');
  renderRecurringBillsWidget();
}

function resolveRecurringCycleInfo(item) {
  if (!item || typeof item !== 'object') {
    return { cycleType: 'days', validityDays: 28, dueDay: 0, dueMonth: 0, cycleInterval: 1 };
  }
  const hasDueMonth = parseInt(item.dueMonth) > 0;
  const hasDueDay = parseInt(item.dueDay) > 0;
  const hasDays = parseInt(item.validityDays) > 0;

  let cycleType = item.cycleType;
  if (cycleType !== 'days' && cycleType !== 'monthly' && cycleType !== 'yearly') {
    if (hasDueMonth) cycleType = 'yearly';
    else if (hasDueDay && !hasDays) cycleType = 'monthly';
    else cycleType = 'days';
  }

  const parsedInterval = parseInt(item.cycleInterval);
  const cycleInterval = (!isNaN(parsedInterval) && parsedInterval >= 1) ? parsedInterval : 1;

  if (cycleType === 'yearly') {
    const lpParts = String(item.lastPaidDate || '').split('-').map(Number);
    const m = parseInt(item.dueMonth);
    const d = parseInt(item.dueDay);
    return {
      cycleType: 'yearly',
      validityDays: 0,
      dueMonth: (!isNaN(m) && m >= 1 && m <= 12) ? m : (lpParts[1] || (new Date().getMonth() + 1)),
      dueDay: (!isNaN(d) && d >= 1 && d <= 31) ? d : (lpParts[2] || 25),
      cycleInterval
    };
  }

  if (cycleType === 'monthly') {
    const d = parseInt(item.dueDay);
    return {
      cycleType: 'monthly',
      validityDays: 0,
      dueMonth: 0,
      dueDay: (!isNaN(d) && d >= 1 && d <= 31) ? d : 25,
      cycleInterval
    };
  }

  const v = parseInt(item.validityDays);
  return {
    cycleType: 'days',
    validityDays: (!isNaN(v) && v >= 1) ? v : 28,
    dueDay: 0,
    dueMonth: 0,
    cycleInterval: 1
  };
}

function calcDueDateStr(itemOrLastPaid, validityDays = 28, cycleType = 'days', dueDay = 25, cycleInterval = 1, dueMonth = 1) {
  const d = calcDueDate(itemOrLastPaid, validityDays, cycleType, dueDay, cycleInterval, dueMonth);
  return getLocalDateStr(d);
}

// ==================== SISTEM TIGA BASIS REMINDER (HARI, BULANAN & TAHUNAN DENGAN INTERVAL) ====================
function onRecDueDayInput() {
  updateRecDeadlineDisplay();
}

// Menghitung tanggal jatuh tempo (mendukung siklus hari, bulanan per N bulan, dan tahunan per N tahun)
function calcDueDate(itemOrLastPaid, validityDays = 28, cycleType = 'days', dueDay = 25, cycleInterval = 1, dueMonth = 1) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let lastPaidDateStr = '';
  let type = cycleType;
  let targetDueDay = parseInt(dueDay) || 25;
  let targetDueMonth = parseInt(dueMonth) || (today.getMonth() + 1);
  let days = parseInt(validityDays) || 28;
  let interval = Math.max(1, parseInt(cycleInterval) || 1);

  if (typeof itemOrLastPaid === 'object' && itemOrLastPaid !== null) {
    lastPaidDateStr = itemOrLastPaid.lastPaidDate;
    const resolved = resolveRecurringCycleInfo(itemOrLastPaid);
    type = resolved.cycleType;
    targetDueDay = resolved.dueDay;
    targetDueMonth = resolved.dueMonth;
    days = resolved.validityDays;
    interval = resolved.cycleInterval;
  } else {
    lastPaidDateStr = itemOrLastPaid;
  }

  // KASUS 1: BERBASIS TAHUNAN (TANGGAL & BULAN TERTENTU, ULANGI SETIAP N TAHUN)
  if (type === 'yearly') {
    const mIdx = Math.min(11, Math.max(0, targetDueMonth - 1));
    const safeDay = Math.min(31, Math.max(1, targetDueDay));

    if (lastPaidDateStr) {
      const lpDate = parseLocalDate(lastPaidDateStr);
      let y = lpDate.getFullYear();
      const dayInLpYear = Math.min(safeDay, new Date(y, mIdx + 1, 0).getDate());
      const dueInLpYear = new Date(y, mIdx, dayInLpYear);
      dueInLpYear.setHours(0, 0, 0, 0);

      // Jika pembayaran terakhir sudah dilakukan pada/dekat jatuh tempo tahun tersebut (maks 30 hari sebelumnya atau sesudahnya)
      const threshold = new Date(dueInLpYear);
      threshold.setDate(threshold.getDate() - 30);
      if (lpDate >= threshold) {
        y += interval;
      }

      const finalDay = Math.min(safeDay, new Date(y, mIdx + 1, 0).getDate());
      const res = new Date(y, mIdx, finalDay);
      res.setHours(0, 0, 0, 0);
      return res;
    }

    let y = today.getFullYear();
    const dayThisYear = Math.min(safeDay, new Date(y, mIdx + 1, 0).getDate());
    const cand = new Date(y, mIdx, dayThisYear);
    cand.setHours(0, 0, 0, 0);
    if (cand < today) {
      y += 1;
    }
    const finalDay = Math.min(safeDay, new Date(y, mIdx + 1, 0).getDate());
    const res = new Date(y, mIdx, finalDay);
    res.setHours(0, 0, 0, 0);
    return res;
  }

  // KASUS 2: BERBASIS BULANAN (TANGGAL TERTENTU, ULANGI SETIAP N BULAN)
  if (type === 'monthly') {
    const safeDay = Math.min(31, Math.max(1, targetDueDay));

    if (lastPaidDateStr) {
      const lpDate = parseLocalDate(lastPaidDateStr);
      let y = lpDate.getFullYear();
      let m = lpDate.getMonth();
      const dayInLpMonth = Math.min(safeDay, new Date(y, m + 1, 0).getDate());

      // Jika transaksi terakhir dibayar di bulan tersebut mendekati/setelah tanggal jatuh tempo,
      // majukan ke siklus berikutnya (+ interval bulan)
      if (lpDate.getDate() >= (dayInLpMonth - 7)) {
        m += interval;
      }

      const base = new Date(y, m, 1);
      const finalDay = Math.min(safeDay, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate());
      const res = new Date(base.getFullYear(), base.getMonth(), finalDay);
      res.setHours(0, 0, 0, 0);
      return res;
    }

    let y = today.getFullYear();
    let m = today.getMonth();
    const dayThisMonth = Math.min(safeDay, new Date(y, m + 1, 0).getDate());
    const cand = new Date(y, m, dayThisMonth);
    cand.setHours(0, 0, 0, 0);
    if (cand < today) {
      m += 1;
    }
    const base = new Date(y, m, 1);
    const finalDay = Math.min(safeDay, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate());
    const res = new Date(base.getFullYear(), base.getMonth(), finalDay);
    res.setHours(0, 0, 0, 0);
    return res;
  }

  // KASUS 3: BERBASIS SIKLUS HARI
  if (!lastPaidDateStr) return today;
  const d = parseLocalDate(lastPaidDateStr);
  d.setDate(d.getDate() + days);
  return d;
}

// Memajukan jadwal jatuh tempo tagihan secara presisi saat transaksi pembayaran dicatat
function advanceRecurringBillSchedule(bill, txDateStr, txAmount = null) {
  if (!bill) return;
  const resolved = resolveRecurringCycleInfo(bill);
  const prevDueStr = bill.customDueDate || calcDueDateStr(
    bill.lastPaidDate,
    resolved.validityDays,
    resolved.cycleType,
    resolved.dueDay,
    resolved.cycleInterval,
    resolved.dueMonth
  );

  bill.lastPaidDate = txDateStr;
  bill.lastPaidDueDate = prevDueStr;
  bill.lastPaidAt = Date.now();
  if (txAmount !== null && !isNaN(parseFloat(txAmount))) {
    bill.lastPaidAmount = parseFloat(txAmount);
  }

  // Tutup toast pengingat jika masih tampil di layar
  try {
    document.querySelector(`[data-toast-key="rec-${bill.id}"]`)?.remove();
  } catch (_) {}

  const txD = parseLocalDate(txDateStr);

  if (resolved.cycleType === 'monthly') {
    const baseDue = prevDueStr ? parseLocalDate(prevDueStr) : txD;
    let targetYear = baseDue.getFullYear();
    let targetMonth = baseDue.getMonth() + resolved.cycleInterval;
    let nextDue = new Date(targetYear, targetMonth, 1);
    let finalDay = Math.min(resolved.dueDay, new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0).getDate());
    nextDue = new Date(nextDue.getFullYear(), nextDue.getMonth(), finalDay);
    nextDue.setHours(0, 0, 0, 0);

    let guard = 0;
    while (nextDue <= txD && guard < 120) {
      targetMonth += resolved.cycleInterval;
      const stepBase = new Date(targetYear, targetMonth, 1);
      finalDay = Math.min(resolved.dueDay, new Date(stepBase.getFullYear(), stepBase.getMonth() + 1, 0).getDate());
      nextDue = new Date(stepBase.getFullYear(), stepBase.getMonth(), finalDay);
      nextDue.setHours(0, 0, 0, 0);
      guard++;
    }

    bill.customDueDate = getLocalDateStr(nextDue);
    return;
  }

  if (resolved.cycleType === 'yearly') {
    const baseDue = prevDueStr ? parseLocalDate(prevDueStr) : txD;
    const mIdx = Math.min(11, Math.max(0, resolved.dueMonth - 1));
    let targetYear = baseDue.getFullYear() + resolved.cycleInterval;
    let finalDay = Math.min(resolved.dueDay, new Date(targetYear, mIdx + 1, 0).getDate());
    let nextDue = new Date(targetYear, mIdx, finalDay);
    nextDue.setHours(0, 0, 0, 0);

    let guard = 0;
    while (nextDue <= txD && guard < 50) {
      targetYear += resolved.cycleInterval;
      finalDay = Math.min(resolved.dueDay, new Date(targetYear, mIdx + 1, 0).getDate());
      nextDue = new Date(targetYear, mIdx, finalDay);
      nextDue.setHours(0, 0, 0, 0);
      guard++;
    }

    bill.customDueDate = getLocalDateStr(nextDue);
    return;
  }

  // Siklus Harian: maju dari tanggal transaksi pembayaran + masa berlaku hari
  const nextDaysDue = parseLocalDate(txDateStr);
  nextDaysDue.setDate(nextDaysDue.getDate() + resolved.validityDays);
  bill.customDueDate = getLocalDateStr(nextDaysDue);
}

function onRecValidityDaysInput() {
  updateRecDeadlineDisplay();
}

function onRecCycleChoiceChange(val) {
  const secDays = document.getElementById('rec-form-section-days');
  const secMonthly = document.getElementById('rec-form-section-monthly');
  const secYearly = document.getElementById('rec-form-section-yearly');

  if (secDays) secDays.classList.toggle('hidden', val !== 'days');
  if (secMonthly) secMonthly.classList.toggle('hidden', val !== 'monthly');
  if (secYearly) secYearly.classList.toggle('hidden', val !== 'yearly');

  if (val === 'monthly') {
    const mInterval = document.getElementById('rec-monthly-interval');
    if (mInterval && (!mInterval.value || parseInt(mInterval.value) < 1)) mInterval.value = '1';
  } else if (val === 'yearly') {
    const yInterval = document.getElementById('rec-yearly-interval');
    const yMonth = document.getElementById('rec-yearly-month');
    const yDay = document.getElementById('rec-yearly-day');
    if (yInterval && (!yInterval.value || parseInt(yInterval.value) < 1)) yInterval.value = '1';
    const lastPaid = document.getElementById('rec-last-paid')?.value;
    if (lastPaid) {
      const parts = lastPaid.split('-').map(Number);
      if (yMonth && (!yMonth.value || yMonth.value === '')) yMonth.value = String(parts[1] || (new Date().getMonth() + 1));
      if (yDay && !yDay.value) yDay.value = String(parts[2] || new Date().getDate());
    } else {
      if (yMonth && !yMonth.value) yMonth.value = String(new Date().getMonth() + 1);
    }
  }

  updateRecDeadlineDisplay();
}

function updateRecDeadlineDisplay() {
  const cycleChoice = document.querySelector('input[name="rec-cycle-choice"]:checked')?.value || 'days';
  const lastPaid = document.getElementById('rec-last-paid')?.value || '';
  const dueInput = document.getElementById('rec-next-due');
  const nextDueWrap = document.getElementById('rec-next-due-wrap');
  if (!dueInput) return;

  if (cycleChoice === 'yearly') {
    const dueDay = parseInt(document.getElementById('rec-yearly-day')?.value);
    const dueMonth = parseInt(document.getElementById('rec-yearly-month')?.value);
    const interval = Math.max(1, parseInt(document.getElementById('rec-yearly-interval')?.value) || 1);
    if (!dueDay || isNaN(dueDay) || dueDay < 1 || !dueMonth || isNaN(dueMonth)) {
      dueInput.value = '';
    } else {
      if (nextDueWrap) nextDueWrap.classList.remove('hidden');
      dueInput.value = calcDueDateStr(lastPaid, 0, 'yearly', dueDay, interval, dueMonth);
    }
  } else if (cycleChoice === 'monthly') {
    const dueDay = parseInt(document.getElementById('rec-due-day')?.value);
    const interval = Math.max(1, parseInt(document.getElementById('rec-monthly-interval')?.value) || 1);
    if (!dueDay || isNaN(dueDay) || dueDay < 1) {
      dueInput.value = '';
    } else {
      if (nextDueWrap) nextDueWrap.classList.remove('hidden');
      dueInput.value = calcDueDateStr(lastPaid, 0, 'monthly', dueDay, interval, 0);
    }
  } else {
    const days = parseInt(document.getElementById('rec-validity-days')?.value);
    if (!lastPaid || isNaN(days) || days <= 0) {
      dueInput.value = '';
    } else {
      if (nextDueWrap) nextDueWrap.classList.remove('hidden');
      dueInput.value = calcDueDateStr(lastPaid, days, 'days', 0, 1, 0);
    }
  }
}

// ==================== TOGGLE NOTIFIKASI LANGSUNG DARI KARTU ====================
function toggleRecurringNotification(id, event) {
  if (event) event.stopPropagation();
  const item = recurringBills.find(r => r.id === id);
  if (!item) return;

  item.notify = !item.notify;

  persistState(true);
  renderRecurringBillsWidget();

  // Minta izin notifikasi browser jika baru diaktifkan lalu langsung cek pengingat
  if (item.notify) {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => {
        checkDueRecurringNotifications();
      }).catch(() => {
        checkDueRecurringNotifications();
      });
    } else {
      checkDueRecurringNotifications();
    }
  }
}

// ==================== RENDER KARTU PENGINGAT (DENGAN SEARCH, FILTER & IKON EDIT/HAPUS) ====================
function renderRecurringBillsWidget() {
  const container = document.getElementById('recurring-bills-list');
  const headerBadge = document.getElementById('badge-rec-count-header');
  const filterCountEl = document.getElementById('rec-filter-count');

  if (headerBadge) headerBadge.textContent = `${recurringBills.length} Reminder`;
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Filter Pencarian
  const searchInput = document.getElementById('rec-search-input');
  const searchQuery = (searchInput?.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('rec-search-clear');
  if (clearBtn) {
    if (searchQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  // 2. Filter Tipe Siklus (Bulanan vs Hari)
  const filterCycle = document.getElementById('rec-filter-cycle')?.value || 'ALL';
  const sortOption = document.getElementById('rec-sort')?.value || 'due-asc';

  let items = recurringBills.map(item => {
    const resolved = resolveRecurringCycleInfo(item);
    const dueDateStr = item.customDueDate || calcDueDateStr(
      item.lastPaidDate,
      resolved.validityDays,
      resolved.cycleType,
      resolved.dueDay,
      resolved.cycleInterval,
      resolved.dueMonth
    );
    const dueDate = parseLocalDate(dueDateStr);

    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    const catName = categories.find(c => c.id === item.categoryId)?.name || 'Kategori';
    return {
      ...item,
      ...resolved,
      dueDate,
      dueDateStr,
      diffDays,
      catName
    };
  });

  // Filter Pencarian Teks
  if (searchQuery) {
    items = items.filter(it => 
      it.name.toLowerCase().includes(searchQuery) ||
      it.catName.toLowerCase().includes(searchQuery) ||
      (it.subcategory || '').toLowerCase().includes(searchQuery)
    );
  }

  // Filter Tipe Siklus (Bulanan, Tahunan, Siklus Hari)
  if (filterCycle === 'monthly' || filterCycle === 'yearly' || filterCycle === 'days') {
    items = items.filter(it => it.cycleType === filterCycle);
  }

  // Pengurutan (Sort)
  if (sortOption === 'due-asc') items.sort((a, b) => a.diffDays - b.diffDays);
  else if (sortOption === 'name-asc') items.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  else if (sortOption === 'amount-desc') items.sort((a, b) => b.amount - a.amount);

  if (filterCountEl) filterCountEl.textContent = `Menampilkan ${items.length} reminder`;

  if (items.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-400 italic">Tidak ada reminder yang cocok dengan filter.</div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
    let statusText = `Sisa ${item.diffDays} Hari`;

    if (item.diffDays < 0) {
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse font-extrabold';
      statusText = `Lewat ${Math.abs(item.diffDays)} Hari!`;
    } else if (item.diffDays === 0) {
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
      statusText = 'Jatuh Tempo Hari Ini!';
    } else if (item.diffDays <= 3) {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      statusText = `Segera! Sisa ${item.diffDays} Hari`;
    }

    // TAMPILAN LABEL SIKLUS: HARI vs BULANAN (N BULAN) vs TAHUNAN (N TAHUN)
    let cycleBadgeHtml = '';
    if (item.cycleType === 'yearly') {
      const mShort = monthShortID[(item.dueMonth || 1) - 1] || 'Jan';
      const yearlyText = item.cycleInterval > 1
        ? `Setiap ${item.cycleInterval} Tahun: ${item.dueDay} ${mShort}`
        : `Tahunan: Setiap ${item.dueDay} ${mShort}`;
      cycleBadgeHtml = `
        <span class="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
          <i data-lucide="calendar-check" class="w-2.5 h-2.5 text-emerald-600"></i>
          <span>${yearlyText}</span>
        </span>
      `;
    } else if (item.cycleType === 'monthly') {
      const monthlyText = item.cycleInterval > 1
        ? `Setiap ${item.cycleInterval} Bulan: Tgl ${item.dueDay}`
        : `Bulanan: Setiap Tgl ${item.dueDay}`;
      cycleBadgeHtml = `
        <span class="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
          <i data-lucide="calendar" class="w-2.5 h-2.5 text-indigo-600"></i>
          <span>${monthlyText}</span>
        </span>
      `;
    } else {
      cycleBadgeHtml = `
        <span class="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
          <i data-lucide="clock" class="w-2.5 h-2.5 text-amber-600"></i>
          <span>Siklus: ${item.validityDays || 28} Hari</span>
        </span>
      `;
    }

    const daysSinceLastPaid = item.lastPaidDate
      ? Math.round((today.getTime() - parseLocalDate(item.lastPaidDate).getTime()) / 86400000)
      : null;
    const isRecentlyPaidCycle = daysSinceLastPaid !== null && daysSinceLastPaid >= 0 && daysSinceLastPaid <= 7 && item.diffDays > 0 && item.lastPaidDueDate !== item.dueDateStr;
    const lastPaidFormatted = item.lastPaidDate
      ? parseLocalDate(item.lastPaidDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })
      : '';

    return `
      <div class="p-4 ${isRecentlyPaidCycle ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'} border rounded-xl flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <h4 class="font-bold text-slate-900 text-sm truncate">${escapeHtml(item.name)}</h4>
              <div class="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1 flex-wrap">
                <span class="font-semibold text-slate-700">${escapeHtml(item.catName)}</span>
                <span class="text-slate-300">•</span>
                <span class="bg-white text-emerald-800 border border-slate-200 px-1.5 py-0.5 rounded-md font-semibold text-[10px] inline-flex items-center gap-1">
                  <i data-lucide="tag" class="w-3 h-3 text-emerald-600"></i>
                  <span>${escapeHtml(item.subcategory || 'Tanpa Subkategori')}</span>
                </span>
                <span class="text-slate-300">•</span>
                ${cycleBadgeHtml}
              </div>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              ${isRecentlyPaidCycle ? `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-300 inline-flex items-center gap-1">
                  <i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-700"></i>
                  <span>Terbayar</span>
                </span>
              ` : ''}
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">${statusText}</span>
            </div>
          </div>

          <div class="flex justify-between items-baseline mt-2.5 text-xs gap-2 flex-wrap">
            <span class="font-extrabold text-slate-900 text-sm">${formatCurrency(item.amount)}</span>
            <span class="text-[11px] text-slate-500 font-medium">Jatuh Tempo: <strong>${item.dueDate.toLocaleDateString('id-ID', { dateStyle: 'medium' })}</strong></span>
          </div>
          ${item.lastPaidDate ? `
            <div class="mt-1.5 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <i data-lucide="calendar-check" class="w-3.5 h-3.5 shrink-0"></i>
              <span>Terakhir dibayar: ${escapeHtml(lastPaidFormatted)}${daysSinceLastPaid === 0 ? ' (Diperbarui ke siklus berikutnya)' : ''}</span>
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between pt-2.5 border-t border-slate-200/70 text-xs">
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="toggleRecurringNotification('${item.id}', event)" data-tooltip="${item.notify ? 'Nonaktifkan notifikasi pengingat' : 'Aktifkan notifikasi pengingat'}" aria-label="${item.notify ? 'Notifikasi Aktif' : 'Notifikasi Nonaktif'}" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border transition shrink-0 ${
              item.notify 
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }">
              <i data-lucide="${item.notify ? 'bell' : 'bell-off'}" class="w-4 h-4"></i>
            </button>

            <button type="button" onclick="openRecurringModal('${item.id}')" data-tooltip="Ubah pengingat tagihan" aria-label="Ubah pengingat tagihan" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>

            <button type="button" onclick="deleteRecurringBill('${item.id}')" data-tooltip="Hapus pengingat tagihan" aria-label="Hapus pengingat tagihan" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shrink-0">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <button type="button" onclick="payRecurringBillQuick('${item.id}')" class="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition shadow-xs inline-flex items-center gap-1.5">
            <i data-lucide="check" class="w-3.5 h-3.5"></i>
            <span>Bayar</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

// ==================== ALUR PENGINGAT CERDAS & AUTO-FILL RIWAYAT ====================
function populateSubcategoryOptionsForReminder(catId, selectedSub = '') {
  const subSelect = document.getElementById('rec-subcategory');
  if (!subSelect) return;

  const cat = categories.find(c => c.id === catId);
  if (cat && cat.subcategories && cat.subcategories.length > 0) {
    const sortedSubs = [...cat.subcategories].sort((a, b) => a.localeCompare(b, 'id'));
    subSelect.innerHTML = `<option value="">-- Pilih Subkategori --</option>` + 
      sortedSubs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

    if (selectedSub) {
      const matched = sortedSubs.find(s => s.trim().toLowerCase() === selectedSub.trim().toLowerCase());
      if (matched) {
        subSelect.value = matched;
      } else {
        // Jika subkategori kustom belum ada di daftar kategori, sisipkan agar tidak hilang
        const opt = document.createElement('option');
        opt.value = selectedSub;
        opt.textContent = selectedSub;
        subSelect.appendChild(opt);
        subSelect.value = selectedSub;
      }
    } else {
      subSelect.value = '';
    }
  } else {
    subSelect.innerHTML = `<option value="">Tanpa Subkategori</option>`;
    subSelect.value = '';
  }
}
	
	function openRecurringModal(editId = null) {
  const catSelect = document.getElementById('rec-category');
  const subSelect = document.getElementById('rec-subcategory');
  const typeSelectorWrap = document.getElementById('rec-type-selector-wrap');
  const nextDueWrap = document.getElementById('rec-next-due-wrap');
  const pickerWrap = document.getElementById('rec-history-picker-wrap');

  const expenseCats = categories.filter(c => c.type === 'expense').sort((a, b) => a.name.localeCompare(b.name, 'id'));
  
  if (catSelect) {
    catSelect.innerHTML = `<option value="">-- Pilih Kategori --</option>` + 
      expenseCats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  if (pickerWrap) pickerWrap.classList.add('hidden');

  if (typeSelectorWrap) typeSelectorWrap.classList.remove('hidden');

  if (editId) {
    // ==================== MODE EDIT REMINDER ====================
    const item = recurringBills.find(r => String(r.id) === String(editId));
    if (!item) return;

    const resolved = resolveRecurringCycleInfo(item);
    const resolvedType = resolved.cycleType;

    setText('rec-modal-title', 'Ubah Reminder Tagihan');
    setVal('rec-id', String(item.id));
    setVal('rec-name', item.name);
    setVal('rec-amount', formatNumberWithDots(item.amount));
    setVal('rec-last-paid', item.lastPaidDate);
    setVal('rec-category', item.categoryId);

    setVal('rec-validity-days', resolvedType === 'days' ? resolved.validityDays : '');
    setVal('rec-due-day', resolvedType === 'monthly' ? resolved.dueDay : '');
    setVal('rec-monthly-interval', resolvedType === 'monthly' ? resolved.cycleInterval : '1');
    setVal('rec-yearly-day', resolvedType === 'yearly' ? resolved.dueDay : '');
    setVal('rec-yearly-month', resolvedType === 'yearly' ? String(resolved.dueMonth) : String(new Date().getMonth() + 1));
    setVal('rec-yearly-interval', resolvedType === 'yearly' ? resolved.cycleInterval : '1');

    // Centang radio button yang sesuai secara programatis
    const radioTarget = document.querySelector(`input[name="rec-cycle-choice"][value="${resolvedType}"]`);
    if (radioTarget) radioTarget.checked = true;

    // Buka form kolom sesuai jenisnya
    onRecCycleChoiceChange(resolvedType);

    // Populasi subkategori & pilih nilai aslinya
    populateSubcategoryOptionsForReminder(item.categoryId, item.subcategory || '');

    // Tampilkan deadline yang bisa diedit
    if (nextDueWrap) nextDueWrap.classList.remove('hidden');
    const dueInput = document.getElementById('rec-next-due');
    if (dueInput) {
      dueInput.value = item.customDueDate || calcDueDateStr(item);
    }

    const notifyChk = document.getElementById('rec-notify');
    if (notifyChk) notifyChk.checked = (item.notify !== false);

  } else {
    // ==================== MODE TAMBAH BARU ====================
    setText('rec-modal-title', 'Tambah Reminder Tagihan');
    setVal('rec-id', '');
    setVal('rec-name', '');
    setVal('rec-amount', '');
    setVal('rec-validity-days', '');
    setVal('rec-due-day', '');
    setVal('rec-monthly-interval', '1');
    setVal('rec-yearly-day', '');
    setVal('rec-yearly-month', String(new Date().getMonth() + 1));
    setVal('rec-yearly-interval', '1');
    setVal('rec-last-paid', '');
    setVal('rec-next-due', '');

    const radioDays = document.querySelector('input[name="rec-cycle-choice"][value="days"]');
    if (radioDays) radioDays.checked = true;
    onRecCycleChoiceChange('days');

    if (subSelect) subSelect.innerHTML = `<option value="">-- Pilih Kategori Dahulu --</option>`;
    if (nextDueWrap) nextDueWrap.classList.remove('hidden');

    const notifyChk = document.getElementById('rec-notify');
    if (notifyChk) notifyChk.checked = true;
  }

  openModal('recurring-bill-modal');
  lucide.createIcons();
}

function onRecCategoryChange() {
  const catId = document.getElementById('rec-category')?.value;
  populateSubcategoryOptionsForReminder(catId, '');
  detectHistoricalRecurringTxs();
}

function onRecSubcategoryChange() {
  detectHistoricalRecurringTxs();
}

// =========================================================================
// LOGIKA PENCARIAN 1 BULAN KE BELAKANG S/D FALLBACK AWAL BULAN SEBELUMNYA
// =========================================================================
let matchedHistoricalRecurringTxs = [];
	let detectedAutoValidityDays = null;
	
	let detectedAutoDueDay = '';

function detectHistoricalRecurringTxs() {
  const editId = document.getElementById('rec-id')?.value;
  if (editId) return; // Mode Edit tidak menimpa otomatis

  const catId = document.getElementById('rec-category')?.value;
  const subVal = (document.getElementById('rec-subcategory')?.value || '').trim().toLowerCase();
  const pickerWrap = document.getElementById('rec-history-picker-wrap');
  const optionsBox = document.getElementById('rec-history-options');

  // Helper reset field menjadi kosong jika data tidak ditemukan (tidak menahan data sebelumnya)
  const resetFormToBlank = () => {
    setVal('rec-name', '');
    setVal('rec-amount', '');
    setVal('rec-last-paid', '');
    setVal('rec-validity-days', '');
    setVal('rec-due-day', '');
    setVal('rec-yearly-day', '');
    setVal('rec-next-due', '');
    detectedAutoValidityDays = '';
    detectedAutoDueDay = '';
    if (pickerWrap) pickerWrap.classList.add('hidden');
    updateRecDeadlineDisplay();
  };

  if (!catId || !subVal) {
    resetFormToBlank();
    return;
  }

  const now = new Date();
  const todayStr = getLocalDateStr(now);

  // Rentang 1: 1 Bulan ke belakang
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const range1Start = getLocalDateStr(oneMonthAgo);
  const range1End = todayStr;

  let matched = transactions.filter(t => {
    if (t.type !== 'expense' || t.categoryId !== catId) return false;
    if ((t.subcategory || '').trim().toLowerCase() !== subVal) return false;
    return t.date >= range1Start && t.date <= range1End;
  }).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  // Rentang 2 (Fallback): Awal bulan lalu s.d. H-1
  if (matched.length === 0) {
    const prevMonthYear = oneMonthAgo.getFullYear();
    const prevMonthNum = oneMonthAgo.getMonth();
    const range2Start = `${prevMonthYear}-${String(prevMonthNum + 1).padStart(2, '0')}-01`;
    const dayBeforeInPrevMonth = new Date(prevMonthYear, prevMonthNum, Math.max(1, now.getDate() - 1));
    const range2End = getLocalDateStr(dayBeforeInPrevMonth);

    matched = transactions.filter(t => {
      if (t.type !== 'expense' || t.categoryId !== catId) return false;
      if ((t.subcategory || '').trim().toLowerCase() !== subVal) return false;
      return t.date >= range2Start && t.date <= range2End;
    }).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }

  // Fallback interval masa berlaku 3 bulan ke belakang
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const threeMonthsStr = getLocalDateStr(threeMonthsAgo);

  const history3Months = transactions.filter(t => {
    if (t.type !== 'expense' || t.categoryId !== catId) return false;
    if ((t.subcategory || '').trim().toLowerCase() !== subVal) return false;
    return t.date >= threeMonthsStr && t.date <= todayStr;
  }).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  let detectedDays = '';
  if (history3Months.length >= 2) {
    let totalInterval = 0;
    let intervalCount = 0;
    for (let i = 0; i < history3Months.length - 1; i++) {
      const d1 = new Date(history3Months[i].date + 'T00:00:00');
      const d2 = new Date(history3Months[i + 1].date + 'T00:00:00');
      const diff = Math.round(Math.abs(d1 - d2) / 86400000);
      if (diff >= 5 && diff <= 120) {
        totalInterval += diff;
        intervalCount++;
      }
    }
    if (intervalCount > 0) {
      detectedDays = Math.round(totalInterval / intervalCount);
    }
  }

  matchedHistoricalRecurringTxs = matched;
  detectedAutoValidityDays = detectedDays;

  if (matched.length === 0) {
    resetFormToBlank();
    return;
  }

  // Ambil angka tanggal transaksi terakhir untuk jatuh tempo bulanan (1-31)
  const lastTxDay = parseInt(matched[0].date.split('-')[2]);
  detectedAutoDueDay = (!isNaN(lastTxDay) && lastTxDay >= 1 && lastTxDay <= 31) ? lastTxDay : '';

  // JIKA HANYA DITEMUKAN 1 TRANSAKSI: Langsung isi, jangan munculkan daftar pemilih
  if (matched.length === 1) {
    if (pickerWrap) pickerWrap.classList.add('hidden');
    applyHistoricalRecValues(matched[0], detectedAutoValidityDays, detectedAutoDueDay);
    return;
  }

  // JIKA DITEMUKAN > 1 TRANSAKSI: Munculkan picker opsi
  if (matched.length > 1) {
    applyHistoricalRecValues(matched[0], detectedAutoValidityDays, detectedAutoDueDay);

    if (pickerWrap && optionsBox) {
      pickerWrap.classList.remove('hidden');
      optionsBox.innerHTML = matched.map((tx, idx) => `
        <div onclick="applyHistoricalRecFromIndex(${idx})" class="p-2 rounded-xl bg-white border border-blue-200 hover:border-blue-400 cursor-pointer transition flex items-center justify-between text-xs shadow-2xs">
          <div>
            <span class="font-bold text-slate-800 block">${escapeHtml(tx.note || tx.subcategory || 'Tagihan')}</span>
            <span class="text-[10px] text-slate-400">Tgl: ${tx.date}</span>
          </div>
          <span class="font-extrabold text-blue-700">${formatCurrency(tx.amount)}</span>
        </div>
      `).join('');
      lucide.createIcons();
    }
  }
}

function applyHistoricalRecFromIndex(idx) {
  if (matchedHistoricalRecurringTxs && matchedHistoricalRecurringTxs[idx]) {
    const tx = matchedHistoricalRecurringTxs[idx];
    const txDay = parseInt(tx.date.split('-')[2]);
    applyHistoricalRecValues(tx, detectedAutoValidityDays, txDay || detectedAutoDueDay);
  }
}

function applyHistoricalRecValues(tx, validityDays = '', dueDay = '') {
  const cat = categories.find(c => c.id === tx.categoryId);
  setVal('rec-name', tx.note || tx.subcategory || cat?.name || 'Tagihan');
  setVal('rec-amount', formatNumberWithDots(tx.amount));
  setVal('rec-last-paid', tx.date);

  const txParts = String(tx.date || '').split('-').map(Number);
  const currentChoice = document.querySelector('input[name="rec-cycle-choice"]:checked')?.value || 'days';

  if (currentChoice === 'yearly') {
    setVal('rec-yearly-day', dueDay || txParts[2] || '');
    setVal('rec-yearly-month', String(txParts[1] || (new Date().getMonth() + 1)));
    const yInt = document.getElementById('rec-yearly-interval');
    if (yInt && (!yInt.value || parseInt(yInt.value) < 1)) yInt.value = '1';
  } else if (currentChoice === 'monthly') {
    setVal('rec-due-day', dueDay || txParts[2] || '');
    const mInt = document.getElementById('rec-monthly-interval');
    if (mInt && (!mInt.value || parseInt(mInt.value) < 1)) mInt.value = '1';
  } else {
    setVal('rec-validity-days', validityDays || '');
  }

  updateRecDeadlineDisplay();
}

function saveRecurringBill(e) {
  e.preventDefault();
  const id = document.getElementById('rec-id')?.value;
  
  const cycleChoice = document.querySelector('input[name="rec-cycle-choice"]:checked')?.value || 'days';
  const name = document.getElementById('rec-name')?.value?.trim();
  const amount = parseDotsNumber(document.getElementById('rec-amount')?.value);
  const categoryId = document.getElementById('rec-category')?.value;
  const subcategory = (document.getElementById('rec-subcategory')?.value || '').trim();
  const notify = document.getElementById('rec-notify')?.checked ?? true;
  const lastPaidDate = document.getElementById('rec-last-paid')?.value || getLocalDateStr();

  if (!name || amount <= 0 || !categoryId) {
    showAppAlert('Harap lengkapi nama tagihan, nominal, dan kategori!');
    return;
  }

  let validityDays = 0;
  let dueDay = 0;
  let dueMonth = 0;
  let cycleInterval = 1;

  if (cycleChoice === 'yearly') {
    dueDay = parseInt(document.getElementById('rec-yearly-day')?.value);
    dueMonth = parseInt(document.getElementById('rec-yearly-month')?.value);
    cycleInterval = parseInt(document.getElementById('rec-yearly-interval')?.value) || 1;
    if (!dueDay || isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      showAppAlert('Harap masukkan tanggal jatuh tempo tahunan antara 1 sampai 31!');
      return;
    }
    if (!dueMonth || isNaN(dueMonth) || dueMonth < 1 || dueMonth > 12) {
      showAppAlert('Harap pilih bulan jatuh tempo tahunan!');
      return;
    }
    if (isNaN(cycleInterval) || cycleInterval < 1) {
      showAppAlert('Interval pengulangan tahunan minimal 1 tahun!');
      return;
    }
    validityDays = 0;
  } else if (cycleChoice === 'monthly') {
    dueDay = parseInt(document.getElementById('rec-due-day')?.value);
    cycleInterval = parseInt(document.getElementById('rec-monthly-interval')?.value) || 1;
    if (!dueDay || isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      showAppAlert('Harap masukkan tanggal jatuh tempo bulanan antara tanggal 1 sampai 31!');
      return;
    }
    if (isNaN(cycleInterval) || cycleInterval < 1) {
      showAppAlert('Interval pengulangan bulanan minimal 1 bulan!');
      return;
    }
    validityDays = 0;
    dueMonth = 0;
  } else {
    validityDays = parseInt(document.getElementById('rec-validity-days')?.value);
    if (!validityDays || isNaN(validityDays) || validityDays < 1) {
      showAppAlert('Harap masukkan jumlah masa berlaku hari!');
      return;
    }
    dueDay = 0;
    dueMonth = 0;
    cycleInterval = 1;
  }

  if (notify && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(() => checkDueRecurringNotifications()).catch(() => {});
  }

  let customDueDate = document.getElementById('rec-next-due')?.value;
  if (!customDueDate || customDueDate.trim() === '') {
    customDueDate = calcDueDateStr(lastPaidDate, validityDays, cycleChoice, dueDay, cycleInterval, dueMonth);
  }

  const billData = {
    name: toSmartTitleCase(name),
    cycleType: cycleChoice, // 'days', 'monthly', atau 'yearly'
    cycleInterval: cycleInterval,
    amount: amount,
    validityDays: validityDays,
    dueDay: dueDay,
    dueMonth: dueMonth,
    lastPaidDate: lastPaidDate,
    customDueDate: customDueDate,
    categoryId: categoryId,
    subcategory: subcategory,
    notify: notify
  };

  if (id && id.trim() !== '') {
    const idx = recurringBills.findIndex(r => String(r.id) === String(id));
    if (idx !== -1) {
      recurringBills[idx] = {
        ...recurringBills[idx],
        ...billData,
        id: String(id)
      };
    }
  } else {
    recurringBills.unshift({
      id: 'rec-' + Date.now() + '-' + Math.random().toString().slice(2, 6),
      ...billData
    });
  }

  persistState(true);
  closeModal('recurring-bill-modal');
  renderRecurringBillsWidget();
  checkDueRecurringNotifications();
  showAppAlert('Pengingat tagihan berhasil disimpan!');
}

// Mendeteksi otomatis transaksi dari bulan sebelumnya / riwayat terakhir
function autoDetectRecurringHistory() {
  const catId = document.getElementById('rec-category')?.value;
  const subVal = document.getElementById('rec-subcategory')?.value || '';
  const pickerWrap = document.getElementById('rec-history-picker-wrap');
  const optionsBox = document.getElementById('rec-history-options');

  if (!catId) {
    if (pickerWrap) pickerWrap.classList.add('hidden');
    return;
  }

  // Cari transaksi yang cocok di riwayat
  matchedHistoricalRecurringTxs = transactions.filter(t => {
    if (t.type !== 'expense' || t.categoryId !== catId) return false;
    if (subVal && (t.subcategory || '').trim().toLowerCase() !== subVal.trim().toLowerCase()) return false;
    return true;
  }).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  if (matchedHistoricalRecurringTxs.length === 0) {
    if (pickerWrap) pickerWrap.classList.add('hidden');
    return;
  }

  // Hitung otomatis masa berlaku (interval hari antar transaksi terakhir)
  let calculatedValidity = 28;
  if (matchedHistoricalRecurringTxs.length >= 2) {
    const d1 = new Date(matchedHistoricalRecurringTxs[0].date);
    const d2 = new Date(matchedHistoricalRecurringTxs[1].date);
    const diffDays = Math.round(Math.abs(d1 - d2) / 86400000);
    if (diffDays >= 20 && diffDays <= 365) {
      calculatedValidity = diffDays;
    }
  }

  // Terapkan transaksi paling terakhir secara default
  applyHistoricalRecSuggestion(0, calculatedValidity);

  // Jika ada lebih dari 1 transaksi, tampilkan kotak pemilih
  if (matchedHistoricalRecurringTxs.length > 1 && pickerWrap && optionsBox) {
    pickerWrap.classList.remove('hidden');
    optionsBox.innerHTML = matchedHistoricalRecurringTxs.slice(0, 4).map((tx, idx) => `
      <div onclick="applyHistoricalRecSuggestion(${idx}, ${calculatedValidity})" class="p-2 rounded-xl bg-white border border-blue-200 hover:border-blue-400 cursor-pointer transition flex items-center justify-between text-xs">
        <div>
          <span class="font-bold text-slate-800 block">${escapeHtml(tx.note || tx.subcategory || 'Tagihan')}</span>
          <span class="text-[10px] text-slate-400">${tx.date}</span>
        </div>
        <span class="font-extrabold text-blue-700">${formatCurrency(tx.amount)}</span>
      </div>
    `).join('');
    lucide.createIcons();
  } else if (pickerWrap) {
    pickerWrap.classList.add('hidden');
  }
}

function applyHistoricalRecSuggestion(idx, autoValidity = 28) {
  const tx = matchedHistoricalRecurringTxs[idx];
  if (!tx) return;

  const cat = categories.find(c => c.id === tx.categoryId);
  setVal('rec-name', tx.note || tx.subcategory || cat?.name || 'Tagihan Berulang');
  setVal('rec-amount', formatNumberWithDots(tx.amount));
  setVal('rec-last-paid', tx.date);
  setVal('rec-validity-days', autoValidity);
}

// ==================== PEMERIKSAAN NOTIFIKASI H-1 & H-0 (SELALU MUNCUL TIAP BUKA APLIKASI) ====================
async function deliverReminderNotification(title, body, item, tone = 'amber') {
  const tag = `fintrack-rec-${item.id}`;

  // 1. Selalu tampilkan pengingat visual in-app agar user langsung melihat saat membuka aplikasi
  showAppToast(title, body, {
    tone,
    duration: 15000,
    dedupeKey: `rec-${item.id}`,
    actionLabel: 'Bayar Sekarang',
    onAction: () => payRecurringBillQuick(item.id)
  });

  // 2. Kirim juga notifikasi sistem (PC/HP) apabila izin notifikasi diaktifkan
  if ('Notification' in window && Notification.permission === 'granted') {
    let deliveredViaSW = false;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag,
            renotify: true
          });
          deliveredViaSW = true;
        }
      }
      if (!deliveredViaSW) {
        new Notification(title, { body, icon: './icon.svg', tag });
      }
    } catch (err) {
      console.warn('Notifikasi sistem tidak tersedia, pengingat tetap ditampilkan di aplikasi:', err);
    }
  }
}

async function checkDueRecurringNotifications() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const item of recurringBills) {
    if (!item.notify) continue;

    const resolved = resolveRecurringCycleInfo(item);
    const dueDateStr = item.customDueDate || calcDueDateStr(
      item.lastPaidDate,
      resolved.validityDays,
      resolved.cycleType,
      resolved.dueDay,
      resolved.cycleInterval,
      resolved.dueMonth
    );
    const nextDue = parseLocalDate(dueDateStr);
    const diffDays = Math.round((nextDue.getTime() - today.getTime()) / 86400000);

    if (diffDays === 1) {
      await deliverReminderNotification(
        'FinTrack: Pengingat Tagihan H-1',
        `Tagihan "${item.name}" (${formatCurrency(item.amount)}) akan jatuh tempo besok!`,
        item,
        'amber'
      );
    } else if (diffDays === 0) {
      await deliverReminderNotification(
        'FinTrack: Tagihan Jatuh Tempo Hari Ini',
        `Tagihan "${item.name}" (${formatCurrency(item.amount)}) jatuh tempo hari ini! Segera lakukan pembayaran.`,
        item,
        'rose'
      );
    }
  }
}

async function deleteRecurringBill(id) {
  if (await showAppConfirm('Hapus pengingat tagihan berulang ini?', 'Hapus Reminder')) {
    // Hapus HANYA item yang memiliki ID bersangkutan
    recurringBills = recurringBills.filter(r => String(r.id) !== String(id));
    persistState(true);
    renderRecurringBillsWidget();
  }
}

// ==================== TOMBOL CEPAT BAYAR PADA KARTU REMINDER ====================
function payRecurringBillQuick(id) {
  const item = recurringBills.find(r => String(r.id) === String(id));
  if (!item) return;

  // 1. Buka modal Catat Transaksi tanpa memunculkan numpad otomatis karena nominal sudah terisi
  openTransactionModal(null, { skipAutoNumpad: true, reminderId: String(item.id) });

  // 2. Pastikan tipe transaksi adalah Pengeluaran (Expense)
  const expenseRadio = document.querySelector('input[name="tx-type"][value="expense"]');
  if (expenseRadio) {
    expenseRadio.checked = true;
    onTxTypeChange();
  }

  // 3. Set Kategori dan OTOMATIS PILIH SUBKATEGORI sesuai kartu reminder
  if (item.categoryId) {
    setVal('tx-category', item.categoryId);
    populateSubcategoriesDropdown();

    const subSelect = document.getElementById('tx-subcategory');
    if (subSelect && item.subcategory) {
      // Cari opsi subkategori yang cocok
      const matchOpt = [...subSelect.options].find(o => 
        o.value.trim().toLowerCase() === item.subcategory.trim().toLowerCase()
      );

      if (matchOpt) {
        subSelect.value = matchOpt.value;
      } else {
        // Jika subkategori kustom belum ada di daftar dropdown, sisipkan otomatis
        const opt = document.createElement('option');
        opt.value = item.subcategory;
        opt.textContent = item.subcategory;
        subSelect.appendChild(opt);
        subSelect.value = item.subcategory;
      }
    }
    if (typeof updateTxCustomParameterFields === 'function') {
      updateTxCustomParameterFields();
    }
  }

  // 4. Set Nominal & Keterangan Transaksi
  setVal('tx-amount', formatNumberWithDots(item.amount));
  setVal('tx-note', item.name || (item.subcategory ? `Pembayaran ${item.subcategory}` : 'Pembayaran Tagihan'));

  // 5. Set Tanggal transaksi ke hari ini
  const todayStr = getLocalDateStr();
  setVal('tx-date', todayStr);
}
	
	// ==================== FITUR COLLAPSE KATEGORI DI PENGATURAN ====================
let isSettingCategoryCollapsed = JSON.parse(localStorage.getItem('vf_setting_cat_collapsed') || 'false');

function toggleSettingCategoryCollapse() {
  isSettingCategoryCollapsed = !isSettingCategoryCollapsed;
  localStorage.setItem('vf_setting_cat_collapsed', JSON.stringify(isSettingCategoryCollapsed));
  applySettingCategoryCollapseUI();
}

function applySettingCategoryCollapseUI() {
  const body = document.getElementById('setting-category-body');
  const icon = document.getElementById('icon-chevron-cat-setting');
  if (!body) return;

  if (isSettingCategoryCollapsed) {
    body.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    body.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }
  lucide.createIcons();
}
	

// ==================== Startup Initialization, Month/Year Steppers & Calendar Picker Popup ====================

// --- STARTUP INITIALIZATION ---
function initHistoryTrap() {
  // Gunakan fragment #root dan #app agar browser mobile 100% mengenali navigasi awal
  if (!window.location.hash || window.location.hash === '#root') {
    history.replaceState({ root: true }, '', '#root');
    history.pushState({ tab: 'dashboard' }, '', '#app');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  // Inisialisasi Guard State dengan fragment URL
  initHistoryTrap();

  // Pasang pengaman interaksi sentuhan pertama
  ['touchstart', 'pointerdown', 'click'].forEach(evt => {
    window.addEventListener(evt, () => {
      if (!window.location.hash || window.location.hash === '#root') {
        initHistoryTrap();
      }
    }, { once: true, passive: true });
  });

  sanitizeState();
  initPickers();
  initNoteKeydownListener();
  updateCompareSelectors();
  await initFsAutoBackup();
  checkPeriodicAutoBackup();
  checkAppLockOnStartup();
  renderAll();
  fetchAppVersionFromSW();
  checkPostUpdateNotice();
	  initSwipeNavigation();
	  setupMoneyInputsForNumpad();
	  checkDueRecurringNotifications();
  // Periksa notifikasi setiap 30 menit
  setInterval(checkDueRecurringNotifications, 30 * 60 * 1000);
});

function initPickers() {
  setVal('dash-month-selector', dashboardSelectedMonth);
  setVal('filter-month', dashboardSelectedMonth);
  setVal('budget-month-selector', dashboardSelectedMonth);
  setVal('tx-date', getLocalDateStr());
  
  setVal('trend-month-input', dashboardSelectedMonth);
  setVal('analysis-month-picker', dashboardSelectedMonth);
  setVal('export-month-input', dashboardSelectedMonth);

  setVal('dash-year-selector', dashboardSelectedYear);
  setVal('trend-source-year', curYear);
  setVal('trend-year-select', curYear);
  setVal('trend-class-year', curYear);
  setVal('export-year-select', curYear);
  setVal('analysis-year-picker', curYear);

  setVal('backup-freq-select', backupConfig.frequency || 'on_change');
  setVal('backup-retention-select', backupConfig.retention || 'auto_remove');
  setVal('backup-limit-select', backupConfig.retentionLimit || 5);
  setVal('fs-delay-select', fsBackupConfig.delaySeconds || 60);
  toggleRetentionLimitUI();
  loadGdrivePrefs();
}

function initNoteKeydownListener() {
  const noteInput = document.getElementById('tx-note');
  if (noteInput) {
    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          // Shift+Enter creates a new line
        } else {
          e.preventDefault();
          const submitBtn = document.getElementById('btn-tx-submit');
          if (submitBtn) submitBtn.click();
        }
      }
    });
  }
}

function renderAll() {
  populateDropdowns();
  renderDashboard();
  renderDashboardYearlyChart();
  renderTransactions();
  renderAnalysisView();
  renderBudgets();
  renderTrendsChart();
  renderSettings();
  lucide.createIcons();
	  setupMoneyInputsForNumpad();
}

// --- STEP & RESET BUTTON HANDLERS ---
function stepDashboardMonth(delta) {
  const val = document.getElementById('dash-month-selector')?.value || dashboardSelectedMonth;
  const parts = val.split('-').map(Number);
  const d = new Date(parts[0] || curYear, (parts[1] || 1) - 1 + delta, 1);
  dashboardSelectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  setVal('dash-month-selector', dashboardSelectedMonth);
  renderDashboard();
}

function resetDashboardToCurrentMonth() {
  dashboardSelectedMonth = `${curYear}-${curMonth}`;
  setVal('dash-month-selector', dashboardSelectedMonth);
  renderDashboard();
}

function stepDashboardYear(delta) {
  const input = document.getElementById('dash-year-selector');
  if (input) {
    input.value = parseInt(input.value || dashboardSelectedYear) + delta;
    renderDashboardYearlyChart();
  }
}

function stepAnalysisMonth(delta) {
	  activeHighlightedHabitItem = null;
	  isHabitTrackerExpanded = false;
  const input = document.getElementById('analysis-month-picker');
  if (!input) return;
  const val = input.value || dashboardSelectedMonth;
  const parts = val.split('-').map(Number);
  const d = new Date(parts[0] || curYear, (parts[1] || 1) - 1 + delta, 1);
  input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderAnalysisView();
}

function resetAnalysisMonthToCurrent() {
	  activeHighlightedHabitItem = null;
	  isHabitTrackerExpanded = false;
  setVal('analysis-month-picker', `${curYear}-${curMonth}`);
  renderAnalysisView();
}

function stepAnalysisYear(delta) {
	  activeHighlightedHabitItem = null;
  const input = document.getElementById('analysis-year-picker');
  if (input) {
    input.value = parseInt(input.value || curYear) + delta;
    renderAnalysisView();
  }
}

function stepBudgetMonth(delta) {
  const input = document.getElementById('budget-month-selector');
  if (!input) return;
  const val = input.value || dashboardSelectedMonth;
  const parts = val.split('-').map(Number);
  const d = new Date(parts[0] || curYear, (parts[1] || 1) - 1 + delta, 1);
  input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderBudgets();
}

function resetBudgetMonthToCurrent() {
  setVal('budget-month-selector', `${curYear}-${curMonth}`);
  renderBudgets();
}

// ==================== CALENDAR PICKER POPUP ENGINE ====================
function openCalendarPicker(targetInputId, callback = null) {
  activeCalendarTargetInputId = targetInputId;
  activeCalendarCallback = callback;

  const inputVal = document.getElementById(targetInputId)?.value || `${curYear}-${curMonth}`;
  const parts = inputVal.split('-').map(Number);
  const y = (!isNaN(parts[0]) && parts[0] > 1900) ? parts[0] : curYear;
  const m = (!isNaN(parts[1]) && parts[1] >= 1 && parts[1] <= 12) ? parts[1] : parseInt(curMonth);

  const yearEl = document.getElementById('cal-picker-year');
  if (yearEl) yearEl.value = y;
  renderCalendarPickerGrid(m - 1);
  openModal('calendar-picker-modal');
  lucide.createIcons();
}

function stepPickerYear(delta) {
  const yearEl = document.getElementById('cal-picker-year');
  if (yearEl) {
    yearEl.value = parseInt(yearEl.value || curYear) + delta;
    renderCalendarPickerGrid();
  }
}

function renderCalendarPickerGrid(activeMonthIdx = -1) {
  const grid = document.getElementById('cal-picker-months-grid');
  if (!grid) return;
  const curSelectedVal = document.getElementById(activeCalendarTargetInputId)?.value || '';
  const parts = curSelectedVal.split('-').map(Number);
  const curY = parts[0] || curYear;
  const curM = parts[1] || parseInt(curMonth);
  const activeYear = parseInt(document.getElementById('cal-picker-year')?.value || curYear);

  grid.innerHTML = monthNamesID.map((name, idx) => {
    const isSelected = (activeYear === curY && (idx + 1) === curM);
    return `
      <button onclick="selectPickerMonth(${idx})" class="p-2 text-xs font-semibold rounded-xl border text-center transition ${isSelected ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300'}">
        ${monthShortID[idx]}
      </button>
    `;
  }).join('');
}

function selectPickerMonth(monthIndex) {
  const year = document.getElementById('cal-picker-year')?.value || curYear;
  const formatted = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  
  const input = document.getElementById(activeCalendarTargetInputId);
  if (input) {
    input.value = formatted;
    if (activeCalendarCallback) activeCalendarCallback();
  }
  closeModal('calendar-picker-modal');
}

function setPickerCurrentMonth() {
  const input = document.getElementById(activeCalendarTargetInputId);
  if (input) {
    input.value = `${curYear}-${curMonth}`;
    if (activeCalendarCallback) activeCalendarCallback();
  }
  closeModal('calendar-picker-modal');
}

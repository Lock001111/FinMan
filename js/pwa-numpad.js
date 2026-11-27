// ==================== PWA Install/Update Engine, Lifecycle Sync & Mobile In-App Numpad ====================

// ==================== PWA INSTALLATION & UPDATE ENGINE ====================
let deferredInstallPrompt = null;
let pwaWaitingWorker = null;
let userTriggeredUpdate = false; // Kunci pengaman: hanya reload jika user menekan tombol
let updateCountdownTimer = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
      deferredInstallPrompt = null;
    });
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      fetchAppVersionFromSW();

      // Jika ada update yang sudah siap/menunggu, tampilkan bannernya dengan tenang
      if (registration.waiting) {
        pwaWaitingWorker = registration.waiting;
        showUpdateBanner();
      }

      setInterval(() => {
        registration.update();
      }, 30 * 60 * 1000);

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          // Service Worker baru selesai diunduh, tampilkan banner & TUNGGU klik pengguna
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            pwaWaitingWorker = installingWorker;
            showUpdateBanner();
          }
        });
      });
    }).catch((err) => {
      console.warn('PWA registration failed:', err);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // PENGAMAN: HANYA reload halaman jika pengguna SUDAH menekan tombol update!
      if (!refreshing && userTriggeredUpdate) {
        refreshing = true;
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.replace(cleanUrl + '?updated=' + Date.now() + '#app');
      }
    });
  });
}

function showUpdateBanner() {
  const banner = document.getElementById('pwa-update-banner');
  if (banner) banner.classList.remove('hidden');
}

function dismissUpdateBanner() {
  // Pengguna memilih BATAL / NANTI: Sembunyikan banner
  const banner = document.getElementById('pwa-update-banner');
  if (banner) banner.classList.add('hidden');
  // JANGAN ubah vf_installed_version. Versi aplikasi tetap pada versi lama!
}

function applyAppUpdate() {
  // Pengguna resmi menyetujui pembaruan
  userTriggeredUpdate = true;
  dismissUpdateBanner();

  const successModal = document.getElementById('pwa-update-success-modal');
  if (successModal) {
    successModal.classList.remove('hidden');
    lucide.createIcons();
  }

  let secondsLeft = 3;
  const countdownEl = document.getElementById('update-countdown-text');
  if (countdownEl) countdownEl.textContent = `(${secondsLeft}s)`;

  if (updateCountdownTimer) clearInterval(updateCountdownTimer);
  updateCountdownTimer = setInterval(() => {
    secondsLeft--;
    if (countdownEl) countdownEl.textContent = `(${secondsLeft}s)`;
    if (secondsLeft <= 0) {
      clearInterval(updateCountdownTimer);
      executeReloadForUpdate();
    }
  }, 1000);
}

async function executeReloadForUpdate() {
  if (updateCountdownTimer) clearInterval(updateCountdownTimer);
  userTriggeredUpdate = true;
  localStorage.setItem('vf_just_updated', 'true');

  // SAHKAN VERSI BARU HANYA KETIKA TOMBOL INI DIJALANKAN
  if (pendingNewVersion) {
    localStorage.setItem('vf_installed_version', pendingNewVersion);
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ action: 'skipWaiting' });
      }
    }
    if (pwaWaitingWorker) {
      pwaWaitingWorker.postMessage({ action: 'skipWaiting' });
    }
  } catch (err) {
    console.warn('Gagal kirim skipWaiting:', err);
  }

  setTimeout(() => {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.replace(cleanUrl + '?updated=' + Date.now() + '#app');
  }, 500);
}

function checkPostUpdateNotice() {
  if (localStorage.getItem('vf_just_updated') === 'true') {
    localStorage.removeItem('vf_just_updated');

    const toast = document.getElementById('toast-update-success');
    const toastText = document.getElementById('toast-update-text');
    const currentVer = localStorage.getItem('vf_installed_version') || 'terbaru';

    if (toast && toastText) {
      toastText.textContent = `🎉 FinTrack berhasil diperbarui ke ${currentVer}!`;
      toast.classList.remove('hidden');

      setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => {
          toast.classList.add('hidden');
          toast.classList.remove('opacity-0');
        }, 500);
      }, 4000);
    }
  }
}
	
	let lastBackPressedTime = 0;
const APP_VERSION = 'v1.2.6';
	
	let pendingNewVersion = null; // Menyimpan versi baru yang terdeteksi di server

async function fetchAppVersionFromSW() {
  // 1. Tampilkan versi yang SAH terpasang saat ini (default awal mengikuti APP_VERSION jika belum ada)
  let installedVer = localStorage.getItem('vf_installed_version');
  if (!installedVer) {
    installedVer = APP_VERSION;
    localStorage.setItem('vf_installed_version', installedVer);
  }
  setText('app-installed-version', installedVer);

  // 2. Cek apakah ada file sw.js dengan versi lebih baru di server
  try {
    const response = await fetch('./sw.js?nocache=' + Date.now(), { 
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });

    if (response.ok) {
      const content = await response.text();
      const matchVar = content.match(/(?:CACHE_NAME|VERSION|APP_VERSION|CACHE_VERSION|CACHE_KEY)\s*=\s*['"`](.*?)['"`]/i);
      const rawString = matchVar ? matchVar[1] : content;
      const verMatch = rawString.match(/v?\d+\.\d+(?:\.\d+)?/i);

      if (verMatch) {
        let serverVersion = verMatch[0];
        if (!serverVersion.toLowerCase().startsWith('v')) {
          serverVersion = 'v' + serverVersion;
        }

        // Jika versi di server lebih baru dari versi terpasang:
        if (serverVersion !== installedVer) {
          pendingNewVersion = serverVersion;
          // Munculkan banner pembaruan
          showUpdateBanner();
        }
      }
    }
  } catch (err) {
    console.warn('Gagal cek pembaruan sw.js:', err);
  }
}
	
	function showExitConfirmModal() {
  const el = document.getElementById('exit-confirm-modal');
  if (el) {
    el.classList.remove('hidden');
    lucide.createIcons();
  }
}

function closeExitConfirmModal() {
  const el = document.getElementById('exit-confirm-modal');
  if (el) {
    el.classList.add('hidden');
  }
}

async function confirmExitApp() {
  // 1. Eksekusi upload instan jika masih ada data yang tertunda sebelum aplikasi ditutup
  await flushPendingCloudPush();

  isExitingApplication = true;
  closeExitConfirmModal();

  if (window.navigator && window.navigator.app && window.navigator.app.exitApp) {
    window.navigator.app.exitApp();
    return;
  }

  window.close();
  setTimeout(() => {
    history.go(-2);
  }, 100);
}

// Pemicu saat aplikasi diminimalkan / layar dimatikan / tab dibuka kembali (HP & PC)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Saat aplikasi ditinggalkan/ditutup ke latar belakang: langsung unggah jika ada pending
    flushPendingCloudPush();
  } else if (document.visibilityState === 'visible') {
    // Saat aplikasi dibuka kembali: langsung periksa data baru & notifikasi pengingat H-1/H-0
    if (navigator.onLine && isGdriveSessionActive()) {
      autoPullFromCloud();
    }
    if (typeof checkDueRecurringNotifications === 'function') {
      checkDueRecurringNotifications();
    }
  }
});

// Pemicu saat jendela browser ditutup (PC)
window.addEventListener('pagehide', () => {
  flushPendingCloudPush();
});

// Pengecekan rutin otomatis setiap 1 menit saat aplikasi sedang aktif menyala
setInterval(() => {
  if (navigator.onLine && isGdriveSessionActive()) {
    autoPullFromCloud();
  }
}, 60000);
	
	// ==================== MESIN GLOBAL IN-APP NUMPAD (TERINTEGRASI BACK & KURSOR) ====================
let activeNumpadTarget = null;
let isNumpadHistoryPushed = false;

function isMobileDevice() {
  return window.innerWidth < 768;
}

function setupMoneyInputsForNumpad() {
  const moneyInputs = [
    { id: 'tx-amount', label: 'Nominal Transaksi' },
    { id: 'tx-admin-fee', label: 'Biaya Admin Transfer' },
    { id: 'budget-amount', label: 'Batas Limit Anggaran' },
    { id: 'acc-balance', label: 'Saldo Awal Rekening' },
    { id: 'filter-amount-val', label: 'Filter Nominal' }
  ];

  moneyInputs.forEach(item => {
    const el = document.getElementById(item.id);
    if (!el) return;

    if (isMobileDevice()) {
      el.setAttribute('readonly', 'true');
      el.setAttribute('inputmode', 'none');
    } else {
      el.removeAttribute('readonly');
      el.setAttribute('inputmode', 'numeric');
    }

    el.onpointerdown = () => {
      if (isMobileDevice()) openInAppNumpad(el, item.label);
    };

    el.onclick = () => {
      if (isMobileDevice()) openInAppNumpad(el, item.label);
    };
  });
}

function openInAppNumpad(targetEl, label) {
  if (!isMobileDevice() || !targetEl) return;

  activeNumpadTarget = targetEl;
  const numpad = document.getElementById('global-inapp-numpad');
  const labelEl = document.getElementById('numpad-target-label');
  if (labelEl) labelEl.textContent = label || 'Nominal Uang';

  if (numpad && numpad.classList.contains('hidden')) {
    numpad.classList.remove('hidden');
    lucide.createIcons();

    // Dorong state riwayat agar Back HP menutup numpad terlebih dahulu
    if (!isNumpadHistoryPushed) {
      history.pushState({ numpadOpen: true }, '', window.location.hash);
      isNumpadHistoryPushed = true;
    }
  }

  // Bersihkan nilai acuan / default 0 jika pertama kali disentuh
  if (activeNumpadTarget.dataset && activeNumpadTarget.dataset.isRef === 'true') {
    activeNumpadTarget.placeholder = activeNumpadTarget.value || '0';
    activeNumpadTarget.value = '';
    activeNumpadTarget.classList.remove('text-slate-400', 'italic');
    activeNumpadTarget.classList.add('text-slate-900', 'font-bold');
    activeNumpadTarget.dataset.isRef = 'false';
  } else if (activeNumpadTarget.value === '0') {
    activeNumpadTarget.value = '';
  }

  // Highlight visual input aktif
  document.querySelectorAll('.numpad-active-ring').forEach(i => i.classList.remove('numpad-active-ring', 'ring-2', 'ring-emerald-500'));
  activeNumpadTarget.classList.add('numpad-active-ring', 'ring-2', 'ring-emerald-500');

  // Posisikan kursor di akhir angka
  const len = activeNumpadTarget.value.length;
  activeNumpadTarget.setSelectionRange(len, len);

  setTimeout(() => {
    activeNumpadTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function closeInAppNumpad(triggerHistoryBack = true) {
  const numpad = document.getElementById('global-inapp-numpad');
  if (numpad) numpad.classList.add('hidden');

  // Jika ditutup lewat tombol (Centang/X/Klik luar), sinkronkan riwayat browser
  if (triggerHistoryBack && isNumpadHistoryPushed) {
    isNumpadHistoryPushed = false;
    if (history.state && history.state.numpadOpen) {
      suppressNextPopstate = true;
      history.back();
    }
  } else {
    isNumpadHistoryPushed = false;
  }

  if (activeNumpadTarget) {
    activeNumpadTarget.classList.remove('numpad-active-ring', 'ring-2', 'ring-emerald-500');

    // Kembalikan nilai default jika kosong
    if (!activeNumpadTarget.value || !activeNumpadTarget.value.trim()) {
      if (activeNumpadTarget.id === 'budget-amount' && typeof handleBudgetAmountBlur === 'function') {
        handleBudgetAmountBlur(activeNumpadTarget);
      } else if (activeNumpadTarget.id === 'acc-balance' && typeof handleBalanceBlur === 'function') {
        handleBalanceBlur(activeNumpadTarget);
      } else if (activeNumpadTarget.id === 'tx-admin-fee') {
        activeNumpadTarget.value = '0';
      }
    }

    if (activeNumpadTarget.id === 'filter-amount-val' && typeof renderTransactions === 'function') {
      renderTransactions();
    }

    activeNumpadTarget = null;
  }
}

// Fungsi Menggeser Kursor ke Kiri atau Kanan untuk Edit Posisi Tertentu
function numpadMoveCursor(direction) {
  if (!activeNumpadTarget) return;
  const val = activeNumpadTarget.value;
  let pos = activeNumpadTarget.selectionStart ?? val.length;

  if (direction === 'left') {
    pos = Math.max(0, pos - 1);
    // Lompat jika melewati titik pemisah ribuan
    if (pos > 0 && val[pos - 1] === '.') {
      pos = Math.max(0, pos - 1);
    }
  } else if (direction === 'right') {
    pos = Math.min(val.length, pos + 1);
    // Lompat jika melewati titik pemisah ribuan
    if (pos < val.length && val[pos] === '.') {
      pos = Math.min(val.length, pos + 1);
    }
  }
  activeNumpadTarget.setSelectionRange(pos, pos);
}

// Input Angka pada Posisi Kursor Aktif
function numpadInputDigit(digitStr) {
  if (!activeNumpadTarget) return;

  const val = activeNumpadTarget.value;
  const start = activeNumpadTarget.selectionStart ?? val.length;
  const end = activeNumpadTarget.selectionEnd ?? val.length;

  const textBefore = val.slice(0, start).replace(/\D/g, '');
  const textAfter = val.slice(end).replace(/\D/g, '');

  // Jangan izinkan awalan 00 atau 000 saat kolom masih kosong
  if (!textBefore && !textAfter && (digitStr === '0' || digitStr === '00' || digitStr === '000')) {
    return;
  }

  const newRawDigits = textBefore + digitStr + textAfter;
  if (newRawDigits.length > 14) return;

  const formatted = formatNumberWithDots(newRawDigits);
  activeNumpadTarget.value = formatted;

  // Hitung posisi kursor yang presisi setelah penambahan titik ribuan
  const targetDigitIndex = textBefore.length + digitStr.length;
  let newCursorPos = formatted.length;
  let digitCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) digitCount++;
    if (digitCount === targetDigitIndex) {
      newCursorPos = i + 1;
      break;
    }
  }

  activeNumpadTarget.setSelectionRange(newCursorPos, newCursorPos);
  activeNumpadTarget.dispatchEvent(new Event('input', { bubbles: true }));
}

// Hapus Angka pada Posisi Kursor Aktif
function numpadBackspace() {
  if (!activeNumpadTarget) return;

  const val = activeNumpadTarget.value;
  let start = activeNumpadTarget.selectionStart ?? val.length;
  let end = activeNumpadTarget.selectionEnd ?? val.length;

  if (start === 0 && end === 0) return;

  let textBefore, textAfter, targetDigitIndex;

  if (start !== end) {
    textBefore = val.slice(0, start).replace(/\D/g, '');
    textAfter = val.slice(end).replace(/\D/g, '');
    targetDigitIndex = textBefore.length;
  } else {
    if (val[start - 1] === '.') start--;
    textBefore = val.slice(0, Math.max(0, start - 1)).replace(/\D/g, '');
    textAfter = val.slice(end).replace(/\D/g, '');
    targetDigitIndex = textBefore.length;
  }

  const newRawDigits = textBefore + textAfter;
  const formatted = newRawDigits ? formatNumberWithDots(newRawDigits) : '';
  activeNumpadTarget.value = formatted;

  let newCursorPos = 0;
  let digitCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) digitCount++;
    if (digitCount === targetDigitIndex) {
      newCursorPos = i + 1;
      break;
    }
  }

  activeNumpadTarget.setSelectionRange(newCursorPos, newCursorPos);
  activeNumpadTarget.dispatchEvent(new Event('input', { bubbles: true }));
}

function numpadClear() {
  if (!activeNumpadTarget) return;
  activeNumpadTarget.value = '';
  activeNumpadTarget.setSelectionRange(0, 0);
  activeNumpadTarget.dispatchEvent(new Event('input', { bubbles: true }));
}

// Tutup numpad otomatis jika user mengklik area luar
document.addEventListener('pointerdown', (e) => {
  const numpad = document.getElementById('global-inapp-numpad');
  if (!numpad || numpad.classList.contains('hidden')) return;

  if (!numpad.contains(e.target) && activeNumpadTarget && !activeNumpadTarget.contains(e.target)) {
    closeInAppNumpad();
  }
});
	
	function formatNumberWithDots(val) {
  if (!val && val !== 0) return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseDotsNumber(val) {
  if (!val) return 0;
  const clean = String(val).replace(/\./g, '').trim();
  return parseFloat(clean) || 0;
}

	function getElapsedMonthsCount(year) {
  const today = new Date();
  const currentFullYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1; // 1 s.d. 12
  const targetYearNum = parseInt(year);

  if (targetYearNum < currentFullYear) return 12;
  if (targetYearNum > currentFullYear) return 0;
  return currentMonthNum;
}

function formatTxAmountInput(el) {
  const cursor = el.selectionStart;
  const oldLen = el.value.length;
  const clean = el.value.replace(/\D/g, '');
  el.value = clean ? formatNumberWithDots(clean) : '';
  const newLen = el.value.length;
  const diff = newLen - oldLen;
  el.setSelectionRange(cursor + diff, cursor + diff);
}
	
	function handleBalanceFocus(el) {
  if (el.value === '0') {
    el.value = '';
  } else {
    setTimeout(() => el.select(), 50);
  }
}

	function setBudgetAmountField(amount, isReference = false, rawRefVal = 0) {
  const input = document.getElementById('budget-amount');
  const badge = document.getElementById('budget-amount-ref-badge');
  const hint = document.getElementById('budget-amount-hint');
  if (!input) return;

  if (isReference && amount > 0) {
    input.value = formatNumberWithDots(amount);
    input.placeholder = formatNumberWithDots(amount);
    input.dataset.isRef = "true";
    input.dataset.rawRef = String(amount);
    // Tampilan teks dibuat samar (blur/abu-abu pudar) sebagai acuan referensi
    input.classList.add('text-slate-400', 'italic');
    input.classList.remove('text-slate-900');
    if (badge) badge.classList.remove('hidden');
    if (hint) hint.classList.remove('hidden');
  } else {
    input.value = amount > 0 ? formatNumberWithDots(amount) : '';
    input.placeholder = '0';
    input.dataset.isRef = "false";
    input.dataset.rawRef = String(rawRefVal || 0);
    // Tampilan teks normal tegas (bold hitam)
    input.classList.remove('text-slate-400', 'italic');
    input.classList.add('text-slate-900', 'font-bold');
    if (badge) badge.classList.add('hidden');
    if (hint) hint.classList.add('hidden');
  }
}

function handleBudgetAmountFocus(el) {
  if (el.dataset.isRef === "true") {
    // Saat diklik, nilai acuan dialihkan ke placeholder latar belakang dan nilai input dikosongkan agar user langsung mengetik
    el.placeholder = el.value || '0';
    el.value = '';
    el.classList.remove('text-slate-400', 'italic');
    el.classList.add('text-slate-900', 'font-bold');
  } else {
    setTimeout(() => el.select(), 50);
  }
}

function handleBudgetAmountBlur(el) {
  // Jika user keluar dari field dan tidak mengetikkan apapun, kembalikan nilai acuan rata-rata
  if (!el.value || el.value.trim() === '') {
    if (el.dataset.rawRef && el.dataset.rawRef !== '0') {
      el.value = formatNumberWithDots(el.dataset.rawRef);
      el.dataset.isRef = "true";
      el.classList.add('text-slate-400', 'italic');
      el.classList.remove('text-slate-900');
      const badge = document.getElementById('budget-amount-ref-badge');
      if (badge) badge.classList.remove('hidden');
      const hint = document.getElementById('budget-amount-hint');
      if (hint) hint.classList.remove('hidden');
    } else {
      el.value = '0';
      el.dataset.isRef = "false";
    }
  }
}

function handleBudgetAmountInput(el) {
  // Saat user mulai mengetik nominal baru, matikan status referensi
  el.dataset.isRef = "false";
  el.classList.remove('text-slate-400', 'italic');
  el.classList.add('text-slate-900', 'font-bold');
  const badge = document.getElementById('budget-amount-ref-badge');
  if (badge) badge.classList.add('hidden');
  const hint = document.getElementById('budget-amount-hint');
  if (hint) hint.classList.add('hidden');
  formatTxAmountInput(el);
}

function handleBalanceBlur(el) {
  if (!el.value || el.value.trim() === '') {
    el.value = '0';
  }
}
	

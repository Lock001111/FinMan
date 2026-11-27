// ==================== Core Helpers: Local Dates, Toast/Dialog Modals, DOM, Currency, Title Case ====================

// --- LOCAL DATE & TIMEZONE-SAFE HELPERS ---
function getLocalDateStr(dateInput = new Date()) {
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

// --- NON-BLOCKING IN-APP TOAST & DIALOG HELPERS ---
function showAppToast(title, body, options = {}) {
  const stack = document.getElementById('app-toast-stack');
  if (!stack) return;

  const { actionLabel = '', onAction = null, duration = 9000, tone = 'amber', dedupeKey = '' } = options;
  if (dedupeKey) {
    const existing = [...stack.querySelectorAll('[data-toast-key]')].find(el => el.dataset.toastKey === dedupeKey);
    if (existing) existing.remove();
  }

  const toneCls = tone === 'rose'
    ? 'border-rose-300 bg-rose-50 text-rose-950'
    : tone === 'emerald'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
      : 'border-amber-300 bg-amber-50 text-amber-950';

  const card = document.createElement('div');
  if (dedupeKey) card.dataset.toastKey = dedupeKey;
  card.className = `pointer-events-auto p-3.5 rounded-2xl border shadow-xl ${toneCls} flex flex-col gap-2 transition-all duration-200`;
  card.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <div class="text-xs font-extrabold">${escapeHtml(title)}</div>
        <div class="text-[11px] opacity-90 mt-0.5 leading-snug">${escapeHtml(body)}</div>
      </div>
      <button type="button" class="toast-close-btn w-7 h-7 inline-flex items-center justify-center rounded-lg hover:bg-black/5 text-slate-500 shrink-0" aria-label="Tutup">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `;

  if (actionLabel && typeof onAction === 'function') {
    const btnWrap = document.createElement('div');
    btnWrap.className = 'flex justify-end';
    const actBtn = document.createElement('button');
    actBtn.type = 'button';
    actBtn.className = 'px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition';
    actBtn.textContent = actionLabel;
    actBtn.onclick = () => {
      card.remove();
      onAction();
    };
    btnWrap.appendChild(actBtn);
    card.appendChild(btnWrap);
  }

  const closeBtn = card.querySelector('.toast-close-btn');
  if (closeBtn) closeBtn.onclick = () => card.remove();

  stack.appendChild(card);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  if (duration > 0) {
    setTimeout(() => {
      if (card.parentNode) card.remove();
    }, duration);
  }
}

const appDialogQueue = [];
let isAppDialogOpen = false;

function processAppDialogQueue() {
  if (isAppDialogOpen || appDialogQueue.length === 0) return;
  const modal = document.getElementById('app-dialog-modal');
  if (!modal) return;

  isAppDialogOpen = true;
  const item = appDialogQueue.shift();

  const titleEl = document.getElementById('app-dialog-title');
  const msgEl = document.getElementById('app-dialog-message');
  const inputWrap = document.getElementById('app-dialog-input-wrap');
  const inputEl = document.getElementById('app-dialog-input');
  const cancelBtn = document.getElementById('app-dialog-cancel');
  const okBtn = document.getElementById('app-dialog-ok');

  if (titleEl) titleEl.textContent = item.title || 'Pemberitahuan';
  if (msgEl) msgEl.textContent = item.message || '';

  if (item.mode === 'prompt') {
    if (inputWrap) inputWrap.classList.remove('hidden');
    if (inputEl) {
      inputEl.type = item.inputType || 'password';
      inputEl.maxLength = item.maxLength || 6;
      inputEl.placeholder = item.placeholder || '';
      inputEl.value = item.defaultValue || '';
    }
  } else {
    if (inputWrap) inputWrap.classList.add('hidden');
  }

  if (cancelBtn) {
    cancelBtn.textContent = item.cancelLabel || 'Batal';
    if (item.mode === 'confirm' || item.mode === 'prompt') {
      cancelBtn.classList.remove('hidden');
    } else {
      cancelBtn.classList.add('hidden');
    }
  }
  if (okBtn) {
    okBtn.textContent = item.okLabel || 'OK';
  }

  const finish = (val) => {
    modal.classList.add('hidden');
    isAppDialogOpen = false;
    item.resolve(val);
    processAppDialogQueue();
  };

  if (okBtn) {
    okBtn.onclick = () => {
      if (item.mode === 'prompt') finish(inputEl ? inputEl.value : '');
      else if (item.mode === 'confirm') finish(true);
      else finish(undefined);
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      if (item.mode === 'prompt') finish(null);
      else finish(false);
    };
  }
  if (inputEl && item.mode === 'prompt') {
    inputEl.onkeydown = (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        okBtn?.click();
      }
    };
  }

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (item.mode === 'prompt' && inputEl) {
    setTimeout(() => inputEl.focus(), 50);
  } else if (okBtn) {
    setTimeout(() => okBtn.focus(), 50);
  }
}

function showAppAlert(message, title = 'Pemberitahuan') {
  return new Promise((resolve) => {
    appDialogQueue.push({ mode: 'alert', title, message: String(message ?? ''), resolve });
    processAppDialogQueue();
  });
}

function showAppConfirm(message, title = 'Konfirmasi', options = {}) {
  return new Promise((resolve) => {
    appDialogQueue.push({
      mode: 'confirm',
      title,
      message: String(message ?? ''),
      okLabel: options.okLabel || 'OK',
      cancelLabel: options.cancelLabel || 'Batal',
      resolve
    });
    processAppDialogQueue();
  });
}

function showAppPrompt(message, options = {}) {
  return new Promise((resolve) => {
    appDialogQueue.push({
      mode: 'prompt',
      title: options.title || 'Masukkan Data',
      message: String(message ?? ''),
      inputType: options.inputType || 'password',
      maxLength: options.maxLength || 6,
      placeholder: options.placeholder || '',
      defaultValue: options.defaultValue || '',
      resolve
    });
    processAppDialogQueue();
  });
}

// Override alert() bawaan browser agar aman di dalam iframe dan PWA mobile
window.alert = (msg) => { showAppAlert(msg); };

// --- GLOBAL RESPONSIVE TOOLTIP ENGINE (PC HOVER/FOCUS & MOBILE LONG-PRESS) ---
let activeTooltipTarget = null;
let tooltipTouchTimer = null;
let tooltipHideTimer = null;

function positionAppTooltip(el, tip) {
  const rect = el.getBoundingClientRect();
  tip.classList.remove('hidden');
  tip.style.left = '0px';
  tip.style.top = '0px';

  const tipRect = tip.getBoundingClientRect();
  const margin = 8;
  let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
  left = Math.max(margin, Math.min(window.innerWidth - tipRect.width - margin, left));

  let top = rect.top - tipRect.height - 8;
  if (top < margin) {
    top = rect.bottom + 8;
  }
  if (top + tipRect.height > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - tipRect.height - margin);
  }

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function showAppTooltip(el, autoHideMs = 0) {
  if (!el) return;
  const text = el.getAttribute('data-tooltip');
  const tip = document.getElementById('app-tooltip');
  if (!text || !tip) return;

  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }

  activeTooltipTarget = el;
  tip.textContent = text;
  positionAppTooltip(el, tip);

  if (autoHideMs > 0) {
    tooltipHideTimer = setTimeout(() => {
      hideAppTooltip();
    }, autoHideMs);
  }
}

function hideAppTooltip() {
  const tip = document.getElementById('app-tooltip');
  if (tip) tip.classList.add('hidden');
  activeTooltipTarget = null;
  if (tooltipTouchTimer) {
    clearTimeout(tooltipTouchTimer);
    tooltipTouchTimer = null;
  }
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

document.addEventListener('mouseover', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target) {
    if (target !== activeTooltipTarget) showAppTooltip(target);
  } else if (activeTooltipTarget) {
    hideAppTooltip();
  }
});

document.addEventListener('mouseout', (e) => {
  if (!activeTooltipTarget) return;
  const related = e.relatedTarget?.closest?.('[data-tooltip]');
  if (related !== activeTooltipTarget) hideAppTooltip();
});

document.addEventListener('focusin', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target) showAppTooltip(target);
});

document.addEventListener('focusout', () => {
  hideAppTooltip();
});

document.addEventListener('click', () => {
  hideAppTooltip();
});

document.addEventListener('touchstart', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (!target) {
    hideAppTooltip();
    return;
  }
  if (tooltipTouchTimer) clearTimeout(tooltipTouchTimer);
  tooltipTouchTimer = setTimeout(() => {
    showAppTooltip(target, 2200);
  }, 420);
}, { passive: true });

document.addEventListener('touchend', () => {
  if (tooltipTouchTimer) {
    clearTimeout(tooltipTouchTimer);
    tooltipTouchTimer = null;
  }
}, { passive: true });

window.addEventListener('scroll', hideAppTooltip, true);
window.addEventListener('resize', hideAppTooltip);

// --- GLOBAL SAFE DOM MANIPULATION HELPERS ---
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
}

// --- IDR CURRENCY FORMATTER ---
const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function formatCurrency(val) {
  const num = parseFloat(val);
  return idrFormatter.format(isNaN(num) ? 0 : num);
}
	
	// ==================== ENGINE SMART TITLE CASE (OFFLINE & BILINGUAL) ====================
const SMART_LOWERCASE_WORDS = new Set([
  // Bahasa Indonesia (Kata Sambung & Kata Depan Baku)
  'di', 'ke', 'dari', 'dan', 'atau', 'yang', 'untuk', 'pada', 'dengan', 'tentang',
  'oleh', 'sampai', 'hingga', 'karena', 'sebagai', 'dalam', 'atas', 'terhadap',
  'bagi', 'per', 'pun', 'si', 'sang',
  // Bahasa Inggris (Prepositions, Conjunctions & Articles)
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from',
  'by', 'with', 'in', 'of', 'as', 'into', 'onto', 'off', 'via'
]);

function toSmartTitleCase(str) {
  if (!str || typeof str !== 'string') return '';

  return str.split('\n').map(line => {
    const words = line.split(/(\s+)/);
    let isFirstWordInLine = true;

    return words.map(token => {
      if (/^\s+$/.test(token)) return token;

      const match = token.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9'-]+)([^a-zA-Z0-9]*)$/);
      if (!match) return token;

      const leadingPunct = match[1];
      const word = match[2];
      const trailingPunct = match[3];

      // ==================== PENGECUALIAN SINGKATAN (ALL-CAPS) ====================
      // Jika kata diketik kapital semua dengan panjang 2 s.d. 5 karakter (misal: SPBU, BCA, PLN, PDAM, IDR)
      // pertahankan huruf kapital penuh, jangan diubah menjadi Title Case
      if (/^[A-Z0-9]{2,5}$/.test(word)) {
        isFirstWordInLine = false;
        return leadingPunct + word + trailingPunct;
      }
      // =========================================================================

      const lowerWord = word.toLowerCase();

      let formattedWord;
      if (isFirstWordInLine) {
        formattedWord = lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
        isFirstWordInLine = false;
      } else if (SMART_LOWERCASE_WORDS.has(lowerWord)) {
        formattedWord = lowerWord;
      } else {
        formattedWord = lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
      }

      return leadingPunct + formattedWord + trailingPunct;
    }).join('');
  }).join('\n');
}

// Format subkategori yang dipisahkan koma
function formatSubcategoriesSmartTitleCase(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return '';
  return rawStr.split(',').map(s => toSmartTitleCase(s.trim())).filter(Boolean).join(', ');
}

// ==================== PENGAWAS BLUR: HANYA BERLAKU SAAT DATA BARU ====================
function handleTxNoteBlur(el) {
  // Hanya kapitalisasi jika tx-id KOSONG (berarti sedang mencatat transaksi baru)
  const txId = document.getElementById('tx-id')?.value;
  if (!txId && el.value) {
    el.value = toSmartTitleCase(el.value);
  }
}

function handleAccNameBlur(el) {
  // Hanya kapitalisasi jika acc-id KOSONG (menambah rekening baru)
  const accId = document.getElementById('acc-id')?.value;
  if (!accId && el.value) {
    el.value = toSmartTitleCase(el.value);
  }
}

function handleCatNameBlur(el) {
  // Hanya kapitalisasi jika cat-id KOSONG (menambah kategori baru)
  const catId = document.getElementById('cat-id')?.value;
  if (!catId && el.value) {
    el.value = toSmartTitleCase(el.value);
  }
}

function handleCatSubsBlur(el) {
  // Hanya kapitalisasi jika cat-id KOSONG (menambah kategori baru)
  const catId = document.getElementById('cat-id')?.value;
  if (!catId && el.value) {
    el.value = formatSubcategoriesSmartTitleCase(el.value);
  }
}

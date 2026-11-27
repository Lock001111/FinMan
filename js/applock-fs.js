// ==================== PIN AppLock & File System Access Auto-Backup ====================

// ==================== APP LOCK (PIN) ====================
let appLockConfig = JSON.parse(localStorage.getItem('vf_app_lock_config')) || {
  enabled: false,
  pinHash: '',
  salt: '',
  idleMinutes: 2
};

let lastUserActionTimestamp = Date.now();
let isAppCurrentlyLocked = false;

async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + pin);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuf)));
}

function checkAppLockOnStartup() {
  if (appLockConfig.enabled && appLockConfig.pinHash) {
    lockApp();
  }
  initInactivityListeners();
  renderAppLockSettingsUI();
}

function lockApp() {
  isAppCurrentlyLocked = true;
  const overlay = document.getElementById('app-lock-overlay');
  const pinInput = document.getElementById('applock-input-pin');
  if (overlay) overlay.classList.remove('hidden');
  if (pinInput) {
    pinInput.value = '';
    setTimeout(() => pinInput.focus(), 100);
  }
  lucide.createIcons();
}

async function verifyUnlockPin() {
  const input = document.getElementById('applock-input-pin')?.value.trim();
  if (!input) return;

  const hashed = await hashPin(input, appLockConfig.salt);
  if (hashed === appLockConfig.pinHash) {
    isAppCurrentlyLocked = false;
    document.getElementById('app-lock-overlay')?.classList.add('hidden');
    lastUserActionTimestamp = Date.now();
  } else {
    alert("PIN salah! Silakan coba lagi.");
    const pinInput = document.getElementById('applock-input-pin');
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  }
}

function initInactivityListeners() {
  const resetIdle = () => { lastUserActionTimestamp = Date.now(); };
  ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, resetIdle, { passive: true });
  });

  setInterval(() => {
    if (appLockConfig.enabled && appLockConfig.pinHash && !isAppCurrentlyLocked) {
      const timeoutMs = (appLockConfig.idleMinutes || 2) * 60 * 1000;
      if (Date.now() - lastUserActionTimestamp >= timeoutMs) {
        lockApp();
      }
    }
  }, 5000);
}

function forgotPinViaGoogle() {
  const clientId = localStorage.getItem('vf_gdrive_client_id');
  if (!clientId) {
    alert("Aplikasi belum terhubung dengan Google Client ID di Pengaturan.");
    return;
  }

  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    alert("Pustaka Google API belum termuat. Periksa koneksi internet Anda.");
    return;
  }

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    callback: (res) => {
      if (res.access_token) {
        document.getElementById('app-lock-overlay')?.classList.add('hidden');
        openModal('applock-reset-modal');
        lucide.createIcons();
      } else {
        alert("Autentikasi akun Google gagal.");
      }
    }
  });
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

async function submitResetNewPin() {
  const newPin = document.getElementById('reset-new-pin-val')?.value.trim();
  if (!newPin || newPin.length < 4) {
    alert("PIN minimal 4 angka.");
    return;
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashed = await hashPin(newPin, saltB64);

  appLockConfig.enabled = true;
  appLockConfig.salt = saltB64;
  appLockConfig.pinHash = hashed;
  localStorage.setItem('vf_app_lock_config', JSON.stringify(appLockConfig));

  closeModal('applock-reset-modal');
  isAppCurrentlyLocked = false;
  renderAppLockSettingsUI();
  alert("PIN berhasil direset! Aplikasi telah terbuka.");
}

function renderAppLockSettingsUI() {
  const chk = document.getElementById('applock-toggle');
  const badge = document.getElementById('applock-status-badge');
  const detail = document.getElementById('applock-settings-detail');
  const select = document.getElementById('applock-timeout-select');

  if (chk) chk.checked = appLockConfig.enabled;
  if (select) select.value = String(appLockConfig.idleMinutes || 2);

  if (appLockConfig.enabled) {
    if (badge) {
      badge.textContent = 'Aktif';
      badge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
    }
    if (detail) detail.classList.remove('hidden');
  } else {
    if (badge) {
      badge.textContent = 'Nonaktif';
      badge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500';
    }
    if (detail) detail.classList.add('hidden');
  }
}

async function toggleAppLockEnable() {
  const isChecked = document.getElementById('applock-toggle')?.checked;
  if (isChecked && !appLockConfig.pinHash) {
    const pin = await showAppPrompt("Buat 4-6 angka PIN pengaman aplikasi:", {
      title: 'Pasang PIN AppLock',
      inputType: 'password',
      maxLength: 6,
      placeholder: '••••••'
    });
    if (pin === null) {
      document.getElementById('applock-toggle').checked = false;
      return;
    }
    if (pin.trim().length < 4) {
      showAppAlert("PIN minimal 4 angka.");
      document.getElementById('applock-toggle').checked = false;
      return;
    }
    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    appLockConfig.pinHash = await hashPin(pin.trim(), salt);
    appLockConfig.salt = salt;
  }
  appLockConfig.enabled = isChecked;
  localStorage.setItem('vf_app_lock_config', JSON.stringify(appLockConfig));
  renderAppLockSettingsUI();
}

async function saveAppLockPin() {
  const pin = document.getElementById('applock-new-pin')?.value.trim();
  if (!pin || pin.length < 4) {
    alert("PIN minimal 4 angka.");
    return;
  }
  const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  appLockConfig.pinHash = await hashPin(pin, salt);
  appLockConfig.salt = salt;
  appLockConfig.enabled = true;
  localStorage.setItem('vf_app_lock_config', JSON.stringify(appLockConfig));
  setVal('applock-new-pin', '');
  renderAppLockSettingsUI();
  alert("PIN pengunci aplikasi berhasil diperbarui!");
}

function updateAppLockTimeout() {
  const mins = parseInt(document.getElementById('applock-timeout-select')?.value) || 2;
  appLockConfig.idleMinutes = mins;
  localStorage.setItem('vf_app_lock_config', JSON.stringify(appLockConfig));
}

// ==================== FILE SYSTEM ACCESS (AUTO BACKUP LOKAL) ====================
let fsFileHandle = null;
let fsDebounceTimer = null;
let isFsFirstRun = true;

const IDB_NAME = 'VF_FS_STORE';
const IDB_TABLE = 'handles';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_TABLE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveIDBHandle(handle) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_TABLE, 'readwrite');
      tx.objectStore(IDB_TABLE).put(handle, 'fsAutoBackup');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) { console.warn('IDB Save failed', e); }
}

async function getIDBHandle() {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_TABLE, 'readonly');
      const req = tx.objectStore(IDB_TABLE).get('fsAutoBackup');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch(e) { return null; }
}

async function deleteIDBHandle() {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_TABLE, 'readwrite');
      tx.objectStore(IDB_TABLE).delete('fsAutoBackup');
      tx.oncomplete = () => resolve();
    });
  } catch(e) {}
}

async function verifyFsPermission(handle, withPrompt = false) {
  if (!handle) return false;
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (withPrompt) {
    if ((await handle.requestPermission(opts)) === 'granted') return true;
  }
  return false;
}

async function initFsAutoBackup() {
  if (!('showSaveFilePicker' in window)) {
    setText('fs-status-badge', 'Tidak Didukung Browser');
    const badge = document.getElementById('fs-status-badge');
    if (badge) badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-300 shrink-0';
    return;
  }

  fsFileHandle = await getIDBHandle();
  if (fsFileHandle && fsBackupConfig.enabled) {
    setText('fs-target-display', fsBackupConfig.fileName || fsFileHandle.name || 'autobackup_keuangan.backup');
    const hasPerm = await verifyFsPermission(fsFileHandle, false);
    updateFsStatusUI(hasPerm);
  } else {
    updateFsStatusUI(false);
  }
}

function updateFsStatusUI(isGranted) {
  const badge = document.getElementById('fs-status-badge');
  const btnDisconnect = document.getElementById('btn-fs-disconnect');
  const btnConnect = document.getElementById('btn-fs-connect');
  const targetDisp = document.getElementById('fs-target-display');
  const syncLabel = document.getElementById('fs-last-sync-label');

  const targetName = fsFileHandle?.name || fsBackupConfig.fileName || 'autobackup_keuangan.backup';

  if (fsFileHandle && fsBackupConfig.enabled) {
    if (targetDisp) {
      targetDisp.textContent = `📁 File Explorer: ${targetName}`;
      targetDisp.classList.remove('text-slate-400');
      targetDisp.classList.add('text-emerald-700', 'font-bold');
    }

    if (btnDisconnect) btnDisconnect.classList.remove('hidden');
    if (btnConnect) btnConnect.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Ganti Berkas File Explorer`;

    if (isGranted) {
      if (badge) {
        badge.textContent = 'Terhubung & Aktif';
        badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0';
      }
    } else {
      if (badge) {
        badge.textContent = 'Perlu Izin Buka';
        badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0';
      }
    }
  } else {
    if (targetDisp) {
      targetDisp.textContent = '(Belum ada file dipilih)';
      targetDisp.classList.add('text-slate-400');
      targetDisp.classList.remove('text-emerald-700', 'font-bold');
    }
    if (badge) {
      badge.textContent = 'Belum Terhubung';
      badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-white text-slate-500 border border-slate-300 shrink-0';
    }
    if (btnDisconnect) btnDisconnect.classList.add('hidden');
    if (btnConnect) btnConnect.innerHTML = `<i data-lucide="folder-open" class="w-3.5 h-3.5"></i> Hubungkan Berkas di File Explorer`;
  }

  if (syncLabel) {
    if (fsBackupConfig.lastSynced) {
      const t = new Date(fsBackupConfig.lastSynced).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
      syncLabel.textContent = `Sinkronisasi Terakhir: ${t}`;
    } else {
      syncLabel.textContent = 'Sinkronisasi Terakhir: Belum pernah';
    }
  }
  lucide.createIcons();
}

async function connectFsTarget() {
  if (!('showSaveFilePicker' in window)) {
    alert('Fitur File System Access API memerlukan browser Chromium (Chrome, Edge, Opera, Brave).');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'autobackup_keuangan.backup',
      types: [{
        description: 'Backup File (*.backup)',
        accept: { 'application/octet-stream': ['.backup'] }
      }]
    });

    fsFileHandle = handle;
    fsBackupConfig.enabled = true;
    fsBackupConfig.fileName = handle.name;
    await saveIDBHandle(handle);
    isFsFirstRun = false;

    await writeFsAutoBackupFile();
    persistState(false);
    updateFsStatusUI(true);
    alert(`Berhasil terhubung ke "${handle.name}".`);
  } catch(err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      alert('Gagal menghubungkan file di File Explorer.');
    }
  }
}

async function disconnectFsTarget() {
  if (await showAppConfirm('Putuskan sinkronisasi otomatis ke File Explorer? Berkas di komputer Anda tidak akan dihapus.', 'Putuskan Auto-Backup')) {
    fsFileHandle = null;
    fsBackupConfig.enabled = false;
    fsBackupConfig.fileName = '';
    await deleteIDBHandle();
    persistState(false);
    updateFsStatusUI(false);
  }
}

function updateFsConfig() {
  const sel = document.getElementById('fs-delay-select');
  if (sel) {
    fsBackupConfig.delaySeconds = parseInt(sel.value) || 60;
    persistState(false);
  }
}

async function writeFsAutoBackupFile() {
  if (!fsFileHandle || !fsBackupConfig.enabled) return;
  try {
    const hasPerm = await verifyFsPermission(fsFileHandle, isFsFirstRun);
    if (!hasPerm) {
      updateFsStatusUI(false);
      return;
    }

    const payload = buildBackupPayload();
    const writable = await fsFileHandle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();

    fsBackupConfig.lastSynced = new Date().toISOString();
    isFsFirstRun = false;
    updateFsStatusUI(true);
  } catch(err) {
    console.warn('Gagal menulis berkas auto-backup ke File Explorer:', err);
    updateFsStatusUI(false);
  }
}

function scheduleFsAutoBackup() {
  if (!fsFileHandle || !fsBackupConfig.enabled) return;
  if (fsDebounceTimer) clearTimeout(fsDebounceTimer);
  const delayMs = isFsFirstRun ? 5000 : (fsBackupConfig.delaySeconds || 60) * 1000;

  fsDebounceTimer = setTimeout(async () => {
    await writeFsAutoBackupFile();
  }, delayMs);
}

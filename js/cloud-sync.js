// ==================== E2EE Encryption & Google Drive Cloud Sync / Conflict Resolution ====================

	// ==================== E2EE & GOOGLE DRIVE CLOUD SYNC ====================
let gdriveAccessToken = null;
let gdriveTokenClient = null;
let autoSyncPushTimer = null;
let cachedCloudFileId = null;
let pendingConflictPayload = null;

async function deriveAesKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Fungsi konversi Base64 anti-overflow (mampu menangani data ribuan transaksi)
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // Pecah per 32KB agar aman dari batas memori browser
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function b64ToBuf(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function encryptE2EE(dataObj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(dataObj));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return JSON.stringify({
    encrypted: true,
    cipher: "AES-GCM-256",
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    data: bufToB64(ciphertext) // Sekarang aman untuk data berukuran besar
  });
}

async function decryptE2EE(encryptedJsonStr, password) {
  const pkg = JSON.parse(encryptedJsonStr);
  if (!pkg.encrypted || !pkg.salt || !pkg.iv || !pkg.data) {
    throw new Error("Berkas tidak valid atau tidak terenkripsi.");
  }

  const salt = b64ToBuf(pkg.salt);
  const iv = b64ToBuf(pkg.iv);
  const ciphertext = b64ToBuf(pkg.data);

  const key = await deriveAesKey(password, salt);
  const decryptedBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decryptedBuf));
}

function setSyncBadge(status, customText = '') {
  const btn = document.getElementById('sync-status-badge-btn');
  const dot = document.getElementById('sync-badge-dot');
  const text = document.getElementById('sync-badge-text');
  if (!btn || !dot || !text) return;

  const styles = {
    synced: { dot: 'bg-emerald-500', btn: 'bg-emerald-50 border-emerald-200 text-emerald-800', label: 'Tersinkron' },
    waiting: { dot: 'bg-amber-500 animate-ping', btn: 'bg-amber-50 border-amber-200 text-amber-800', label: customText || 'Menunggu 60s' },
    syncing: { dot: 'bg-blue-500 animate-pulse', btn: 'bg-blue-50 border-blue-200 text-blue-800', label: customText || 'Menyinkronkan...' },
    downloaded: { dot: 'bg-purple-500', btn: 'bg-purple-50 border-purple-200 text-purple-800', label: 'Data Baru Dimuat' },
    error: { dot: 'bg-rose-500', btn: 'bg-rose-50 border-rose-200 text-rose-800', label: customText || 'Perlu Login' },
    offline: { dot: 'bg-slate-400', btn: 'bg-slate-50 border-slate-200 text-slate-500', label: 'Offline' }
  };

  const cur = styles[status] || styles.offline;
  dot.className = `w-2.5 h-2.5 rounded-full ${cur.dot}`;
  btn.className = `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition shadow-sm ${cur.btn}`;
  text.textContent = cur.label;
}

function openSyncBadgeModal() {
  openModal('sync-badge-modal');
}

function saveGdrivePrefs() {
  const clientId = document.getElementById('gdrive-client-id')?.value.trim() || '';
  const pin = document.getElementById('gdrive-encryption-pin')?.value.trim() || '';
  localStorage.setItem('vf_gdrive_client_id', clientId);
  localStorage.setItem('vf_gdrive_pin_persistent', pin);
}
	
	// ==================== STATE PENGUNCIAN KONFLIK SINKRONISASI ====================
let isSyncConflictLocked = false;
let cachedCloudConflictPayload = null;

// Batalkan sinkronisasi (Zero Overwrite) saat user memilih "Batal / Tinjau Nanti"
function cancelSyncConflict() {
  closeModal('sync-conflict-modal');
  isSyncConflictLocked = true;
  setSyncBadge('error', 'Konflik Data (Terkunci)');
}

// Menghitung komparasi data lokal vs data cloud secara mendalam
async function showConflictComparisonModal(cloudFileMeta, cloudDecryptedPayload) {
  cachedCloudConflictPayload = cloudDecryptedPayload;
  isSyncConflictLocked = true;
  setSyncBadge('error', 'Konflik Data');

  // 1. Data Ringkasan Lokal
  const localModTime = parseInt(localStorage.getItem('vf_local_modified_timestamp') || '0');
  const localModStr = localModTime ? new Date(localModTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Baru saja';
  setText('conflict-local-time', localModStr);
  setText('conflict-local-count', `${transactions.length} Transaksi`);

  let localNetWorth = 0;
  const accBalances = {};
  accounts.forEach(a => accBalances[a.id] = parseFloat(a.initialBalance || 0));
  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;
    if (tx.type === 'income' && accBalances[tx.accountId] !== undefined) accBalances[tx.accountId] += amt;
    else if (tx.type === 'expense' && accBalances[tx.accountId] !== undefined) accBalances[tx.accountId] -= amt;
    else if (tx.type === 'transfer') {
      if (accBalances[tx.accountId] !== undefined) accBalances[tx.accountId] -= (amt + fee);
      if (accBalances[tx.toAccountId] !== undefined) accBalances[tx.toAccountId] += amt;
    }
  });
  localNetWorth = Object.values(accBalances).reduce((a, b) => a + b, 0);
  setText('conflict-local-balance', formatCurrency(localNetWorth));

  // 2. Data Ringkasan Cloud
  const cloudModTime = cloudFileMeta.modifiedTime ? new Date(cloudFileMeta.modifiedTime).getTime() : Date.now();
  const cloudModStr = new Date(cloudModTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  setText('conflict-cloud-time', cloudModStr);

  const cloudTxs = cloudDecryptedPayload?.data?.transactions || [];
  const cloudAccs = cloudDecryptedPayload?.data?.accounts || [];
  setText('conflict-cloud-count', `${cloudTxs.length} Transaksi`);

  let cloudNetWorth = 0;
  const cAccBalances = {};
  cloudAccs.forEach(a => cAccBalances[a.id] = parseFloat(a.initialBalance || 0));
  cloudTxs.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;
    if (tx.type === 'income' && cAccBalances[tx.accountId] !== undefined) cAccBalances[tx.accountId] += amt;
    else if (tx.type === 'expense' && cAccBalances[tx.accountId] !== undefined) cAccBalances[tx.accountId] -= amt;
    else if (tx.type === 'transfer') {
      if (cAccBalances[tx.accountId] !== undefined) cAccBalances[tx.accountId] -= (amt + fee);
      if (cAccBalances[tx.toAccountId] !== undefined) cAccBalances[tx.toAccountId] += amt;
    }
  });
  cloudNetWorth = Object.values(cAccBalances).reduce((a, b) => a + b, 0);
  setText('conflict-cloud-balance', formatCurrency(cloudNetWorth));

  // 3. Cari Transaksi yang Berbeda (Diff Analysis)
  const cloudTxMap = new Map();
  cloudTxs.forEach(t => cloudTxMap.set(t.id, t));

  const localTxMap = new Map();
  transactions.forEach(t => localTxMap.set(t.id, t));

  const diffItems = [];

  // Transaksi yang HANYA ADA DI LOKAL
  transactions.forEach(t => {
    if (!cloudTxMap.has(t.id)) {
      diffItems.push({
        origin: 'local',
        tx: t,
        accName: accounts.find(a => a.id === t.accountId)?.name || 'Sumber Dana',
        catName: categories.find(c => c.id === t.categoryId)?.name || (t.type === 'transfer' ? 'Transfer' : 'Kategori')
      });
    }
  });

  // Transaksi yang HANYA ADA DI CLOUD
  cloudTxs.forEach(t => {
    if (!localTxMap.has(t.id)) {
      diffItems.push({
        origin: 'cloud',
        tx: t,
        accName: cloudAccs.find(a => a.id === t.accountId)?.name || 'Sumber Dana',
        catName: (cloudDecryptedPayload?.data?.categories || categories).find(c => c.id === t.categoryId)?.name || (t.type === 'transfer' ? 'Transfer' : 'Kategori')
      });
    }
  });

  // Tampilkan badge jumlah perbedaan
  const diffBadge = document.getElementById('conflict-diff-badge');
  if (diffBadge) diffBadge.textContent = `${diffItems.length} Perbedaan Transaksi`;

  // Render daftar perbedaan
  const listContainer = document.getElementById('conflict-diff-list');
  if (listContainer) {
    if (diffItems.length === 0) {
      listContainer.innerHTML = `<div class="py-6 text-center text-slate-400 italic text-xs">Catatan transaksi identik, perbedaan terletak pada perubahan akun/saldo awal.</div>`;
    } else {
      listContainer.innerHTML = diffItems.map(item => {
        const isLocal = item.origin === 'local';
        const badgeClass = isLocal ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';
        const originText = isLocal ? 'Hanya di HP Ini (Lokal)' : 'Hanya di Cloud (Drive)';
        const t = item.tx;
        const amtStr = (t.type === 'expense' ? '-' : '+') + formatCurrency(t.amount);
        const amtColor = (t.type === 'expense' ? 'text-rose-600' : 'text-emerald-600');

        return `
          <div class="pt-2 pb-1 flex items-start justify-between gap-2.5">
            <div class="space-y-0.5 flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-md ${badgeClass}">${originText}</span>
                <span class="font-bold text-slate-800 truncate">${escapeHtml(t.note || item.catName)}</span>
              </div>
              <div class="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>${t.date}</span>
                <span>•</span>
                <span class="text-slate-500 font-medium">${escapeHtml(item.accName)}</span>
                ${t.subcategory ? `<span>•</span><span class="bg-slate-100 px-1 rounded text-slate-600 text-[10px]">${escapeHtml(t.subcategory)}</span>` : ''}
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="font-extrabold ${amtColor}">${amtStr}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  openModal('sync-conflict-modal');
  lucide.createIcons();
}

	// ==================== SESI GOOGLE 48 JAM & INSTANT SYNC ====================
const GDRIVE_SESSION_MAX_IDLE = 48 * 60 * 60 * 1000; // 48 Jam dalam milidetik

function isGdriveSessionActive() {
  const lastActive = parseInt(localStorage.getItem('vf_gdrive_session_last_active') || '0');
  if (!lastActive) return false;
  return (Date.now() - lastActive) <= GDRIVE_SESSION_MAX_IDLE;
}

function updateGdriveSessionActivity() {
  localStorage.setItem('vf_gdrive_session_last_active', String(Date.now()));
}

// Memastikan token Google selalu valid selama sesi 48 jam masih aktif
async function ensureValidGdriveToken(forceRefresh = false) {
  const savedToken = localStorage.getItem('vf_gdrive_access_token');
  const tokenExpiresAt = parseInt(localStorage.getItem('vf_gdrive_token_expires') || '0');

  // Jika sudah melebihi 48 jam tidak aktif, putuskan sesi dan minta login ulang
  if (!isGdriveSessionActive()) {
    if (savedToken) {
      disconnectGdrive(false);
      setSyncBadge('error', 'Sesi Berakhir (48 Jam)');
    }
    return null;
  }

  // Jika token masih berlaku dan tidak dipaksa refresh
  if (!forceRefresh && savedToken && Date.now() < (tokenExpiresAt - 60000)) {
    gdriveAccessToken = savedToken;
    updateGdriveSessionActivity();
    return savedToken;
  }

  // Lakukan silent refresh di latar belakang (tanpa pop up) jika masih dalam sesi 48 jam
  return new Promise((resolve) => {
    const clientId = document.getElementById('gdrive-client-id')?.value.trim() || localStorage.getItem('vf_gdrive_client_id');
    if (!clientId || typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      resolve(null);
      return;
    }

    if (!gdriveTokenClient) {
      initGdriveAuth(() => {});
    }

    if (!gdriveTokenClient) {
      resolve(null);
      return;
    }

    const originalCallback = gdriveTokenClient.callback;
    gdriveTokenClient.callback = (tokenResponse) => {
      gdriveTokenClient.callback = originalCallback;
      if (tokenResponse && tokenResponse.access_token) {
        gdriveAccessToken = tokenResponse.access_token;
        const expiresInSec = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in) : 3600;
        localStorage.setItem('vf_gdrive_access_token', gdriveAccessToken);
        localStorage.setItem('vf_gdrive_token_expires', String(Date.now() + (expiresInSec * 1000) - 30000));
        updateGdriveSessionActivity();
        updateGdriveStatusUI(true);
        resolve(gdriveAccessToken);
      } else {
        resolve(null);
      }
    };

    try {
      // Permintaan token senyap tanpa prompt
      gdriveTokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      gdriveTokenClient.callback = originalCallback;
      resolve(null);
    }
  });
}

// Cek apakah ada perubahan data lokal yang belum sempat terunggah ke Cloud
function hasPendingCloudChanges() {
  // Jika status konflik terkunci, batalkan auto-sync untuk mencegah overwrite
  if (isSyncConflictLocked) return false;

  const lastSync = parseInt(localStorage.getItem('vf_last_sync_timestamp') || '0');
  const localMod = parseInt(localStorage.getItem('vf_local_modified_timestamp') || '0');
  return (localMod > lastSync) || (autoSyncPushTimer !== null);
}

// Eksekusi unggah instan saat berpindah menu atau keluar aplikasi
async function flushPendingCloudPush() {
  // KUNCI PENGAMAN: Batalkan pengunggahan jika konflik belum diselesaikan user
  if (isSyncConflictLocked) return;
  if (!hasPendingCloudChanges()) return;

  const pin = (document.getElementById('gdrive-encryption-pin')?.value || localStorage.getItem('vf_gdrive_pin_persistent') || '').trim();
  if (!pin) return;

  if (autoSyncPushTimer) {
    clearTimeout(autoSyncPushTimer);
    autoSyncPushTimer = null;
  }

  try {
    await executeCloudPush(pin);
  } catch (err) {
    console.warn('Gagal eksekusi instant upload:', err);
  }
}

function loadGdrivePrefs() {
  const clientId = localStorage.getItem('vf_gdrive_client_id') || '';
  const pin = (localStorage.getItem('vf_gdrive_pin_persistent') || sessionStorage.getItem('vf_gdrive_pin') || '').trim();
  setVal('gdrive-client-id', clientId);
  setVal('gdrive-encryption-pin', pin);

  const savedToken = localStorage.getItem('vf_gdrive_access_token');

  if (savedToken && isGdriveSessionActive()) {
    gdriveAccessToken = savedToken;
    updateGdriveStatusUI(true);
    setSyncBadge('synced');
    ensureValidGdriveToken(); // Refresh token di latar jika mendekati 1 jam
  } else if (savedToken) {
    setSyncBadge('error', 'Sesi Berakhir (48 Jam)');
    updateGdriveStatusUI(false);
  } else {
    setSyncBadge('offline');
    updateGdriveStatusUI(false);
  }

  const lastSync = localStorage.getItem('vf_gdrive_last_sync');
  if (lastSync) {
    const t = new Date(lastSync).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    setText('gdrive-last-sync-label', `Sinkronisasi Cloud: ${t}`);
  }
}

function initGdriveAuth(callback) {
  const clientId = document.getElementById('gdrive-client-id')?.value.trim() || localStorage.getItem('vf_gdrive_client_id');
  if (!clientId) {
    alert("Harap masukkan Google OAuth Client ID terlebih dahulu di form Pengaturan!");
    return false;
  }
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    alert("Pustaka Google API belum termuat. Periksa koneksi internet Anda.");
    return false;
  }

  gdriveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error(tokenResponse);
        setSyncBadge('error', 'Login Gagal');
        alert("Gagal autentikasi Google: " + tokenResponse.error);
        return;
      }
      gdriveAccessToken = tokenResponse.access_token;
      const expiresInSec = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in) : 3600;
      localStorage.setItem('vf_gdrive_access_token', gdriveAccessToken);
      localStorage.setItem('vf_gdrive_token_expires', String(Date.now() + (expiresInSec * 1000) - 30000));
      
      updateGdriveSessionActivity(); // Aktifkan sesi 48 jam
      updateGdriveStatusUI(true);
      setSyncBadge('synced');
      saveGdrivePrefs();
      if (callback) callback();
    }
  });
  return true;
}

function disconnectGdrive(showAlert = true) {
  if (gdriveAccessToken && typeof google !== 'undefined') {
    try { google.accounts.oauth2.revoke(gdriveAccessToken, () => {}); } catch(e) {}
  }
  gdriveAccessToken = null;
  localStorage.removeItem('vf_gdrive_access_token');
  localStorage.removeItem('vf_gdrive_token_expires');
  localStorage.removeItem('vf_gdrive_session_last_active');
  updateGdriveStatusUI(false);
  setSyncBadge('offline');
  if (showAlert) alert("Koneksi Google Drive diputuskan.");
}

function loginGdrive() {
  if (initGdriveAuth(async () => {
    await autoPullFromCloud(true);
  })) {
    gdriveTokenClient.requestAccessToken({ prompt: '' });
  }
}

function updateGdriveStatusUI(isLoggedIn) {
  const badge = document.getElementById('gdrive-status-badge');
  const btnLogin = document.getElementById('btn-gdrive-login');
  const btnLogout = document.getElementById('btn-gdrive-logout');
  const btnUpload = document.getElementById('btn-gdrive-upload');
  const btnDownload = document.getElementById('btn-gdrive-download');

  if (isLoggedIn) {
    if (badge) {
      badge.textContent = 'Terhubung & Aktif';
      badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 shrink-0';
    }
    if (btnLogin) btnLogin.classList.add('hidden');
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (btnUpload) btnUpload.classList.remove('hidden');
    if (btnDownload) btnDownload.classList.remove('hidden');
  } else {
    if (badge) {
      badge.textContent = 'Belum Login';
      badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-white text-slate-500 border border-slate-300 shrink-0';
    }
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (btnLogout) btnLogout.classList.add('hidden');
    if (btnUpload) btnUpload.classList.add('hidden');
    if (btnDownload) btnDownload.classList.add('hidden');
  }
  lucide.createIcons();
}

async function findGdriveBackupFile() {
  if (!gdriveAccessToken) return null;
  try {
    const q = "name = 'katalog_keuangan_secure.backup' and 'appDataFolder' in parents and trashed = false";
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`, {
      headers: { Authorization: `Bearer ${gdriveAccessToken}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      cachedCloudFileId = data.files[0].id;
      return data.files[0];
    }
  } catch (e) {
    console.warn("Gagal mengecek berkas cloud:", e);
  }
  return null;
}

async function autoPullFromCloud(isInitial = false) {
  if (!navigator.onLine) {
    setSyncBadge('offline');
    return;
  }
  const token = await ensureValidGdriveToken();
  if (!token) return;

  const pin = (localStorage.getItem('vf_gdrive_pin_persistent') || sessionStorage.getItem('vf_gdrive_pin') || '').trim();
  if (!pin) return;

  try {
    setSyncBadge('syncing', 'Memeriksa Cloud...');
    const cloudFile = await findGdriveBackupFile();
    if (!cloudFile) {
      setSyncBadge('synced');
      return;
    }

    const cloudModifiedTime = new Date(cloudFile.modifiedTime).getTime();
    const lastSyncTime = parseInt(localStorage.getItem('vf_last_sync_timestamp') || '0');
    const localModifiedTime = parseInt(localStorage.getItem('vf_local_modified_timestamp') || '0');

    // TERDETEKSI DATA DI CLOUD LEBIH BARU DARI SINKRONISASI TERAKHIR
    const isRestoredOffline = localStorage.getItem('vf_data_restored_offline') === 'true';

    // Deteksi apakah Cloud lebih baru ATAU data lokal baru saja dipulihkan dari backup
    if (cloudModifiedTime > lastSyncTime || isRestoredOffline) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cloudFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${gdriveAccessToken}` }
      });
      const encryptedContent = await res.text();
      const decryptedPayload = await decryptE2EE(encryptedContent, pin);

      // Cek apakah ada transaksi cloud yang tidak ada di lokal
      const cloudTxs = decryptedPayload?.data?.transactions || [];
      const localTxIds = new Set(transactions.map(t => t.id));
      const hasMissingTransactions = cloudTxs.some(t => !localTxIds.has(t.id));

      // JIKA ADA KONFLIK / DATA HILANG / HABIS RESTORE:
      if (localModifiedTime > lastSyncTime || hasMissingTransactions || isRestoredOffline) {
        pendingConflictPayload = cloudFile;
        await showConflictComparisonModal(cloudFile, decryptedPayload);
        return;
      }

      // Jika tidak ada konflik (hanya ada pembaruan dari cloud), terapkan pembaruan secara normal
      if (decryptedPayload && decryptedPayload.data) {
        accounts = decryptedPayload.data.accounts || accounts;
        categories = decryptedPayload.data.categories || categories;
        transactions = decryptedPayload.data.transactions || transactions;
        budgets = decryptedPayload.data.budgets || budgets;
        budgetHistory = decryptedPayload.data.budgetHistory || budgetHistory;
        recurringBills = decryptedPayload.data.recurringBills || recurringBills;
        customParameters = decryptedPayload.data.customParameters || customParameters;
        if (decryptedPayload.data.backupConfig) {
          backupConfig = Object.assign({}, defaultBackupConfig, decryptedPayload.data.backupConfig);
        }
        if (decryptedPayload.data.isNetWorthHidden !== undefined) {
          isNetWorthHidden = decryptedPayload.data.isNetWorthHidden;
        }
        if (decryptedPayload.data.dashPrivacy !== undefined) {
          dashPrivacy = Object.assign({ income: true, expense: false, savings: true }, decryptedPayload.data.dashPrivacy);
        }
        if (decryptedPayload.data.txPreferences !== undefined) {
          txPreferences = decryptedPayload.data.txPreferences;
        }

        const cloudSyncIso = new Date(cloudModifiedTime).toISOString();
        localStorage.setItem('vf_last_sync_timestamp', String(cloudModifiedTime));
        localStorage.setItem('vf_local_modified_timestamp', String(cloudModifiedTime));
        localStorage.setItem('vf_gdrive_last_sync', cloudSyncIso);
        updateGdriveSessionActivity();
        loadGdrivePrefs();
        sanitizeState();

        persistState(false);
        renderAll();

        setSyncBadge('downloaded');
        setTimeout(() => setSyncBadge('synced'), 4000);
      }
    } else {
      // Jika status konflik terkunci namun user membuka transaksi, ingatkan kembali
      if (isSyncConflictLocked && pendingConflictPayload && cachedCloudConflictPayload) {
        openModal('sync-conflict-modal');
        return;
      }
      if (!isSyncConflictLocked) {
        setSyncBadge('synced');
      }
    }
  } catch (err) {
    console.warn("Auto pull error:", err);
    setSyncBadge('error', 'Gagal Auto-Pull');
  }
}

function scheduleCloudAutoPush() {
  if (isSyncConflictLocked) return; // Jangan jadwalkan jika dalam status konflik
  if (!gdriveAccessToken) return;
  const pin = (localStorage.getItem('vf_gdrive_pin_persistent') || sessionStorage.getItem('vf_gdrive_pin') || '').trim();
  if (!pin) return;

  const nowTs = Date.now();
  localStorage.setItem('vf_local_modified_timestamp', String(nowTs));

  if (autoSyncPushTimer) clearTimeout(autoSyncPushTimer);
  setSyncBadge('waiting');

  autoSyncPushTimer = setTimeout(async () => {
    if (!isSyncConflictLocked) {
      await executeCloudPush(pin);
    }
  }, 60000);
}

async function executeCloudPush(pin, forcePush = false) {
  const token = await ensureValidGdriveToken();
  if (!token) return false;

  try {
    setSyncBadge('syncing', 'Memeriksa & Mengunggah...');
    const existingFile = await findGdriveBackupFile();

    // =========================================================================
    // PRE-UPLOAD CONFLICT CHECK: CEK DATA CLOUD SEBELUM MENIMPA
    // =========================================================================
    if (existingFile && !forcePush) {
      const cloudModifiedTime = new Date(existingFile.modifiedTime).getTime();
      const lastSyncTime = parseInt(localStorage.getItem('vf_last_sync_timestamp') || '0');
      const isRestoredOffline = localStorage.getItem('vf_data_restored_offline') === 'true';

      // Unduh dan dekripsi file cloud sementara ke memori untuk verifikasi
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${gdriveAccessToken}` }
      });
      const encryptedCheck = await checkRes.text();
      const cloudPayload = await decryptE2EE(encryptedCheck, pin);
      const cloudTxs = cloudPayload?.data?.transactions || [];

      // Cek apakah di Cloud ada transaksi yang TIDAK ADA di HP ini (data tertinggal/hilang)
      const localTxIds = new Set(transactions.map(t => t.id));
      const hasMissingTransactions = cloudTxs.some(t => !localTxIds.has(t.id));

      // JIKA CLOUD LEBIH BARU, ATAU ADA TRANSAKSI CLOUD YANG HILANG DI LOKAL, ATAU HABIS RESTORE:
      if (cloudModifiedTime > lastSyncTime || hasMissingTransactions || isRestoredOffline) {
        // STOP! JANGAN UPLOAD!
        isSyncConflictLocked = true;
        pendingConflictPayload = existingFile;
        await showConflictComparisonModal(existingFile, cloudPayload);
        return false; // Batalkan proses penimpaan ke Cloud
      }
    }
    // =========================================================================

    const rawPayload = buildBackupPayload();
    const encryptedBody = await encryptE2EE(rawPayload, pin);

    let uploadRes;
    if (existingFile) {
      uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media&fields=id,name,modifiedTime`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${gdriveAccessToken}`,
          'Content-Type': 'application/octet-stream'
        },
        body: encryptedBody
      });
    } else {
      const metadata = { name: 'katalog_keuangan_secure.backup', parents: ['appDataFolder'] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([encryptedBody], { type: 'application/octet-stream' }));

      uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
        method: 'POST',
        headers: { Authorization: `Bearer ${gdriveAccessToken}` },
        body: form
      });
    }

    if (!uploadRes.ok) {
      if (uploadRes.status === 401) {
        const newToken = await ensureValidGdriveToken(true);
        if (newToken) return executeCloudPush(pin, forcePush);
        setSyncBadge('error', 'Sesi Berakhir (48 Jam)');
        throw new Error('Sesi Google kedaluwarsa.');
      }
      const errRes = await uploadRes.json().catch(() => ({}));
      throw new Error(errRes.error?.message || `HTTP ${uploadRes.status}`);
    }

    const dataRes = await uploadRes.json();
    const serverModifiedTime = dataRes.modifiedTime ? new Date(dataRes.modifiedTime).getTime() : Date.now();
    const nowIso = new Date(serverModifiedTime).toISOString();

    // Sinkronisasi berhasil: hapus tanda restore offline dan simpan waktu baru
    localStorage.removeItem('vf_data_restored_offline');
    localStorage.setItem('vf_last_sync_timestamp', String(serverModifiedTime));
    localStorage.setItem('vf_local_modified_timestamp', String(serverModifiedTime));
    localStorage.setItem('vf_gdrive_last_sync', nowIso);
    updateGdriveSessionActivity();

    const t = new Date(nowIso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    setText('gdrive-last-sync-label', `Sinkronisasi Cloud: ${t}`);

    setSyncBadge('synced');
    return true;
  } catch (err) {
    console.error("Auto push error:", err);
    setSyncBadge('error', 'Gagal Auto-Push');
    throw err;
  }
}

async function resolveConflictKeepLocal() {
  closeModal('sync-conflict-modal');
  isSyncConflictLocked = false;
  cachedCloudConflictPayload = null;

  const pin = (document.getElementById('gdrive-encryption-pin')?.value || localStorage.getItem('vf_gdrive_pin_persistent') || '').trim();
  if (pin) {
    try {
      // Kirim parameter forcePush = true karena user secara sadar memilih menimpa Cloud
      const pushed = await executeCloudPush(pin, true);
      if (pushed) {
        localStorage.removeItem('vf_data_restored_offline');
        showAppAlert('Berhasil! Data perangkat ini telah diunggah dan memperbarui Google Drive.');
      }
    } catch (e) {
      showAppAlert('Gagal mengunggah data lokal ke cloud: ' + (e.message || e));
    }
  }
}

async function resolveConflictKeepCloud() {
  closeModal('sync-conflict-modal');
  isSyncConflictLocked = false; // Buka kunci pengaman

  const pin = (document.getElementById('gdrive-encryption-pin')?.value || localStorage.getItem('vf_gdrive_pin_persistent') || '').trim();
  if (!pin) return;

  try {
    let payload = cachedCloudConflictPayload;

    // Jika belum ada di memori cache, unduh kembali dari cloud
    if (!payload && pendingConflictPayload) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${pendingConflictPayload.id}?alt=media`, {
        headers: { Authorization: `Bearer ${gdriveAccessToken}` }
      });
      const encryptedContent = await res.text();
      payload = await decryptE2EE(encryptedContent, pin);
    }

    if (payload && payload.data) {
      accounts = payload.data.accounts || accounts;
      categories = payload.data.categories || categories;
      transactions = payload.data.transactions || transactions;
      budgets = payload.data.budgets || budgets;
      budgetHistory = payload.data.budgetHistory || budgetHistory;
      recurringBills = payload.data.recurringBills || recurringBills;
      customParameters = payload.data.customParameters || customParameters;
      if (payload.data.backupConfig) {
        backupConfig = Object.assign({}, defaultBackupConfig, payload.data.backupConfig);
      }
      if (payload.data.isNetWorthHidden !== undefined) {
        isNetWorthHidden = payload.data.isNetWorthHidden;
      }
      if (payload.data.dashPrivacy !== undefined) {
        dashPrivacy = Object.assign({ income: true, expense: false, savings: true }, payload.data.dashPrivacy);
      }
      if (payload.data.txPreferences !== undefined) {
        txPreferences = payload.data.txPreferences;
      }

      const cloudTime = pendingConflictPayload?.modifiedTime ? new Date(pendingConflictPayload.modifiedTime).getTime() : Date.now();
      const syncTimeIso = new Date(cloudTime).toISOString();
      localStorage.setItem('vf_last_sync_timestamp', String(cloudTime));
      localStorage.setItem('vf_local_modified_timestamp', String(cloudTime));
      localStorage.setItem('vf_gdrive_last_sync', syncTimeIso);
      localStorage.removeItem('vf_data_restored_offline');
      updateGdriveSessionActivity();
      loadGdrivePrefs();

      sanitizeState();
      persistState(false);
      renderAll();

      cachedCloudConflictPayload = null;
      pendingConflictPayload = null;
      setSyncBadge('synced');
      showAppAlert('Berhasil! Data perangkat ini telah diperbarui mengikuti data Google Drive.');
    }
  } catch (err) {
    showAppAlert('Gagal memulihkan data dari cloud: ' + (err.message || err));
  }
}

async function syncUploadToGdrive() {
  const pin = (document.getElementById('gdrive-encryption-pin')?.value || localStorage.getItem('vf_gdrive_pin_persistent') || '').trim();
  if (!pin) {
    showAppAlert("Harap masukkan PIN / Kata Sandi Enkripsi terlebih dahulu!");
    return;
  }
  if (!gdriveAccessToken) {
    loginGdrive();
    return;
  }

  try {
    setSyncBadge('syncing', 'Mengunggah ke Cloud...');
    const uploaded = await executeCloudPush(pin);
    if (uploaded) {
      showAppAlert("Berhasil! Seluruh data hasil pemulihan telah dienkripsi dan tersimpan di Google Drive.");
    }
  } catch (err) {
    console.error("Gagal unggah manual:", err);
    showAppAlert("Gagal mengunggah ke Cloud: " + (err.message || "Periksa koneksi internet atau PIN enkripsi Anda."));
  }
}

async function syncDownloadFromGdrive() {
  const pin = (document.getElementById('gdrive-encryption-pin')?.value || localStorage.getItem('vf_gdrive_pin_persistent') || '').trim();
  if (!pin) {
    showAppAlert("Harap masukkan PIN / Kata Sandi Enkripsi Anda untuk membuka data!");
    return;
  }
  if (!gdriveAccessToken) {
    loginGdrive();
    return;
  }

  try {
    const file = await findGdriveBackupFile();
    if (!file) {
      showAppAlert("Tidak ditemukan berkas cadangan di Google Drive akun ini.");
      return;
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${gdriveAccessToken}` }
    });
    const encryptedContent = await res.text();
    const decryptedPayload = await decryptE2EE(encryptedContent, pin);

    const syncTime = file.modifiedTime ? new Date(file.modifiedTime).toISOString() : new Date().toISOString();
    localStorage.setItem('vf_gdrive_last_sync', syncTime);
    localStorage.setItem('vf_last_sync_timestamp', String(new Date(syncTime).getTime()));
    localStorage.setItem('vf_local_modified_timestamp', String(new Date(syncTime).getTime()));
    loadGdrivePrefs();

    promptRestoreConfirmation(decryptedPayload);
  } catch (err) {
    console.error(err);
    showAppAlert("Gagal mengunduh atau mendekripsi dari Google Drive. Pastikan PIN benar!");
  }
}

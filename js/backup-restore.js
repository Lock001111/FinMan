// ==================== Local Backup Snapshots & File Restore ====================

// ==================== CADANGAN & PEMULIHAN (BACKUP & RESTORE) ====================
function buildBackupPayload() {
  return {
    format: 'KATALOG_KEUANGAN_BACKUP',
    extension: '.backup',
    version: '1.0',
    timestamp: new Date().toISOString(),
    deviceInfo: navigator.userAgent,
    data: {
      accounts: accounts,
      categories: categories,
      transactions: transactions,
      budgets: budgets,
      budgetHistory: budgetHistory,
		  recurringBills: recurringBills,
		  customParameters: customParameters,
      backupConfig: backupConfig,
      isNetWorthHidden: isNetWorthHidden,
      dashPrivacy: dashPrivacy,
      txPreferences: txPreferences
    }
  };
}

function createSnapshot(triggerType = 'Manual', triggerDownload = false) {
  const payload = buildBackupPayload();
  const snapshotItem = {
    id: 'snap-' + Date.now(),
    timestamp: payload.timestamp,
    triggerType: triggerType,
    txCount: transactions.length,
    accCount: accounts.length,
    catCount: categories.length,
    payload: payload
  };

  if (backupConfig.retention === 'auto_remove') {
    const limit = parseInt(backupConfig.retentionLimit) || 5;
    backupSnapshots.unshift(snapshotItem);
    if (backupSnapshots.length > limit) {
      backupSnapshots = backupSnapshots.slice(0, limit);
    }
  } else {
    backupSnapshots.unshift(snapshotItem);
  }

  backupConfig.lastBackupTime = payload.timestamp;
  persistState(false);

  if (triggerDownload) {
    downloadBackupFile(payload);
  }
  renderBackupSettingsView();
}

function createManualBackup(downloadFile = true) {
  createSnapshot('Manual', downloadFile);
}

function downloadBackupFile(payload) {
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const datePart = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `Keuangan_${datePart}.backup`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadSnapshotById(id) {
  const snap = backupSnapshots.find(s => s.id === id);
  if (snap && snap.payload) {
    downloadBackupFile(snap.payload);
  }
}

async function deleteSnapshotById(id) {
  if (await showAppConfirm('Hapus file snapshot cadangan ini dari perangkat?', 'Hapus Snapshot')) {
    backupSnapshots = backupSnapshots.filter(s => s.id !== id);
    persistState(false);
    renderBackupSettingsView();
  }
}

function checkPeriodicAutoBackup() {
  if (backupConfig.frequency === 'daily' || backupConfig.frequency === 'weekly') {
    if (!backupConfig.lastBackupTime) {
      createSnapshot('Otomatis (Awal)', false);
      return;
    }
    const last = new Date(backupConfig.lastBackupTime).getTime();
    const diffDays = (Date.now() - last) / (1000 * 3600 * 24);

    if (backupConfig.frequency === 'daily' && diffDays >= 1) {
      createSnapshot('Otomatis (Harian)', false);
    } else if (backupConfig.frequency === 'weekly' && diffDays >= 7) {
      createSnapshot('Otomatis (Mingguan)', false);
    }
  }
}

function updateBackupConfig() {
  const freqSel = document.getElementById('backup-freq-select');
  const retSel = document.getElementById('backup-retention-select');
  const limSel = document.getElementById('backup-limit-select');

  if (freqSel) backupConfig.frequency = freqSel.value;
  if (retSel) backupConfig.retention = retSel.value;
  if (limSel) backupConfig.retentionLimit = parseInt(limSel.value) || 5;

  if (backupConfig.retention === 'auto_remove' && backupSnapshots.length > backupConfig.retentionLimit) {
    backupSnapshots = backupSnapshots.slice(0, backupConfig.retentionLimit);
  }

  toggleRetentionLimitUI();
  persistState(false);
  renderBackupSettingsView();
}

function toggleRetentionLimitUI() {
  const retention = document.getElementById('backup-retention-select')?.value || 'auto_remove';
  const limitWrap = document.getElementById('retention-limit-wrap');
  if (limitWrap) {
    if (retention === 'keep_all') {
      limitWrap.classList.add('opacity-40', 'pointer-events-none');
    } else {
      limitWrap.classList.remove('opacity-40', 'pointer-events-none');
    }
  }
}

function handleRestoreFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.data || !Array.isArray(parsed.data.accounts) || !Array.isArray(parsed.data.transactions)) {
        throw new Error('Format file cadangan tidak sesuai.');
      }
      promptRestoreConfirmation(parsed);
    } catch (err) {
      alert('Gagal membaca file cadangan! Pastikan file adalah file .backup resmi dari aplikasi FinTrack.');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function restoreFromSnapshotId(id) {
  const snap = backupSnapshots.find(s => s.id === id);
  if (snap && snap.payload) {
    promptRestoreConfirmation(snap.payload);
  }
}

function promptRestoreConfirmation(payload) {
  pendingRestoreData = payload;
  const dateStr = new Date(payload.timestamp || Date.now()).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  setText('preview-backup-date', dateStr);
  setText('preview-backup-tx-count', `${(payload.data.transactions || []).length} Transaksi`);
  setText('preview-backup-acc-count', `${(payload.data.accounts || []).length} Rekening`);
  setText('preview-backup-cat-count', `${(payload.data.categories || []).length} Kategori`);

  openModal('restore-confirm-modal');
  lucide.createIcons();
}

function executeRestore() {
  if (!pendingRestoreData || !pendingRestoreData.data) return;

  accounts = pendingRestoreData.data.accounts || defaultAccounts;
  categories = pendingRestoreData.data.categories || defaultCategories;
  transactions = pendingRestoreData.data.transactions || [];
  budgets = pendingRestoreData.data.budgets || {};
  budgetHistory = pendingRestoreData.data.budgetHistory || [];
	  recurringBills = pendingRestoreData.data.recurringBills || defaultRecurringBills;
  customParameters = pendingRestoreData.data.customParameters || defaultCustomParameters;
	  
  if (pendingRestoreData.data.backupConfig) {
    backupConfig = Object.assign({}, defaultBackupConfig, pendingRestoreData.data.backupConfig);
  }
  if (pendingRestoreData.data.isNetWorthHidden !== undefined) {
    isNetWorthHidden = pendingRestoreData.data.isNetWorthHidden;
  }
  if (pendingRestoreData.data.dashPrivacy !== undefined) {
    dashPrivacy = Object.assign({ income: true, expense: false, savings: true }, pendingRestoreData.data.dashPrivacy);
  }
  if (pendingRestoreData.data.txPreferences !== undefined) {
    txPreferences = pendingRestoreData.data.txPreferences;
  }

  createSnapshot('Dipulihkan dari File', false);
  sanitizeState();
  persistState(false);
  closeModal('restore-confirm-modal');
  pendingRestoreData = null;

  // =========================================================================
  // PENGAMAN RESTORE: RESET STATUS SYNC AGAR TIDAK MENIMPA CLOUD
  // =========================================================================
  localStorage.setItem('vf_data_restored_offline', 'true');
  localStorage.removeItem('vf_last_sync_timestamp'); // Batalkan stempel waktu lama
  localStorage.setItem('vf_local_modified_timestamp', String(Date.now()));
  // =========================================================================

  initPickers();
  renderAll();
  alert('Data rekening, transaksi, kategori, dan pengaturan berhasil dipulihkan!');

  // Jika akun Google sedang aktif, langsung cocokkan dengan Cloud saat itu juga
  if (navigator.onLine && isGdriveSessionActive()) {
    setTimeout(() => {
      autoPullFromCloud();
    }, 500);
  }
}

function renderBackupSettingsView() {
  const lastLabel = document.getElementById('last-backup-status');
  if (lastLabel) {
    if (backupConfig.lastBackupTime) {
      const timeAgo = new Date(backupConfig.lastBackupTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      lastLabel.textContent = `Terakhir: ${timeAgo}`;
    } else {
      lastLabel.textContent = 'Terakhir: Belum ada cadangan';
    }
  }

  const tbody = document.getElementById('backup-snapshots-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (backupSnapshots.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-slate-400">Belum ada file cadangan yang tersimpan di perangkat ini.</td></tr>`;
    return;
  }

  backupSnapshots.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    const formattedDate = new Date(s.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    tr.innerHTML = `
      <td class="px-4 py-2.5 font-semibold text-slate-800">${formattedDate}</td>
      <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.triggerType.includes('Manual') ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}">${escapeHtml(s.triggerType)}</span></td>
      <td class="px-4 py-2.5 text-slate-500">${s.txCount} Transaksi, ${s.accCount} Rekening</td>
      <td class="px-4 py-2.5 text-center whitespace-nowrap">
        <div class="inline-flex items-center justify-center gap-1.5">
          <button type="button" onclick="restoreFromSnapshotId('${s.id}')" data-tooltip="Pulihkan data dari cadangan ini" aria-label="Pulihkan data dari cadangan ini" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition shrink-0">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="downloadSnapshotById('${s.id}')" data-tooltip="Unduh file .backup" aria-label="Unduh file .backup" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition shrink-0">
            <i data-lucide="download" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="deleteSnapshotById('${s.id}')" data-tooltip="Hapus cadangan" aria-label="Hapus cadangan" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shrink-0">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

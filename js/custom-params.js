// ==================== Custom Transaction Parameters & Form Integration ====================

	// ==================== PENGENDALI PARAMETER KUSTOM DI PENGATURAN ====================
let isCustomParamCollapsed = JSON.parse(localStorage.getItem('vf_setting_param_collapsed') || 'false');

function toggleCustomParamCollapse() {
  isCustomParamCollapsed = !isCustomParamCollapsed;
  localStorage.setItem('vf_setting_param_collapsed', JSON.stringify(isCustomParamCollapsed));
  applyCustomParamCollapseUI();
}

function applyCustomParamCollapseUI() {
  const body = document.getElementById('setting-custom-param-body');
  const icon = document.getElementById('icon-chevron-param-setting');
  if (!body) return;

  if (isCustomParamCollapsed) {
    body.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    body.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }
  lucide.createIcons();
}

function clearCustomParamSearch() {
  setVal('param-search-input', '');
  const btn = document.getElementById('param-search-clear');
  if (btn) btn.classList.add('hidden');
  renderCustomParameters();
}

function resetCustomParamFilterAndSort() {
  setVal('param-search-input', '');
  const btn = document.getElementById('param-search-clear');
  if (btn) btn.classList.add('hidden');
  setVal('param-filter-category', 'ALL');
  setVal('param-sort', 'subcat-asc');
  renderCustomParameters();
}

function renderCustomParameters() {
  const container = document.getElementById('custom-parameters-list');
  const headerBadge = document.getElementById('badge-param-count-header');
  const filterCountEl = document.getElementById('param-filter-count');
  const catFilterSelect = document.getElementById('param-filter-category');

  normalizeCustomParametersData();

  if (headerBadge) headerBadge.textContent = `${customParameters.length} Parameter`;

  if (catFilterSelect && catFilterSelect.options.length <= 1) {
    const uniqueCatIds = Array.from(new Set(customParameters.map(cp => cp.categoryId)));
    uniqueCatIds.forEach(cId => {
      const c = categories.find(cat => cat.id === cId);
      if (c) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        catFilterSelect.appendChild(opt);
      }
    });
  }

  if (!container) return;

  const searchInput = document.getElementById('param-search-input');
  const query = (searchInput?.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('param-search-clear');
  if (clearBtn) {
    if (query) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const selectedCatFilter = catFilterSelect?.value || 'ALL';
  const sortOpt = document.getElementById('param-sort')?.value || 'subcat-asc';

  let items = customParameters.map(cp => {
    const cat = categories.find(c => c.id === cp.categoryId);
    return { ...cp, catName: cat?.name || 'Kategori' };
  });

  if (selectedCatFilter !== 'ALL') {
    items = items.filter(it => it.categoryId === selectedCatFilter);
  }

  if (query) {
    items = items.filter(it => 
      it.subcategory.toLowerCase().includes(query) ||
      it.catName.toLowerCase().includes(query) ||
      it.parameters.some(p => p.name.toLowerCase().includes(query) || (p.unit && p.unit.toLowerCase().includes(query)))
    );
  }

  if (sortOpt === 'subcat-asc') items.sort((a, b) => a.subcategory.localeCompare(b.subcategory, 'id'));
  else if (sortOpt === 'subcat-desc') items.sort((a, b) => b.subcategory.localeCompare(a.subcategory, 'id'));
  else if (sortOpt === 'count-desc') items.sort((a, b) => b.parameters.length - a.parameters.length);

  if (filterCountEl) filterCountEl.textContent = `Menampilkan ${items.length} parameter`;

  if (items.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-400 italic">Belum ada parameter kustom yang cocok.</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
      <div>
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h4 class="font-bold text-slate-900 text-sm truncate">${escapeHtml(item.subcategory)}</h4>
            <span class="text-[11px] text-slate-400 block truncate">${escapeHtml(item.catName)}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 shrink-0">
            ${item.parameters.length} Kolom
          </span>
        </div>

        <!-- TAGS PARAMETER DENGAN SATUAN -->
        <div class="flex flex-wrap gap-1 mt-2.5">
          ${item.parameters.map(p => `
            <span class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>${escapeHtml(p.name)}${p.unit ? ` <strong class="text-slate-400">(${escapeHtml(p.unit)})</strong>` : ''}</span>
            </span>
          `).join('')}
        </div>
      </div>

      <div class="flex items-center justify-end gap-1.5 pt-2.5 border-t border-slate-200/70">
        <button type="button" onclick="openCustomParamModal('${item.id}')" data-tooltip="Ubah parameter" aria-label="Ubah parameter" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shrink-0">
          <i data-lucide="edit-3" class="w-4 h-4"></i>
        </button>
        <button type="button" onclick="deleteCustomParameter('${item.id}')" data-tooltip="Hapus parameter" aria-label="Hapus parameter" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shrink-0">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// Modal Create / Edit Parameter
function openCustomParamModal(editId = null) {
  const catSelect = document.getElementById('param-modal-category');
  const subSelect = document.getElementById('param-modal-subcategory');
  const fieldsList = document.getElementById('param-modal-fields-list');

  if (catSelect) {
    catSelect.innerHTML = `<option value="">-- Pilih Kategori --</option>` + 
      categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})</option>`).join('');
  }

  if (fieldsList) fieldsList.innerHTML = '';

  if (editId) {
    const item = customParameters.find(cp => String(cp.id) === String(editId));
    if (!item) return;

    setText('param-modal-title', 'Ubah Parameter Kustom');
    setVal('param-id', item.id);
    setVal('param-modal-category', item.categoryId);

    onParamModalCategoryChange(item.subcategory);

    (item.parameters || []).forEach(p => {
      const pName = typeof p === 'string' ? p : (p.name || '');
      const pUnit = typeof p === 'string' ? '' : (p.unit || '');
      addParamInputField(pName, pUnit);
    });
  } else {
    setText('param-modal-title', 'Tambah Parameter Kustom');
    setVal('param-id', '');
    if (subSelect) subSelect.innerHTML = `<option value="">-- Pilih Kategori Dahulu --</option>`;
    addParamInputField('', '');
  }

  openModal('custom-parameter-modal');
  lucide.createIcons();
}

function onParamModalCategoryChange(selectedSub = '') {
  const catId = document.getElementById('param-modal-category')?.value;
  const subSelect = document.getElementById('param-modal-subcategory');
  if (!subSelect) return;

  const cat = categories.find(c => c.id === catId);
  if (cat && cat.subcategories && cat.subcategories.length > 0) {
    const sortedSubs = [...cat.subcategories].sort((a, b) => a.localeCompare(b, 'id'));
    subSelect.innerHTML = `<option value="">-- Pilih Subkategori --</option>` + 
      sortedSubs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if (selectedSub) subSelect.value = selectedSub;
  } else {
    subSelect.innerHTML = `<option value="">Tidak ada subkategori pada kategori ini</option>`;
  }
}
	
// Sanitasi data lama (jika sebelumnya parameter berupa string biasa, ubah ke objek { name, unit })
function normalizeCustomParametersData() {
  customParameters.forEach((cp, idx) => {
    if (!cp.id) cp.id = 'param-' + Date.now() + '-' + idx;
    if (!Array.isArray(cp.parameters)) cp.parameters = [];
    cp.parameters = cp.parameters.map(p => {
      if (typeof p === 'string') {
        return { name: p, unit: '' };
      }
      return { name: p.name || '', unit: p.unit || '' };
    }).filter(p => p.name.trim() !== '');
  });
}

// ==================== PENGATUR URUTAN POSISI PARAMETER KUSTOM ====================
function moveParamFieldRow(btn, direction) {
  const row = btn.closest('.param-row-item');
  if (!row) return;

  if (direction === 'up') {
    const prev = row.previousElementSibling;
    if (prev && prev.classList.contains('param-row-item')) {
      row.parentNode.insertBefore(row, prev);
    }
  } else if (direction === 'down') {
    const next = row.nextElementSibling;
    if (next && next.classList.contains('param-row-item')) {
      row.parentNode.insertBefore(next, row);
    }
  }
  lucide.createIcons();
}

function addParamInputField(name = '', unit = '') {
  const container = document.getElementById('param-modal-fields-list');
  if (!container) return;

  const rowId = 'param-row-' + Date.now() + '-' + Math.random().toString().slice(2, 6);
  const div = document.createElement('div');
  div.id = rowId;
  div.className = 'param-row-item flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200/80';
  div.innerHTML = `
    <!-- Tombol Pengatur Posisi Urutan Naik/Turun -->
    <div class="flex flex-col gap-0.5 shrink-0">
      <button type="button" onclick="moveParamFieldRow(this, 'up')" data-tooltip="Geser ke atas" aria-label="Geser ke atas" class="w-6 h-6 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition">
        <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
      </button>
      <button type="button" onclick="moveParamFieldRow(this, 'down')" data-tooltip="Geser ke bawah" aria-label="Geser ke bawah" class="w-6 h-6 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition">
        <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
      </button>
    </div>

    <div class="relative flex-1 min-w-0">
      <input type="text" value="${escapeHtml(name)}" placeholder="Nama Parameter (misal: SPBU)" class="param-input-name w-full h-9 px-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-xs bg-white" required />
    </div>
    <div class="w-20 shrink-0">
      <input type="text" value="${escapeHtml(unit)}" placeholder="Satuan (km)" class="param-input-unit w-full h-9 px-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-center bg-white" />
    </div>
    <button type="button" onclick="document.getElementById('${rowId}').remove()" data-tooltip="Hapus kolom parameter" aria-label="Hapus kolom parameter" class="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition shrink-0">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(div);
  lucide.createIcons();
}

function saveCustomParameter(e) {
  e.preventDefault();
  const id = document.getElementById('param-id')?.value;
  const categoryId = document.getElementById('param-modal-category')?.value;
  const subcategory = document.getElementById('param-modal-subcategory')?.value;

  if (!categoryId || !subcategory) {
    alert('Harap pilih Kategori dan Subkategori terlebih dahulu!');
    return;
  }

  const rows = document.querySelectorAll('#param-modal-fields-list > div');
  const paramsList = [];

  rows.forEach(r => {
    const nameInp = r.querySelector('.param-input-name');
    const unitInp = r.querySelector('.param-input-unit');
    const nameVal = nameInp ? toSmartTitleCase(nameInp.value.trim()) : '';
    const unitVal = unitInp ? unitInp.value.trim() : '';

    if (nameVal) {
      paramsList.push({ name: nameVal, unit: unitVal });
    }
  });

  if (paramsList.length === 0) {
    alert('Harap masukkan setidaknya satu nama parameter!');
    return;
  }

  const duplicate = customParameters.find(cp => 
    String(cp.id) !== String(id) && 
    cp.categoryId === categoryId && 
    cp.subcategory.toLowerCase() === subcategory.toLowerCase()
  );

  if (duplicate) {
    alert(`Subkategori "${subcategory}" sudah memiliki pengaturan parameter. Gunakan tombol ubah untuk mengeditnya.`);
    return;
  }

  if (id && id.trim() !== '') {
    const idx = customParameters.findIndex(cp => String(cp.id) === String(id));
    if (idx !== -1) {
      customParameters[idx] = {
        id: String(id),
        categoryId,
        subcategory,
        parameters: paramsList
      };
    }
  } else {
    customParameters.unshift({
      id: 'param-' + Date.now() + '-' + Math.random().toString().slice(2, 6),
      categoryId,
      subcategory,
      parameters: paramsList
    });
  }

  persistState(true);
  closeModal('custom-parameter-modal');
  renderCustomParameters();
  alert('Parameter kustom berhasil disimpan!');
}

async function deleteCustomParameter(id) {
  if (await showAppConfirm('Hapus pengaturan parameter kustom untuk subkategori ini?', 'Hapus Parameter')) {
    customParameters = customParameters.filter(cp => String(cp.id) !== String(id));
    persistState(true);
    renderCustomParameters();
  }
}
	
	// ==================== INTEGRASI PARAMETER DI FORM TRANSAKSI ====================
// ==================== INTEGRASI PARAMETER RESPONSIF & ANTI-DUPLIKASI ====================
let isTxParamPanelOpen = false;

// Bersihkan catatan dari baris bullet parameter apapun agar tidak terduplikasi
function stripBulletParameters(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter(line => !line.trim().match(/^[•\-*]\s*[^:]+:\s*.*$/))
    .join('\n')
    .trim();
}

function toggleTxCustomParamsPanel() {
  isTxParamParamPanelOpen = !isTxParamPanelOpen;
  isTxParamPanelOpen = isTxParamParamPanelOpen;
  applyTxParamPanelState();
}

function applyTxParamPanelState() {
  const modalCard = document.getElementById('tx-modal-card');
  const panel = document.getElementById('tx-custom-params-panel');
  const icon = document.getElementById('icon-tx-param-chevron');
  const toggleBtn = document.getElementById('btn-tx-param-toggle');
  const isMobile = window.innerWidth < 768;

  if (!panel || !modalCard) return;

  if (isTxParamPanelOpen) {
    panel.classList.remove('hidden');
    if (toggleBtn) toggleBtn.classList.remove('animate-pulse');

    if (isMobile) {
      // DI HP: Panel membuka ke bawah
      modalCard.classList.remove('md:max-w-3xl');
      modalCard.classList.add('max-w-md');
      if (icon) icon.setAttribute('data-lucide', 'chevron-up');
    } else {
      // DI PC: Pop-up melebar ke samping kanan
      modalCard.classList.remove('max-w-md');
      modalCard.classList.add('md:max-w-3xl');
      if (icon) icon.setAttribute('data-lucide', 'chevron-left');
    }
  } else {
    panel.classList.add('hidden');
    modalCard.classList.remove('md:max-w-3xl');
    modalCard.classList.add('max-w-md');

    if (isMobile) {
      if (icon) icon.setAttribute('data-lucide', 'chevron-down');
    } else {
      if (icon) icon.setAttribute('data-lucide', 'chevron-right');
    }
  }
  lucide.createIcons();
}

function updateTxCustomParameterFields(existingParamValues = {}) {
  const catId = document.getElementById('tx-category')?.value;
  const subVal = (document.getElementById('tx-subcategory')?.value || '').trim();
  const toggleBtn = document.getElementById('btn-tx-param-toggle');
  const panel = document.getElementById('tx-custom-params-panel');
  const subNameEl = document.getElementById('tx-custom-params-subname');
  const fieldsContainer = document.getElementById('tx-custom-params-fields');

  if (!fieldsContainer) return;

  if (!catId || !subVal) {
    if (toggleBtn) toggleBtn.classList.add('hidden');
    if (panel) panel.classList.add('hidden');
    fieldsContainer.innerHTML = '';
    isTxParamPanelOpen = false;
    applyTxParamPanelState();
    return;
  }

  const config = customParameters.find(cp => 
    cp.categoryId === catId && 
    cp.subcategory.toLowerCase() === subVal.toLowerCase()
  );

  if (config && config.parameters && config.parameters.length > 0) {
    if (subNameEl) subNameEl.textContent = config.subcategory;
    if (toggleBtn) {
      toggleBtn.classList.remove('hidden');
      toggleBtn.classList.add('animate-pulse');
    }

    // Susun kolom parameter SELALU MENURUN (1 kolom per baris)
    fieldsContainer.innerHTML = config.parameters.map((p) => {
      const pName = typeof p === 'string' ? p : (p.name || '');
      const pUnit = typeof p === 'string' ? '' : (p.unit || '');
      const cleanKey = pName.toLowerCase().trim();
      const val = existingParamValues[cleanKey] || '';

      return `
        <div>
          <label class="font-bold text-slate-700 block mb-1 text-[11px] truncate">
            ${escapeHtml(pName)} ${pUnit ? `<span class="text-slate-400 font-normal">(${escapeHtml(pUnit)})</span>` : ''}
          </label>
          <div class="relative">
            <input type="text" data-param-name="${escapeHtml(pName)}" data-param-unit="${escapeHtml(pUnit)}" value="${escapeHtml(val)}" placeholder="Isi ${escapeHtml(pName)}..." class="tx-param-field-val w-full ${pUnit ? 'pr-9' : 'pr-3'} pl-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium shadow-2xs" />
            ${pUnit ? `<span class="absolute right-3 top-2 text-[11px] text-slate-400 font-bold pointer-events-none">${escapeHtml(pUnit)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
    lucide.createIcons();

    // Buka panel otomatis agar kolom langsung terlihat
    isTxParamPanelOpen = true;
    applyTxParamPanelState();
  } else {
    if (toggleBtn) toggleBtn.classList.add('hidden');
    if (panel) panel.classList.add('hidden');
    fieldsContainer.innerHTML = '';
    isTxParamPanelOpen = false;
    applyTxParamPanelState();
  }
}

function parseNoteAndParameters(fullNote) {
  if (!fullNote) return { mainNote: '', paramValues: {} };

  const lines = fullNote.split(/\r?\n/);
  const mainLines = [];
  const paramValues = {};

  lines.forEach(line => {
    const trimmed = line.trim();
    const match = trimmed.match(/^[•\-*]\s*([^:]+):\s*(.*)$/);
    if (match) {
      const pName = match[1].trim().toLowerCase();
      let pVal = match[2].trim();

      // Bersihkan satuan jika menempel
      customParameters.forEach(cp => {
        (cp.parameters || []).forEach(p => {
          const unit = typeof p === 'string' ? '' : (p.unit || '').trim();
          if (unit && pVal.toLowerCase().endsWith(' ' + unit.toLowerCase())) {
            pVal = pVal.slice(0, -(unit.length + 1)).trim();
          }
        });
      });

      paramValues[pName] = pVal;
    } else {
      if (trimmed) {
        mainLines.push(line);
      }
    }
  });

  return {
    mainNote: mainLines.join('\n').trim(),
    paramValues
  };
}

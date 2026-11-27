// ==================== Excel & PDF Export (2 Layouts + Preview) and Anti-Duplicate Import ====================

let pendingExportPreviewState = null;

// ==================== EKSPOR & IMPOR DATA ====================
function openExportModal(format) {
  setVal('export-target-format', format);
  const iconWrap = document.getElementById('export-modal-icon-wrap');
  const iconEl = document.getElementById('export-modal-icon');
  const titleEl = document.getElementById('export-modal-title');
  const subdesc = document.getElementById('export-yearly-subdesc');

  if (format === 'excel') {
    if (iconWrap) iconWrap.className = 'p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0';
    if (iconEl) iconEl.setAttribute('data-lucide', 'file-spreadsheet');
    if (titleEl) titleEl.textContent = 'Opsi Ekspor Excel (.xlsx)';
    if (subdesc) subdesc.textContent = 'Excel: 12 sheet terpisah per bulan secara rapi.';
  } else {
    if (iconWrap) iconWrap.className = 'p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0';
    if (iconEl) iconEl.setAttribute('data-lucide', 'file-text');
    if (titleEl) titleEl.textContent = 'Opsi Ekspor PDF (.pdf)';
    if (subdesc) subdesc.textContent = 'PDF: Rekap tahunan 12 bulan + mutasi transaksi lengkap.';
  }

  onExportTypeChange();
  openModal('export-options-modal');
  lucide.createIcons();
}

function onExportTypeChange() {
  const val = document.querySelector('input[name="export-scope-type"]:checked')?.value || 'yearly';
  const yearWrap = document.getElementById('export-year-picker-wrap');
  const monthWrap = document.getElementById('export-month-picker-wrap');

  if (val === 'yearly') {
    if (yearWrap) yearWrap.classList.remove('hidden');
    if (monthWrap) monthWrap.classList.add('hidden');
  } else if (val === 'monthly') {
    if (monthWrap) monthWrap.classList.remove('hidden');
    if (yearWrap) yearWrap.classList.add('hidden');
  } else {
    if (yearWrap) yearWrap.classList.add('hidden');
    if (monthWrap) monthWrap.classList.add('hidden');
  }
}

function getExportAccountsUsedInTxs(txList) {
  const usedIds = new Set();
  (txList || []).forEach(tx => {
    if (tx.accountId) usedIds.add(String(tx.accountId));
    if (tx.type === 'transfer' && tx.toAccountId) usedIds.add(String(tx.toAccountId));
  });
  // Sertakan semua rekening yang tercatat pada transaksi periode ini, baik disembunyikan di Dashboard ataupun tidak
  return accounts.filter(a => usedIds.has(String(a.id)));
}

function computeExportAccountBalances() {
  const balances = {};
  accounts.forEach(a => {
    balances[a.id] = parseFloat(a.initialBalance || 0) || 0;
  });

  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    const fee = parseFloat(tx.adminFee) || 0;
    if (tx.type === 'income') {
      if (balances[tx.accountId] !== undefined) balances[tx.accountId] += amt;
    } else if (tx.type === 'expense') {
      if (balances[tx.accountId] !== undefined) balances[tx.accountId] -= amt;
    } else if (tx.type === 'transfer') {
      if (balances[tx.accountId] !== undefined) balances[tx.accountId] -= (amt + fee);
      if (balances[tx.toAccountId] !== undefined) balances[tx.toAccountId] += amt;
    }
  });

  return balances;
}

function computeExportTxSummary(txList) {
  let totalIn = 0;
  let totalOut = 0;
  txList.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    const fee = parseFloat(t.adminFee) || 0;
    if (t.type === 'income') totalIn += amt;
    else if (t.type === 'expense') totalOut += amt;
    else if (t.type === 'transfer' && fee > 0) totalOut += fee;
  });
  return {
    count: txList.length,
    totalIn,
    totalOut,
    net: totalIn - totalOut
  };
}

function formatSignedCurrency(val) {
  const num = parseFloat(val) || 0;
  if (num > 0) return `+${formatCurrency(num)}`;
  if (num < 0) return `-${formatCurrency(Math.abs(num))}`;
  return formatCurrency(0);
}

function getAccountDeltaForTx(tx, accountId) {
  const amt = parseFloat(tx.amount) || 0;
  const fee = parseFloat(tx.adminFee) || 0;

  if (tx.type === 'income') {
    return tx.accountId === accountId ? amt : null;
  }
  if (tx.type === 'expense') {
    return tx.accountId === accountId ? -amt : null;
  }
  if (tx.type === 'transfer') {
    let delta = 0;
    let touched = false;
    if (tx.accountId === accountId) {
      delta -= (amt + fee);
      touched = true;
    }
    if (tx.toAccountId === accountId) {
      delta += amt;
      touched = true;
    }
    return touched ? delta : null;
  }
  return null;
}

function formatTxRow(t, layoutMode = 'standard') {
  const acc = accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
  let accStr = acc;
  let catStr = categories.find(c => c.id === t.categoryId)?.name || 'Unknown';
  let typeStr = (t.type || 'expense').toUpperCase();
  const amt = parseFloat(t.amount) || 0;
  const fee = parseFloat(t.adminFee) || 0;

  if (t.type === 'transfer') {
    const toAcc = accounts.find(a => a.id === t.toAccountId)?.name || 'Unknown';
    accStr = `${acc} -> ${toAcc}`;
    catStr = 'Transfer Antar Rekening';
    typeStr = 'TRANSFER';
  }

  let nominalVal = amt;
  if (layoutMode === 'per_account') {
    if (t.type === 'expense') nominalVal = -amt;
    else if (t.type === 'income') nominalVal = amt;
    else nominalVal = amt;
  }

  const row = {
    'Tanggal': t.date || '',
    'Tipe': typeStr
  };
  if (layoutMode !== 'per_account') {
    row['Sumber Rekening'] = accStr;
  }
  row['Kategori'] = catStr;
  row['Subkategori'] = t.subcategory || '';
  row['Nominal (IDR)'] = nominalVal;
  row['Biaya Admin (IDR)'] = fee;
  row['Catatan'] = t.note || '';
  return row;
}

function formatPdfDetailRow(t, layoutMode = 'standard') {
  const acc = accounts.find(a => a.id === t.accountId)?.name || '-';
  let accText = acc;
  let catText = categories.find(c => c.id === t.categoryId)?.name || '-';
  let subcatText = t.subcategory || '-';
  let amtText = '';

  const amt = parseFloat(t.amount) || 0;
  const fee = parseFloat(t.adminFee) || 0;

  if (t.type === 'transfer') {
    const toAcc = accounts.find(a => a.id === t.toAccountId)?.name || '-';
    accText = `${acc} -> ${toAcc}`;
    catText = 'Transfer';
    subcatText = 'Pindah Dana';
    amtText = formatCurrency(amt);
    if (fee > 0) {
      amtText += `\n(Admin: ${formatCurrency(fee)})`;
    }
  } else if (t.type === 'income') {
    amtText = '+' + formatCurrency(amt);
  } else {
    amtText = '-' + formatCurrency(amt);
  }

  if (layoutMode === 'per_account') {
    return [t.date || '-', catText, subcatText, t.note || '-', amtText];
  }
  return [t.date || '-', accText, catText, subcatText, t.note || '-', amtText];
}

function sortTxsDescByDate(txList) {
  return txList
    .map((tx, idx) => ({ tx, idx }))
    .sort((a, b) => {
      const dA = a.tx.date || '';
      const dB = b.tx.date || '';
      if (dB !== dA) return dB.localeCompare(dA);
      const cA = Number(a.tx.createdAt) || 0;
      const cB = Number(b.tx.createdAt) || 0;
      if (cB !== cA) return cB - cA;
      return b.idx - a.idx;
    })
    .map(item => item.tx);
}

function sanitizeExcelSheetName(name) {
  return String(name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
}

// ==================== EXCEL STYLING, BORDER, MERGE & AUTO-FIT HELPER (xlsx-js-style) ====================
function buildExcelThinBorder(rgbHex = 'CBD5E1') {
  const edge = { style: 'thin', color: { rgb: rgbHex } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

function applyWorksheetStyling(ws, aoa, opts = {}) {
  const {
    merges = [],
    headerRows = new Set(),
    bannerRows = new Set(),
    balanceRowIdx = -1,
    summaryRows = new Set(),
    blankRows = new Set(),
    headerFill = '059669',
    bannerFill = '065F46',
    rightCols = new Set(),
    centerCols = new Set(),
    signedCols = new Set(),
    wrapCols = new Set(),
    colCount = 0,
    minColWidths = {},
    maxColWidth = 44
  } = opts;

  const totalCols = colCount || Math.max(1, ...aoa.map(r => (r ? r.length : 0)));
  const totalRows = aoa.length;

  // Bangun peta sel tergabung agar sel non-utama ikut diberi border & fill yang seragam
  const mergeSpanByOrigin = new Map();
  const shadowedCells = new Set();
  merges.forEach(m => {
    const key = `${m.s.r},${m.s.c}`;
    mergeSpanByOrigin.set(key, (m.e.c - m.s.c) + 1);
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) {
          shadowedCells.add(`${r},${c}`);
        }
      }
    }
  });

  if (merges.length > 0) {
    ws['!merges'] = merges;
  }

  const thinBorder = buildExcelThinBorder('CBD5E1');
  const headerBorder = buildExcelThinBorder('047857');
  const darkHeaderBorder = buildExcelThinBorder('334155');

  const computedWidths = new Array(totalCols).fill(10);
  const rowHeights = [];

  for (let r = 0; r < totalRows; r++) {
    const rowArr = aoa[r] || [];
    const isBlank = blankRows.has(r) || (rowArr.length === 0 || rowArr.every(v => v === '' || v === null || v === undefined));

    if (isBlank) {
      rowHeights.push({ hpt: 11 });
      continue;
    }

    const isBanner = bannerRows.has(r);
    const isHeader = headerRows.has(r);
    const isBalance = (r === balanceRowIdx);
    const isSummary = summaryRows.has(r);

    let maxLinesInRow = 1;

    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) {
        const rawVal = rowArr[c];
        ws[addr] = { t: typeof rawVal === 'number' ? 'n' : 's', v: rawVal !== undefined && rawVal !== null ? rawVal : '' };
      }
      const cell = ws[addr];
      const val = cell.v;

      const isRight = typeof rightCols === 'function' ? rightCols(r, c, val) : rightCols.has(c);
      const isCenter = typeof centerCols === 'function' ? centerCols(r, c, val) : centerCols.has(c);
      const isSigned = typeof signedCols === 'function' ? signedCols(r, c, val) : signedCols.has(c);
      const isWrap = wrapCols.has(c);

      // Hitung perkiraan panjang karakter untuk lebar kolom otomatis
      const span = mergeSpanByOrigin.get(`${r},${c}`) || 1;
      const isShadowed = shadowedCells.has(`${r},${c}`);
      if (!isShadowed && span === 1) {
        let displayStr = '';
        if (typeof val === 'number') {
          if (Math.abs(val) >= 100 || isRight) {
            displayStr = (val < 0 ? '-' : (isSigned && val > 0 ? '+' : '')) + Math.abs(Math.round(val)).toLocaleString('id-ID');
          } else {
            displayStr = String(val);
          }
        } else {
          displayStr = String(val ?? '');
        }
        const lines = displayStr.split('\n');
        const longestLine = Math.max(...lines.map(l => l.length), 0);
        if (lines.length > maxLinesInRow) maxLinesInRow = lines.length;
        const padded = Math.min(maxColWidth, longestLine + (isHeader ? 5 : 4));
        if (padded > computedWidths[c]) computedWidths[c] = padded;
      } else if (!isShadowed && span > 1 && !isBanner) {
        const strLen = String(val ?? '').length + 4;
        const perCol = Math.ceil(strLen / span);
        for (let mc = c; mc < Math.min(totalCols, c + span); mc++) {
          if (perCol > computedWidths[mc]) computedWidths[mc] = Math.min(maxColWidth, perCol);
        }
      }

      // Format angka IDR bertanda atau standar
      if (typeof val === 'number' && !cell.z) {
        if (isSigned) {
          cell.z = '+#,##0;-#,##0;0';
        } else if (Math.abs(val) >= 100 || isRight) {
          cell.z = '#,##0;-#,##0;0';
        }
      }

      // Terapkan styling sel lengkap (warna background, font, rata teks, border)
      if (isBanner) {
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: bannerFill } },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: isRight ? 'right' : 'left', vertical: 'center', wrapText: true },
          border: headerBorder
        };
      } else if (isHeader) {
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: headerFill } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: isRight ? 'right' : (isCenter ? 'center' : 'left'), vertical: 'center', wrapText: true },
          border: headerFill === '059669' ? headerBorder : darkHeaderBorder
        };
      } else if (isBalance) {
        let txtColor = '065F46';
        if (typeof val === 'number' && val < 0) txtColor = 'BE123C';
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: txtColor } },
          alignment: { horizontal: isRight ? 'right' : (isCenter ? 'center' : 'left'), vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '6EE7B7' } },
            bottom: { style: 'medium', color: { rgb: '10B981' } },
            left: { style: 'thin', color: { rgb: 'A7F3D0' } },
            right: { style: 'thin', color: { rgb: 'A7F3D0' } }
          }
        };
      } else if (isSummary) {
        let txtColor = '0F172A';
        if (typeof val === 'number' && isSigned) {
          if (val > 0) txtColor = '047857';
          else if (val < 0) txtColor = 'BE123C';
        }
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: txtColor } },
          alignment: { horizontal: isRight ? 'right' : (isCenter ? 'center' : 'left'), vertical: 'center', wrapText: true },
          border: {
            top: { style: 'medium', color: { rgb: '64748B' } },
            bottom: { style: 'medium', color: { rgb: '64748B' } },
            left: thinBorder.left,
            right: thinBorder.right
          }
        };
      } else {
        const zebra = (r % 2 === 1) ? 'FFFFFF' : 'F8FAFC';
        let txtColor = '1E293B';
        let isBold = false;
        if (typeof val === 'number' && isSigned) {
          if (val > 0) { txtColor = '059669'; isBold = true; }
          else if (val < 0) { txtColor = 'E11D48'; isBold = true; }
        } else if (typeof val === 'string' && val.startsWith('+') && isSigned) {
          txtColor = '059669'; isBold = true;
        } else if (typeof val === 'string' && val.startsWith('-Rp') && isSigned) {
          txtColor = 'E11D48'; isBold = true;
        }

        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: zebra } },
          font: { name: 'Calibri', sz: 10, bold: isBold, color: { rgb: txtColor } },
          alignment: {
            horizontal: isRight ? 'right' : (isCenter ? 'center' : 'left'),
            vertical: 'center',
            wrapText: isWrap || (typeof val === 'string' && val.includes('\n'))
          },
          border: thinBorder
        };
      }
    }

    if (isBanner) rowHeights.push({ hpt: 28 });
    else if (isHeader) rowHeights.push({ hpt: 25 });
    else if (isBalance || isSummary) rowHeights.push({ hpt: 24 });
    else rowHeights.push({ hpt: Math.max(20, Math.min(54, maxLinesInRow * 15 + 4)) });
  }

  ws['!cols'] = computedWidths.map((w, idx) => ({
    wch: Math.max(minColWidths[idx] || 11, Math.min(maxColWidth, w))
  }));
  ws['!rows'] = rowHeights;
}

// ==================== PDF STYLING, A4 HEADER/FOOTER & PAGE-BREAK ENGINE ====================
const PDF_PAGE_MARGINS = { top: 24, right: 14, bottom: 20, left: 14 };

function ensurePdfSpace(doc, currentY, minNeededMm = 32) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + minNeededMm > pageHeight - PDF_PAGE_MARGINS.bottom) {
    doc.addPage();
    return PDF_PAGE_MARGINS.top + 2;
  }
  return currentY;
}

function drawPdfHeroHeader(doc, title, badgeText, subtitleText, accentRgb = [5, 150, 105]) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_PAGE_MARGINS.left - PDF_PAGE_MARGINS.right;

  // Garis aksen atas & kotak tajuk
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(PDF_PAGE_MARGINS.left, 10, contentWidth, 20, 2, 2, 'F');
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(PDF_PAGE_MARGINS.left, 10, 2.5, 20, 'F');

  doc.setFontSize(7.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.text('FINTRACK  •  LAPORAN KEUANGAN PRIBADI', PDF_PAGE_MARGINS.left + 6, 15.2);

  if (badgeText) {
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(badgeText, pageWidth - PDF_PAGE_MARGINS.right - 3, 15.2, { align: 'right' });
  }

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(title || ''), PDF_PAGE_MARGINS.left + 6, 21.5);

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(String(subtitleText || ''), PDF_PAGE_MARGINS.left + 6, 26.8);

  return 34;
}

function drawPdfSectionIntro(doc, currentY, sectionTitle, description, accentRgb = [5, 150, 105], estimatedTableHeightMm = 28) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_PAGE_MARGINS.left - PDF_PAGE_MARGINS.right;

  doc.setFontSize(8);
  const descLines = description ? doc.splitTextToSize(description, contentWidth - 4) : [];
  const introHeight = 7 + (descLines.length * 3.8);

  let y = ensurePdfSpace(doc, currentY, introHeight + estimatedTableHeightMm);

  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.roundedRect(PDF_PAGE_MARGINS.left, y, 2, 4.4, 0.5, 0.5, 'F');

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sectionTitle, PDF_PAGE_MARGINS.left + 4, y + 3.7);
  y += 6.2;

  if (descLines.length > 0) {
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(descLines, PDF_PAGE_MARGINS.left + 4, y + 2);
    y += descLines.length * 3.8 + 1.5;
  }

  return y;
}

function applyPdfRunningHeaderAndFooter(doc, title, periodLabel, accentRgb = [5, 150, 105]) {
  const totalPages = doc.getNumberOfPages();
  const printStamp = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header berulang halaman 2 ke atas
    if (p > 1) {
      doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.rect(PDF_PAGE_MARGINS.left, 9, 2, 7.5, 'F');
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`FinTrack  •  ${title}`, PDF_PAGE_MARGINS.left + 4, 13.8);

      if (periodLabel) {
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(String(periodLabel), pageWidth - PDF_PAGE_MARGINS.right, 13.8, { align: 'right' });
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(PDF_PAGE_MARGINS.left, 18.5, pageWidth - PDF_PAGE_MARGINS.right, 18.5);
    }

    // Footer di setiap halaman
    const footerLineY = pageHeight - 13.5;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(PDF_PAGE_MARGINS.left, footerLineY, pageWidth - PDF_PAGE_MARGINS.right, footerLineY);

    doc.setFontSize(7.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`FinTrack — Laporan Keuangan Pribadi  |  Dicetak: ${printStamp}`, PDF_PAGE_MARGINS.left, pageHeight - 8.5);

    doc.setFont(undefined, 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - PDF_PAGE_MARGINS.right, pageHeight - 8.5, { align: 'right' });
  }
}

function buildExcelExportPackage(type, layoutMode) {
  const workbook = XLSX.utils.book_new();
  const accountBalances = computeExportAccountBalances();
  const exportTimeLabel = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const standardHeaders = ['Tanggal', 'Tipe', 'Sumber Rekening', 'Kategori', 'Subkategori', 'Nominal (IDR)', 'Biaya Admin (IDR)', 'Catatan'];
  const perAccountBaseHeaders = ['Tanggal', 'Tipe', 'Kategori', 'Subkategori', 'Nominal (IDR)', 'Biaya Admin (IDR)', 'Catatan'];

  const sheets = [];
  let filename = '';
  let scopeTxsAll = [];
  const suffixLayout = layoutMode === 'per_account' ? '_PerRekening' : '';

  const buildSheetEntry = (sheetName, txList) => {
    const sorted = sortTxsDescByDate(txList);
    // Hanya tampilkan rekening yang bertransaksi di sheet/bulan ini (baik tersembunyi atau tidak)
    const sheetAccounts = layoutMode === 'per_account' ? getExportAccountsUsedInTxs(sorted) : [];
    const fullHeaders = layoutMode === 'per_account'
      ? [...perAccountBaseHeaders, ...sheetAccounts.map(a => a.name)]
      : standardHeaders;

    if (layoutMode === 'standard') {
      const aoa = [fullHeaders];
      let periodNetFlow = 0;
      let periodAdminTotal = 0;

      const previewRows = sorted.map(t => {
        const r = formatTxRow(t, 'standard');
        const amt = parseFloat(t.amount) || 0;
        const fee = parseFloat(t.adminFee) || 0;
        if (t.type === 'income') periodNetFlow += amt;
        else if (t.type === 'expense') periodNetFlow -= amt;
        periodAdminTotal += fee;

        const rowArr = [
          r['Tanggal'],
          r['Tipe'],
          r['Sumber Rekening'],
          r['Kategori'],
          r['Subkategori'],
          r['Nominal (IDR)'],
          r['Biaya Admin (IDR)'],
          r['Catatan']
        ];
        aoa.push(rowArr);
        return { rawType: t.type, cells: rowArr };
      });

      const summaryCells = sorted.length > 0
        ? ['TOTAL MUTASI', `${sorted.length} Tx`, '', '', '', periodNetFlow, periodAdminTotal, '']
        : null;
      const merges = [];
      if (summaryCells) {
        const sumRowIdx = aoa.length;
        aoa.push(summaryCells);
        merges.push({ s: { r: sumRowIdx, c: 2 }, e: { r: sumRowIdx, c: 4 } });
      }

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      applyWorksheetStyling(worksheet, aoa, {
        merges,
        headerRows: new Set([0]),
        headerFill: '059669',
        summaryRows: summaryCells ? new Set([aoa.length - 1]) : new Set(),
        rightCols: new Set([5, 6]),
        centerCols: new Set([0, 1]),
        signedCols: (r, c) => summaryCells && r === (aoa.length - 1) && c === 5,
        wrapCols: new Set([7]),
        colCount: fullHeaders.length,
        minColWidths: { 0: 13, 1: 11, 2: 22, 3: 18, 4: 18, 5: 16, 6: 16, 7: 26 }
      });

      XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeExcelSheetName(sheetName));

      return {
        name: sheetName,
        txCount: sorted.length,
        headers: fullHeaders,
        accounts: [],
        merges,
        balanceRow: null,
        summaryRow: summaryCells,
        rows: previewRows
      };
    }

    // VERSI 2: KOLOM REKENING YANG BERTRANSAKSI (+/- & SALDO SAAT EKSPOR), TERMASUK REKENING TERSEMBUNYI
    const aoa = [fullHeaders];
    const merges = [];

    // Baris Saldo Saat Ekspor (merge kolom 2..6 agar rapi seperti preview)
    const balanceCells = [
      'SALDO SAAT EKSPOR',
      exportTimeLabel,
      sheetAccounts.length > 0
        ? 'Saldo rekening yang bertransaksi pada periode ini (termasuk rekening tersembunyi)'
        : 'Tidak ada rekening yang melakukan transaksi pada periode ini',
      '',
      '',
      '',
      '',
      ...sheetAccounts.map(a => accountBalances[a.id] || 0)
    ];
    aoa.push(balanceCells);
    merges.push({ s: { r: 1, c: 2 }, e: { r: 1, c: 6 } });

    const periodAccTotals = {};
    sheetAccounts.forEach(a => { periodAccTotals[a.id] = 0; });
    let periodNetFlow = 0;
    let periodAdminTotal = 0;

    const previewRows = sorted.map(t => {
      const r = formatTxRow(t, 'per_account');
      const amt = parseFloat(t.amount) || 0;
      const fee = parseFloat(t.adminFee) || 0;
      if (t.type === 'income') periodNetFlow += amt;
      else if (t.type === 'expense') periodNetFlow -= amt;
      periodAdminTotal += fee;

      const accCells = sheetAccounts.map(a => {
        const delta = getAccountDeltaForTx(t, a.id);
        if (delta === null) return '';
        periodAccTotals[a.id] += delta;
        return delta;
      });

      const rowArr = [
        r['Tanggal'],
        r['Tipe'],
        r['Kategori'],
        r['Subkategori'],
        r['Nominal (IDR)'],
        r['Biaya Admin (IDR)'],
        r['Catatan'],
        ...accCells
      ];
      aoa.push(rowArr);

      return {
        rawType: t.type,
        cells: rowArr
      };
    });

    const summaryCells = [
      'TOTAL MUTASI',
      `${sorted.length} Tx`,
      '',
      '',
      periodNetFlow,
      periodAdminTotal,
      '',
      ...sheetAccounts.map(a => periodAccTotals[a.id] || 0)
    ];
    let hasSummary = false;
    if (sorted.length > 0) {
      hasSummary = true;
      const sumRowIdx = aoa.length;
      aoa.push(summaryCells);
      merges.push({ s: { r: sumRowIdx, c: 2 }, e: { r: sumRowIdx, c: 3 } });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    applyWorksheetStyling(worksheet, aoa, {
      merges,
      headerRows: new Set([0]),
      headerFill: '4F46E5',
      balanceRowIdx: 1,
      summaryRows: hasSummary ? new Set([aoa.length - 1]) : new Set(),
      rightCols: (r, c) => c === 4 || c === 5 || c >= 7,
      centerCols: new Set([0, 1]),
      signedCols: (r, c) => r !== 1 && (c === 4 || c >= 7),
      wrapCols: new Set([6]),
      colCount: fullHeaders.length,
      minColWidths: { 0: 19, 1: 15, 2: 18, 3: 18, 4: 16, 5: 16, 6: 26 }
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeExcelSheetName(sheetName));

    return {
      name: sheetName,
      txCount: sorted.length,
      headers: fullHeaders,
      accounts: sheetAccounts,
      merges,
      balanceRow: balanceCells,
      summaryRow: hasSummary ? summaryCells : null,
      rows: previewRows
    };
  };

  if (type === 'yearly') {
    const year = document.getElementById('export-year-select')?.value || String(curYear);
    scopeTxsAll = transactions.filter(t => t.date && t.date.startsWith(year));
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${year}-${String(m).padStart(2, '0')}`;
      const monthName = monthNamesID[m - 1];
      const monthTxs = scopeTxsAll.filter(t => t.date && t.date.startsWith(monthKey));
      sheets.push(buildSheetEntry(monthName, monthTxs));
    }
    filename = `Laporan_Keuangan_Tahunan_${year}_PerBulan${suffixLayout}.xlsx`;
  } else if (type === 'monthly') {
    const monthVal = document.getElementById('export-month-input')?.value || dashboardSelectedMonth;
    const parts = monthVal.split('-').map(Number);
    const y = parts[0] || curYear;
    const m = parts[1] || 1;
    scopeTxsAll = transactions.filter(t => t.date && t.date.startsWith(monthVal));
    sheets.push(buildSheetEntry(`${monthNamesID[m - 1]} ${y}`, scopeTxsAll));
    filename = `Laporan_Keuangan_${monthVal}${suffixLayout}.xlsx`;
  } else {
    scopeTxsAll = [...transactions];
    sheets.push(buildSheetEntry('Semua Transaksi', scopeTxsAll));
    filename = `Laporan_Keuangan_SemuaWaktu_${getLocalDateStr()}${suffixLayout}.xlsx`;
  }

  const activeAccounts = layoutMode === 'per_account' ? getExportAccountsUsedInTxs(scopeTxsAll) : [];

  return {
    format: 'excel',
    scopeType: type,
    layoutMode,
    filename,
    summary: computeExportTxSummary(scopeTxsAll),
    activeAccounts,
    accountBalances,
    exportTimeLabel,
    sheets,
    activeSheetIndex: 0,
    workbook
  };
}

function buildPdfExportPackage(type, layoutMode) {
  const { jsPDF } = window.jspdf;
  const accountBalances = computeExportAccountBalances();
  const exportTimeLabel = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const isPerAccount = layoutMode === 'per_account';

  let scopeTxs = [];
  let title = '';
  let periodBadge = '';
  let filename = '';
  let monthlyRows = [];
  const suffixLayout = isPerAccount ? '_PerRekening' : '';

  if (type === 'yearly') {
    const year = document.getElementById('export-year-select')?.value || String(curYear);
    scopeTxs = transactions.filter(t => t.date && t.date.startsWith(year));
    title = `Laporan Keuangan Tahunan (${year})`;
    periodBadge = `Tahun ${year}`;
    filename = `Laporan_Keuangan_Tahunan_${year}${suffixLayout}.pdf`;

    for (let m = 1; m <= 12; m++) {
      const mKey = `${year}-${String(m).padStart(2, '0')}`;
      let inM = 0, outM = 0;
      const monthTxCount = scopeTxs.filter(t => t.date && t.date.startsWith(mKey)).length;
      scopeTxs.filter(t => t.date && t.date.startsWith(mKey)).forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        const fee = parseFloat(t.adminFee) || 0;
        if (t.type === 'income') inM += amt;
        else if (t.type === 'expense') outM += amt;
        else if (t.type === 'transfer' && fee > 0) outM += fee;
      });
      monthlyRows.push([monthNamesID[m - 1], String(monthTxCount), formatCurrency(inM), formatCurrency(outM), formatSignedCurrency(inM - outM)]);
    }
  } else if (type === 'monthly') {
    const monthVal = document.getElementById('export-month-input')?.value || dashboardSelectedMonth;
    const parts = monthVal.split('-').map(Number);
    const y = parts[0] || curYear;
    const m = parts[1] || 1;
    const monthName = `${monthNamesID[m - 1]} ${y}`;
    scopeTxs = transactions.filter(t => t.date && t.date.startsWith(monthVal));
    title = `Laporan Keuangan Bulanan — ${monthName}`;
    periodBadge = monthName;
    filename = `Laporan_Keuangan_${monthVal}${suffixLayout}.pdf`;
  } else {
    scopeTxs = [...transactions];
    title = 'Laporan Riwayat Keuangan (Semua Waktu)';
    periodBadge = 'Semua Waktu';
    filename = `Laporan_Keuangan_SemuaWaktu_${getLocalDateStr()}${suffixLayout}.pdf`;
  }

  // Filter rekening HANYA yang melakukan transaksi pada periode ini (termasuk rekening tersembunyi)
  const activeAccounts = isPerAccount ? getExportAccountsUsedInTxs(scopeTxs) : [];
  const orientation = (isPerAccount && activeAccounts.length > 0) ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const accentRgb = isPerAccount ? [79, 70, 229] : (type === 'yearly' ? [37, 99, 235] : [5, 150, 105]);

  const standardHead = ['Tanggal', 'Rekening', 'Kategori', 'Subkategori', 'Catatan', 'Nominal'];
  const perAccountBaseHead = ['Tanggal', 'Kategori', 'Subkategori', 'Catatan', 'Nominal'];
  const fullHead = isPerAccount
    ? [...perAccountBaseHead, ...activeAccounts.map(a => a.name)]
    : standardHead;

  const baseColumnStyles = isPerAccount
    ? {
        0: { cellWidth: 20 },
        1: { cellWidth: 26 },
        2: { cellWidth: 24 },
        3: { cellWidth: 34 },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      }
    : {
        0: { cellWidth: 21 },
        1: { cellWidth: 36 },
        2: { cellWidth: 27 },
        3: { cellWidth: 25 },
        4: { cellWidth: 41 },
        5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
      };

  if (isPerAccount) {
    activeAccounts.forEach((_, idx) => {
      baseColumnStyles[5 + idx] = { halign: 'right', fontStyle: 'bold' };
    });
  }

  const summary = computeExportTxSummary(scopeTxs);
  const subtitle = `Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}  •  ${isPerAccount ? 'Mode Versi 2 (Per Rekening)' : 'Mode Versi 1 (Standar)'}`;

  let curY = drawPdfHeroHeader(doc, title, periodBadge, subtitle, accentRgb);

  // 1. Ringkasan Arus Kas Periode
  curY = drawPdfSectionIntro(
    doc,
    curY,
    '1. Ringkasan Arus Kas Periode',
    'Ikhtisar jumlah transaksi, total pemasukan, total pengeluaran (termasuk biaya admin transfer), serta selisih arus kas bersih pada periode laporan.',
    accentRgb,
    20
  );

  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [['Jumlah Transaksi', 'Total Pemasukan', 'Total Pengeluaran (inc. Admin)', 'Arus Kas Bersih']],
    body: [[
      `${summary.count} Data`,
      `+${formatCurrency(summary.totalIn)}`,
      `-${formatCurrency(summary.totalOut)}`,
      formatSignedCurrency(summary.net)
    ]],
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.25 },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'right', textColor: [5, 150, 105], fontStyle: 'bold' },
      2: { halign: 'right', textColor: [225, 29, 72], fontStyle: 'bold' },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });
  curY = doc.lastAutoTable.finalY + 6;

  // 2. Rekap Bulanan (jika mode Tahunan)
  if (type === 'yearly' && monthlyRows.length > 0) {
    curY = drawPdfSectionIntro(
      doc,
      curY,
      '2. Rekapitulasi Arus Kas per Bulan (Januari – Desember)',
      'Perbandingan jumlah transaksi, pemasukan, pengeluaran, dan surplus/defisit bersih di setiap bulan dalam tahun terpilih.',
      [16, 185, 129],
      96
    );
    doc.autoTable({
      startY: curY,
      margin: PDF_PAGE_MARGINS,
      head: [['Bulan', 'Trx', 'Pemasukan', 'Pengeluaran (inc. Admin)', 'Arus Kas Bersih']],
      body: monthlyRows,
      theme: 'striped',
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      styles: { fontSize: 8, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right', textColor: [5, 150, 105] },
        3: { halign: 'right', textColor: [225, 29, 72] },
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });
    curY = doc.lastAutoTable.finalY + 6;
  }

  // 3. Tabel Saldo Rekening Bertransaksi (khusus Versi 2)
  if (isPerAccount) {
    const accSecNum = type === 'yearly' ? '3' : '2';
    const accEstH = Math.max(24, (activeAccounts.length + 2) * 7.5);
    curY = drawPdfSectionIntro(
      doc,
      curY,
      `${accSecNum}. Rekening Sumber Dana Aktif Transaksi & Saldo Saat Ekspor`,
      'Menampilkan rekening yang memiliki transaksi pada periode ini (termasuk rekening yang disembunyikan) beserta saldo aktual saat ekspor; rekening tanpa transaksi tidak ditampilkan.',
      [79, 70, 229],
      accEstH
    );

    if (activeAccounts.length > 0) {
      doc.autoTable({
        startY: curY,
        margin: PDF_PAGE_MARGINS,
        head: [['Nama Rekening', 'Jenis', 'Status Tampilan', 'Saldo Saat Ekspor']],
        body: activeAccounts.map(a => [
          a.name,
          a.type || 'Rekening',
          (a.showOnDashboard === false) ? 'Disembunyikan di Dashboard' : 'Tampil di Dashboard',
          formatCurrency(accountBalances[a.id] || 0)
        ]),
        theme: 'grid',
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        styles: { fontSize: 8, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
        headStyles: { fillColor: [238, 242, 255], textColor: [55, 48, 163], fontStyle: 'bold' },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold', textColor: [6, 95, 70] } }
      });
      curY = doc.lastAutoTable.finalY + 6;
    } else {
      doc.autoTable({
        startY: curY,
        margin: PDF_PAGE_MARGINS,
        body: [['Tidak ada rekening yang tercatat melakukan transaksi pada periode ini.']],
        theme: 'plain',
        styles: { fontSize: 8, fontStyle: 'italic', textColor: [100, 116, 139] }
      });
      curY = doc.lastAutoTable.finalY + 5;
    }
  }

  // 4. Rincian Mutasi Transaksi
  const sortedTxs = sortTxsDescByDate(scopeTxs);
  const periodAccTotals = {};
  activeAccounts.forEach(a => { periodAccTotals[a.id] = 0; });
  let periodNetFlow = 0;

  let balanceRow = null;
  const detailRows = sortedTxs.map(t => {
    const baseRow = formatPdfDetailRow(t, layoutMode);
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') periodNetFlow += amt;
    else if (t.type === 'expense') periodNetFlow -= amt;

    if (!isPerAccount) {
      return { rawType: t.type, cells: baseRow };
    }

    const accCells = activeAccounts.map(a => {
      const delta = getAccountDeltaForTx(t, a.id);
      if (delta === null) return '-';
      periodAccTotals[a.id] += delta;
      return formatSignedCurrency(delta);
    });

    return {
      rawType: t.type,
      cells: [...baseRow, ...accCells]
    };
  });

  const pdfBody = [];
  if (isPerAccount && activeAccounts.length > 0) {
    balanceRow = [
      'SALDO SAAT EKSPOR',
      exportTimeLabel,
      'Rekening Bertransaksi',
      'Posisi saldo saat ekspor',
      '-',
      ...activeAccounts.map(a => formatCurrency(accountBalances[a.id] || 0))
    ];
    pdfBody.push(balanceRow);
  }

  detailRows.forEach(r => pdfBody.push(r.cells));

  let summaryRow = null;
  if (isPerAccount && sortedTxs.length > 0) {
    summaryRow = [
      'TOTAL MUTASI',
      `${sortedTxs.length} Transaksi`,
      '',
      '',
      formatSignedCurrency(periodNetFlow),
      ...activeAccounts.map(a => formatSignedCurrency(periodAccTotals[a.id] || 0))
    ];
    pdfBody.push(summaryRow);
  }

  const mutasiSecNum = isPerAccount ? (type === 'yearly' ? '4' : '3') : (type === 'yearly' ? '3' : '2');
  curY = drawPdfSectionIntro(
    doc,
    curY,
    `${mutasiSecNum}. Rincian Mutasi Transaksi (Urutan Terbaru di Atas)`,
    'Daftar lengkap mutasi diurutkan dari tanggal terbaru. Tanda (+) menandakan pemasukan/transfer masuk, sedangkan (-) menandakan pengeluaran/transfer keluar.',
    accentRgb,
    36
  );

  const tableFontSize = isPerAccount && activeAccounts.length >= 4 ? 6.5 : 7.5;
  const amountStartCol = isPerAccount ? 4 : 5;
  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [fullHead],
    body: pdfBody.length > 0 ? pdfBody : [[{ content: 'Belum ada transaksi tercatat pada periode ini.', colSpan: fullHead.length, styles: { halign: 'center', fontStyle: 'italic', textColor: [148, 163, 184] } }]],
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { fontSize: tableFontSize, cellPadding: 2, overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: accentRgb, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: baseColumnStyles,
    didParseCell: function(data) {
      if (data.section !== 'body' || pdfBody.length === 0) return;
      const isBalanceRow = Boolean(balanceRow) && data.row.index === 0;
      const isTotalRow = Boolean(summaryRow) && data.row.index === (pdfBody.length - 1);

      if (isBalanceRow) {
        data.cell.styles.fillColor = [236, 253, 245];
        data.cell.styles.textColor = [6, 95, 70];
        data.cell.styles.fontStyle = 'bold';
        return;
      }
      if (isTotalRow) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }

      if (data.column.index >= amountStartCol) {
        const txt = String(data.cell.raw || '');
        if (txt.startsWith('+')) {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (txt.startsWith('-Rp') || txt.startsWith('-')) {
          if (txt !== '-') data.cell.styles.textColor = [225, 29, 72];
        }
      }
    }
  });

  // Terapkan Header halaman lanjutan & Footer bernomor pada seluruh halaman A4
  applyPdfRunningHeaderAndFooter(doc, title, periodBadge, accentRgb);

  const pdfBlob = doc.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);

  return {
    format: 'pdf',
    scopeType: type,
    layoutMode,
    filename,
    title,
    subtitle,
    summary,
    activeAccounts,
    accountBalances,
    exportTimeLabel,
    monthlyRows,
    head: fullHead,
    balanceRow,
    detailRows,
    summaryRow,
    doc,
    pdfBlobUrl,
    viewMode: 'table'
  };
}

function cleanupPendingExportPreviewUrl() {
  if (pendingExportPreviewState && pendingExportPreviewState.pdfBlobUrl) {
    try {
      URL.revokeObjectURL(pendingExportPreviewState.pdfBlobUrl);
    } catch (_) {}
    pendingExportPreviewState.pdfBlobUrl = null;
  }
}

function previewDocumentExport() {
  const format = document.getElementById('export-target-format')?.value || 'excel';
  const scopeType = document.querySelector('input[name="export-scope-type"]:checked')?.value || 'yearly';
  const layoutMode = document.querySelector('input[name="export-layout-mode"]:checked')?.value || 'standard';

  cleanupPendingExportPreviewUrl();

  try {
    pendingExportPreviewState = (format === 'excel')
      ? buildExcelExportPackage(scopeType, layoutMode)
      : buildPdfExportPackage(scopeType, layoutMode);
  } catch (err) {
    console.error('Gagal menyusun pratinjau ekspor:', err);
    showAppAlert('Gagal menyiapkan pratinjau dokumen ekspor. Silakan coba lagi.');
    return;
  }

  closeModal('export-options-modal');
  renderExportPreviewModal();
  openModal('export-preview-modal');
  lucide.createIcons();
}

function executeDocumentExport() {
  previewDocumentExport();
}

function renderExportPreviewModal() {
  const state = pendingExportPreviewState;
  if (!state) return;

  const isExcel = state.format === 'excel';
  const isPerAccount = state.layoutMode === 'per_account';

  const iconWrap = document.getElementById('export-preview-icon-wrap');
  const iconEl = document.getElementById('export-preview-icon');
  const titleEl = document.getElementById('export-preview-title');
  const badgeEl = document.getElementById('export-preview-layout-badge');
  const subEl = document.getElementById('export-preview-subtitle');
  const fnEl = document.getElementById('export-preview-filename');
  const dlLbl = document.getElementById('export-preview-download-label');

  if (iconWrap) iconWrap.className = `p-2 rounded-xl shrink-0 ${isExcel ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`;
  if (iconEl) iconEl.setAttribute('data-lucide', isExcel ? 'file-spreadsheet' : 'file-text');
  if (titleEl) titleEl.textContent = isExcel ? 'Preview Ekspor Excel (.xlsx)' : 'Preview Ekspor PDF (.pdf)';
  if (badgeEl) {
    if (state.isAnalysisExport) {
      badgeEl.textContent = state.scopeType === 'year' ? 'Analisa Tahunan' : 'Analisa Bulanan';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200';
    } else {
      badgeEl.textContent = isPerAccount ? 'Versi 2: Kolom Rekening (+/-)' : 'Versi 1: Format Standar';
      badgeEl.className = `text-[10px] font-bold px-2 py-0.5 rounded-full border ${isPerAccount ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`;
    }
  }
  if (subEl) {
    if (state.isAnalysisExport) {
      subEl.textContent = `Pratinjau laporan analisa finansial (${state.analysisData?.periodLabel || ''}) sebelum mengunduh file.`;
    } else {
      subEl.textContent = isPerAccount
        ? 'Menampilkan kolom seluruh rekening yang bertransaksi pada periode ini (termasuk rekening tersembunyi) beserta saldo saat ekspor.'
        : 'Tinjau isi tabel sebelum menyimpan berkas.';
    }
  }
  if (fnEl) fnEl.textContent = state.filename;
  if (dlLbl) dlLbl.textContent = isExcel ? 'Unduh Excel (.xlsx)' : 'Unduh PDF (.pdf)';

  // Ringkasan KPI + Info Analisa / Saldo Rekening Bertransaksi (untuk Versi 2)
  const summaryWrap = document.getElementById('export-preview-summary');
  if (summaryWrap) {
    if (state.isAnalysisExport && state.analysisData) {
      const a = state.analysisData;
      summaryWrap.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] text-slate-500 font-semibold block">Rasio Tabungan</span>
            <strong class="text-sm text-slate-900">${a.savingRatio.toFixed(1)}% <span class="text-[10px] font-semibold text-emerald-700">(${escapeHtml(a.savingStatus)})</span></strong>
          </div>
          <div class="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span class="text-[10px] text-emerald-700 font-semibold block">Total Pemasukan</span>
            <strong class="text-sm text-emerald-700">+${formatCurrency(a.totalInflow)}</strong>
          </div>
          <div class="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
            <span class="text-[10px] text-rose-700 font-semibold block">Total Pengeluaran</span>
            <strong class="text-sm text-rose-600">-${formatCurrency(a.totalOutflow)}</strong>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] text-slate-500 font-semibold block">Arus Kas Bersih</span>
            <strong class="text-sm ${a.netCashFlow >= 0 ? 'text-slate-900' : 'text-rose-600'}">${formatSignedCurrency(a.netCashFlow)}</strong>
          </div>
        </div>
      `;
    } else {
      const s = state.summary;
      const activeSheet = isExcel ? (state.sheets[state.activeSheetIndex] || state.sheets[0]) : null;
      const displayAccounts = isPerAccount
        ? ((activeSheet && Array.isArray(activeSheet.accounts) && state.sheets.length > 1) ? activeSheet.accounts : state.activeAccounts)
        : [];
      const hiddenIncludedCount = displayAccounts.filter(a => a.showOnDashboard === false).length;

      const accChipsHtml = isPerAccount
        ? (displayAccounts.length > 0
          ? `
            <div class="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
              <div class="text-[11px] font-bold text-emerald-900 mb-1.5 flex items-center justify-between gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1"><i data-lucide="landmark" class="w-3.5 h-3.5 text-emerald-600"></i> Rekening Bertransaksi${activeSheet && state.sheets.length > 1 ? ` (${escapeHtml(activeSheet.name)})` : ''} — Saldo Saat Ekspor</span>
                <span class="text-[10px] font-medium text-emerald-700">${displayAccounts.length} Rekening${hiddenIncludedCount > 0 ? ` (${hiddenIncludedCount} Tersembunyi ikut tampil)` : ''}</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                ${displayAccounts.map(a => {
                  const bal = state.accountBalances[a.id] || 0;
                  return `
                    <span class="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1.5">
                      <span>${escapeHtml(a.name)}${a.showOnDashboard === false ? ' <em class="text-[9px] text-slate-400">(Tersembunyi)</em>' : ''}:</span>
                      <strong class="${bal >= 0 ? 'text-emerald-700' : 'text-rose-600'}">${formatCurrency(bal)}</strong>
                    </span>
                  `;
                }).join('')}
              </div>
            </div>
          `
          : `<div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">Tidak ada rekening yang melakukan transaksi pada periode${activeSheet ? ` "${escapeHtml(activeSheet.name)}"` : ''} ini, sehingga kolom rekening tidak ditampilkan.</div>`)
        : '';

      summaryWrap.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] text-slate-500 font-semibold block">Jumlah Transaksi</span>
            <strong class="text-sm text-slate-900">${s.count} Data</strong>
          </div>
          <div class="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span class="text-[10px] text-emerald-700 font-semibold block">Total Pemasukan</span>
            <strong class="text-sm text-emerald-700">+${formatCurrency(s.totalIn)}</strong>
          </div>
          <div class="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
            <span class="text-[10px] text-rose-700 font-semibold block">Pengeluaran (inc. Admin)</span>
            <strong class="text-sm text-rose-600">-${formatCurrency(s.totalOut)}</strong>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] text-slate-500 font-semibold block">Arus Kas Bersih</span>
            <strong class="text-sm ${s.net >= 0 ? 'text-slate-900' : 'text-rose-600'}">${formatSignedCurrency(s.net)}</strong>
          </div>
        </div>
        ${accChipsHtml}
      `;
    }
  }

  // Controls (Sheet tabs untuk Excel atau Mode switcher untuk PDF)
  const controlsWrap = document.getElementById('export-preview-controls');
  if (controlsWrap) {
    if (isExcel) {
      if (state.sheets.length > 1) {
        controlsWrap.classList.remove('hidden');
        controlsWrap.innerHTML = state.sheets.map((sh, idx) => `
          <button type="button" onclick="selectExcelPreviewSheet(${idx})" class="shrink-0 px-3 py-1.5 rounded-lg border text-xs font-bold transition whitespace-nowrap inline-flex items-center gap-1.5 ${
            idx === state.activeSheetIndex
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }">
            <span>${escapeHtml(sh.name)}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded-full ${idx === state.activeSheetIndex ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500'}">${sh.txCount}</span>
          </button>
        `).join('');
      } else {
        controlsWrap.classList.add('hidden');
        controlsWrap.innerHTML = '';
      }
    } else {
      controlsWrap.classList.remove('hidden');
      controlsWrap.innerHTML = `
        <button type="button" onclick="switchPdfPreviewMode('table')" class="shrink-0 px-3 py-1.5 rounded-lg border text-xs font-bold transition inline-flex items-center gap-1.5 ${
          state.viewMode === 'table'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }">
          <i data-lucide="table" class="w-3.5 h-3.5"></i>
          <span>Pratinjau Tabel &amp; Halaman</span>
        </button>
        <button type="button" onclick="switchPdfPreviewMode('pdf')" class="shrink-0 px-3 py-1.5 rounded-lg border text-xs font-bold transition inline-flex items-center gap-1.5 ${
          state.viewMode === 'pdf'
            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }">
          <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
          <span>Pratinjau Dokumen PDF (A4)</span>
        </button>
      `;
    }
  }

  renderExportPreviewBody();
}

function selectExcelPreviewSheet(idx) {
  if (!pendingExportPreviewState || pendingExportPreviewState.format !== 'excel') return;
  pendingExportPreviewState.activeSheetIndex = idx;
  renderExportPreviewModal();
  lucide.createIcons();
}

function switchPdfPreviewMode(mode) {
  if (!pendingExportPreviewState || pendingExportPreviewState.format !== 'pdf') return;
  pendingExportPreviewState.viewMode = mode;
  renderExportPreviewModal();
  lucide.createIcons();
}

function formatPreviewCellHtml(val, opts = {}) {
  const {
    isAmountOrAccountCol = false,
    isSignedCol = false,
    isBalanceRow = false,
    isSummaryRow = false
  } = opts;

  if (val === '' || val === null || val === undefined) {
    return `<span class="text-slate-300">-</span>`;
  }
  if (typeof val === 'number') {
    const cls = isBalanceRow
      ? (val >= 0 ? 'text-emerald-800 font-bold' : 'text-rose-700 font-bold')
      : (val > 0 && isSignedCol
          ? 'text-emerald-700 font-bold'
          : (val < 0 ? 'text-rose-600 font-bold' : 'text-slate-800 font-semibold'));

    if (!isBalanceRow && isSignedCol) {
      return `<span class="${cls}">${formatSignedCurrency(val)}</span>`;
    }
    return `<span class="${cls}">${formatCurrency(val)}</span>`;
  }

  const str = String(val);
  if (isAmountOrAccountCol && !isBalanceRow) {
    if (str.startsWith('+')) return `<span class="text-emerald-700 font-bold">${escapeHtml(str)}</span>`;
    if (str.startsWith('-Rp') || (str.startsWith('-') && str !== '-')) {
      return `<span class="text-rose-600 font-bold">${escapeHtml(str)}</span>`;
    }
  }
  if (isBalanceRow && isAmountOrAccountCol && str !== '-') {
    return `<span class="text-emerald-800 font-bold">${escapeHtml(str)}</span>`;
  }
  if (isSummaryRow && isAmountOrAccountCol) {
    if (str.startsWith('+')) return `<span class="text-emerald-700 font-bold">${escapeHtml(str)}</span>`;
    if (str.startsWith('-')) return `<span class="text-rose-600 font-bold">${escapeHtml(str)}</span>`;
  }
  return escapeHtml(str).replace(/\n/g, '<br/>');
}

function renderMergedRowCellsHtml(rowCells, rowIdx, merges, renderCellFn) {
  const mergeList = merges || [];
  let html = '';
  for (let c = 0; c < rowCells.length; c++) {
    const m = mergeList.find(item => item.s.r === rowIdx && item.s.c === c);
    const isShadowed = !m && mergeList.some(item => rowIdx >= item.s.r && rowIdx <= item.e.r && c >= item.s.c && c <= item.e.c);
    if (isShadowed) continue;
    const colspan = m ? (m.e.c - m.s.c + 1) : 1;
    html += renderCellFn(rowCells[c], c, colspan);
  }
  return html;
}

function renderExportPreviewBody() {
  const state = pendingExportPreviewState;
  const tableWrap = document.getElementById('export-preview-table-wrap');
  const frameWrap = document.getElementById('export-preview-pdf-frame-wrap');
  const iframe = document.getElementById('export-preview-pdf-iframe');
  if (!state || !tableWrap) return;

  if (state.format === 'pdf' && state.viewMode === 'pdf') {
    tableWrap.classList.add('hidden');
    if (frameWrap) frameWrap.classList.remove('hidden');
    if (iframe && state.pdfBlobUrl && iframe.src !== state.pdfBlobUrl) {
      iframe.src = state.pdfBlobUrl;
    }
    return;
  }

  if (frameWrap) frameWrap.classList.add('hidden');
  tableWrap.classList.remove('hidden');

  if (state.isAnalysisExport) {
    renderAnalysisExportPreviewBody(state, tableWrap);
    return;
  }

  const MAX_PREVIEW_ROWS = 250;
  const isPerAccount = state.layoutMode === 'per_account';

  if (state.format === 'excel') {
    const sheet = state.sheets[state.activeSheetIndex] || state.sheets[0];
    if (!sheet) {
      tableWrap.innerHTML = `<div class="py-10 text-center text-xs text-slate-400">Tidak ada data untuk ditampilkan.</div>`;
      return;
    }

    const totalRows = sheet.rows.length;
    const displayRows = sheet.rows.slice(0, MAX_PREVIEW_ROWS);
    const noteIdx = isPerAccount ? 6 : 7;
    const nomIdx = isPerAccount ? 4 : 5;
    const isRightCol = (idx) => idx >= nomIdx && idx !== noteIdx;
    const isSignedExcelCol = (idx) => isPerAccount && (idx === nomIdx || idx > noteIdx);
    const summaryRowIndex = isPerAccount ? (sheet.rows.length + 2) : (sheet.rows.length + 1);

    tableWrap.innerHTML = `
      <table class="w-full text-left text-[11px] sm:text-xs border-collapse">
        <thead class="sticky top-0 z-10 ${isPerAccount ? 'bg-indigo-600' : 'bg-emerald-600'} text-white shadow-2xs">
          <tr>
            ${sheet.headers.map((h, idx) => `
              <th class="px-3 py-2.5 font-bold whitespace-nowrap border border-white/20 ${isRightCol(idx) ? 'text-right' : ''}">${escapeHtml(h)}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 bg-white">
          ${sheet.balanceRow ? `
            <tr class="bg-emerald-50/90 border-b-2 border-emerald-300 font-semibold">
              ${renderMergedRowCellsHtml(sheet.balanceRow, 1, sheet.merges, (cell, idx, colspan) => `
                <td ${colspan > 1 ? `colspan="${colspan}"` : ''} class="px-3 py-2 border border-emerald-200 whitespace-nowrap ${isRightCol(idx) && colspan === 1 ? 'text-right' : ''} ${idx === 0 ? 'font-extrabold text-emerald-900' : 'text-emerald-800'}">
                  ${formatPreviewCellHtml(cell, { isAmountOrAccountCol: isRightCol(idx) && colspan === 1, isSignedCol: isSignedExcelCol(idx) && colspan === 1, isBalanceRow: true })}
                </td>
              `)}
            </tr>
          ` : ''}
          ${displayRows.length === 0 ? `
            <tr>
              <td colspan="${sheet.headers.length}" class="px-4 py-8 text-center text-slate-400 italic border border-slate-200">Tidak ada transaksi pada sheet ini.</td>
            </tr>
          ` : displayRows.map((r, rIdx) => `
            <tr class="${rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-emerald-50/40 transition">
              ${r.cells.map((cell, idx) => `
                <td class="px-3 py-2 border border-slate-200 ${idx === noteIdx ? 'min-w-[140px] max-w-[260px]' : 'whitespace-nowrap'} ${isRightCol(idx) ? 'text-right' : ''}">
                  ${formatPreviewCellHtml(cell, { isAmountOrAccountCol: isRightCol(idx), isSignedCol: isSignedExcelCol(idx) })}
                </td>
              `).join('')}
            </tr>
          `).join('')}
          ${sheet.summaryRow ? `
            <tr class="bg-slate-200/80 border-t-2 border-slate-400 font-bold">
              ${renderMergedRowCellsHtml(sheet.summaryRow, summaryRowIndex, sheet.merges, (cell, idx, colspan) => `
                <td ${colspan > 1 ? `colspan="${colspan}"` : ''} class="px-3 py-2.5 border border-slate-300 whitespace-nowrap ${isRightCol(idx) && colspan === 1 ? 'text-right' : ''}">
                  ${formatPreviewCellHtml(cell, { isAmountOrAccountCol: isRightCol(idx) && colspan === 1, isSignedCol: isSignedExcelCol(idx) && colspan === 1 || (!isPerAccount && idx === nomIdx), isSummaryRow: true })}
                </td>
              `)}
            </tr>
          ` : ''}
        </tbody>
      </table>
      ${totalRows > MAX_PREVIEW_ROWS ? `
        <div class="p-3 bg-amber-50 border-t border-amber-200 text-center text-[11px] font-semibold text-amber-800">
          Menampilkan ${MAX_PREVIEW_ROWS} dari ${totalRows} baris di pratinjau. Seluruh ${totalRows} transaksi lengkap akan dimasukkan ke file Excel yang diunduh.
        </div>
      ` : ''}
      ${isPerAccount ? `
        <div class="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
          Catatan: Kolom rekening menampilkan seluruh sumber rekening yang bertransaksi pada sheet ini (termasuk rekening tersembunyi). Nilai <strong>(-)</strong> adalah pengeluaran/transfer keluar dan <strong>(+)</strong> adalah pemasukan/transfer masuk.
        </div>
      ` : ''}
    `;
    return;
  }

  // PDF HTML TABLE & PAGE MIRROR PREVIEW
  const totalRows = state.detailRows.length;
  const displayRows = state.detailRows.slice(0, MAX_PREVIEW_ROWS);
  const pdfNoteIdx = isPerAccount ? 3 : 4;
  const pdfAmountStartIdx = isPerAccount ? 4 : 5;

  tableWrap.innerHTML = `
    <div class="p-3 sm:p-4 space-y-4 bg-white">
      <div class="border-l-4 ${isPerAccount ? 'border-indigo-600' : 'border-emerald-600'} bg-slate-50 rounded-r-xl p-3">
        <div class="text-[10px] font-bold uppercase tracking-wider ${isPerAccount ? 'text-indigo-600' : 'text-emerald-600'}">FinTrack • Format A4</div>
        <h4 class="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">${escapeHtml(state.title)}</h4>
        <p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(state.subtitle)}</p>
      </div>

      ${state.monthlyRows && state.monthlyRows.length > 0 ? `
        <div class="space-y-1.5">
          <div>
            <div class="text-xs font-bold text-slate-800">Rekap Arus Kas Bulanan (Januari – Desember)</div>
            <p class="text-[10px] text-slate-500">Perbandingan kinerja pemasukan, pengeluaran, dan surplus/defisit setiap bulan pada tahun terpilih.</p>
          </div>
          <div class="overflow-x-auto border border-slate-200 rounded-xl">
            <table class="w-full text-left text-[11px] border-collapse">
              <thead class="bg-emerald-600 text-white">
                <tr>
                  <th class="px-3 py-2">Bulan</th>
                  <th class="px-3 py-2 text-center">Trx</th>
                  <th class="px-3 py-2 text-right">Pemasukan</th>
                  <th class="px-3 py-2 text-right">Pengeluaran (inc. Admin)</th>
                  <th class="px-3 py-2 text-right">Arus Kas Bersih</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${state.monthlyRows.map(mr => `
                  <tr class="hover:bg-slate-50">
                    <td class="px-3 py-1.5 font-semibold text-slate-800">${escapeHtml(mr[0])}</td>
                    <td class="px-3 py-1.5 text-center text-slate-500">${escapeHtml(mr[1])}</td>
                    <td class="px-3 py-1.5 text-right text-emerald-700">${escapeHtml(mr[2])}</td>
                    <td class="px-3 py-1.5 text-right text-rose-600">${escapeHtml(mr[3])}</td>
                    <td class="px-3 py-1.5 text-right font-bold text-slate-800">${escapeHtml(mr[4])}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="space-y-1.5">
        <div>
          <div class="text-xs font-bold text-slate-800">Rincian Mutasi Transaksi (Urutan Terbaru di Atas)</div>
          <p class="text-[10px] text-slate-500">Menampilkan daftar mutasi dari tanggal terbaru; tanda (+) menandakan dana masuk dan (-) menandakan dana keluar.</p>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-[11px] border-collapse">
            <thead class="${isPerAccount ? 'bg-indigo-600' : 'bg-emerald-600'} text-white">
              <tr>
                ${state.head.map((h, idx) => `
                  <th class="px-2.5 py-2 font-bold whitespace-nowrap ${idx >= pdfAmountStartIdx ? 'text-right' : ''}">${escapeHtml(h)}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              ${state.balanceRow ? `
                <tr class="bg-emerald-50 border-b-2 border-emerald-200 font-bold">
                  ${state.balanceRow.map((cell, idx) => `
                    <td class="px-2.5 py-2 whitespace-nowrap ${idx >= pdfAmountStartIdx ? 'text-right' : ''} text-emerald-900">
                      ${formatPreviewCellHtml(cell, { isAmountOrAccountCol: idx >= pdfAmountStartIdx, isBalanceRow: true })}
                    </td>
                  `).join('')}
                </tr>
              ` : ''}
              ${displayRows.length === 0 ? `
                <tr>
                  <td colspan="${state.head.length}" class="px-4 py-8 text-center text-slate-400 italic">Tidak ada transaksi pada periode ini.</td>
                </tr>
              ` : displayRows.map(r => `
                <tr class="hover:bg-slate-50">
                  ${r.cells.map((cell, idx) => `
                    <td class="px-2.5 py-1.5 ${idx === pdfNoteIdx ? 'min-w-[120px] max-w-[240px]' : 'whitespace-nowrap'} ${idx >= pdfAmountStartIdx ? 'text-right' : ''}">
                      ${formatPreviewCellHtml(cell, { isAmountOrAccountCol: idx >= pdfAmountStartIdx })}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
              ${state.summaryRow ? `
                <tr class="bg-slate-100 border-t-2 border-slate-300 font-bold">
                  ${state.summaryRow.map((cell, idx) => `
                    <td class="px-2.5 py-2 whitespace-nowrap ${idx >= pdfAmountStartIdx ? 'text-right' : ''}">
                      ${formatPreviewCellHtml(cell, { isAmountOrAccountCol: idx >= pdfAmountStartIdx, isSummaryRow: true })}
                    </td>
                  `).join('')}
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
        ${totalRows > MAX_PREVIEW_ROWS ? `
          <div class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-center text-[11px] font-semibold text-amber-800">
            Menampilkan ${MAX_PREVIEW_ROWS} dari ${totalRows} transaksi di pratinjau tabel. Seluruh ${totalRows} transaksi lengkap akan tercetak di file PDF.
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function closeExportPreviewModal() {
  const iframe = document.getElementById('export-preview-pdf-iframe');
  if (iframe) iframe.src = 'about:blank';
  cleanupPendingExportPreviewUrl();
  pendingExportPreviewState = null;
  closeModal('export-preview-modal');
}

function backToExportOptionsFromPreview() {
  const wasAnalysis = Boolean(pendingExportPreviewState?.isAnalysisExport);
  closeExportPreviewModal();
  openModal(wasAnalysis ? 'analysis-export-modal' : 'export-options-modal');
  lucide.createIcons();
}

function confirmDownloadPreparedExport() {
  const state = pendingExportPreviewState;
  if (!state) return;

  try {
    if (state.format === 'excel' && state.workbook) {
      XLSX.writeFile(state.workbook, state.filename);
    } else if (state.format === 'pdf' && state.doc) {
      state.doc.save(state.filename);
    }
    showAppToast('Ekspor Berhasil', `File "${state.filename}" siap diunduh.`, {
      tone: 'emerald',
      duration: 5000
    });
  } catch (err) {
    console.error('Gagal mengunduh file ekspor:', err);
    showAppAlert('Terjadi kendala saat menyimpan file ekspor.');
    return;
  }

  closeExportPreviewModal();
}

function exportToPDF() {
  openExportModal('pdf');
}

// ==================== EKSPOR MENU ANALISA (EXCEL & PDF, BULANAN & TAHUNAN) ====================
function openAnalysisExportModal(format) {
  setVal('ana-export-target-format', format || 'excel');

  const iconWrap = document.getElementById('ana-export-icon-wrap');
  const iconEl = document.getElementById('ana-export-icon');
  const titleEl = document.getElementById('ana-export-modal-title');

  if (format === 'pdf') {
    if (iconWrap) iconWrap.className = 'p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0';
    if (iconEl) iconEl.setAttribute('data-lucide', 'file-text');
    if (titleEl) titleEl.textContent = 'Ekspor Analisa ke PDF (.pdf)';
  } else {
    if (iconWrap) iconWrap.className = 'p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0';
    if (iconEl) iconEl.setAttribute('data-lucide', 'file-spreadsheet');
    if (titleEl) titleEl.textContent = 'Ekspor Analisa ke Excel (.xlsx)';
  }

  // Sinkronkan default periode dengan tab Analisa yang sedang dibuka
  const curScope = (typeof analysisScope !== 'undefined' && analysisScope === 'year') ? 'year' : 'month';
  const targetRadio = document.querySelector(`input[name="ana-export-scope"][value="${curScope}"]`);
  if (targetRadio) targetRadio.checked = true;

  const curMonthVal = document.getElementById('analysis-month-picker')?.value || dashboardSelectedMonth;
  const curYearVal = document.getElementById('analysis-year-picker')?.value || String(curYear);
  setVal('ana-export-month-input', curMonthVal);
  setVal('ana-export-year-input', curYearVal);

  onAnalysisExportScopeChange();
  openModal('analysis-export-modal');
  lucide.createIcons();
}

function onAnalysisExportScopeChange() {
  const scope = document.querySelector('input[name="ana-export-scope"]:checked')?.value || 'month';
  const monthWrap = document.getElementById('ana-export-month-wrap');
  const yearWrap = document.getElementById('ana-export-year-wrap');

  if (scope === 'year') {
    if (yearWrap) yearWrap.classList.remove('hidden');
    if (monthWrap) monthWrap.classList.add('hidden');
  } else {
    if (monthWrap) monthWrap.classList.remove('hidden');
    if (yearWrap) yearWrap.classList.add('hidden');
  }
}

function previewAnalysisDocumentExport() {
  const format = document.getElementById('ana-export-target-format')?.value || 'excel';
  const scope = document.querySelector('input[name="ana-export-scope"]:checked')?.value || 'month';
  const filterPrefix = scope === 'year'
    ? (document.getElementById('ana-export-year-input')?.value || String(curYear)).trim()
    : (document.getElementById('ana-export-month-input')?.value || dashboardSelectedMonth).trim();

  cleanupPendingExportPreviewUrl();

  try {
    pendingExportPreviewState = (format === 'excel')
      ? buildAnalysisExcelPackage(scope, filterPrefix)
      : buildAnalysisPdfPackage(scope, filterPrefix);
  } catch (err) {
    console.error('Gagal menyusun pratinjau ekspor analisa:', err);
    showAppAlert('Gagal menyiapkan pratinjau ekspor analisa. Silakan coba lagi.');
    return;
  }

  closeModal('analysis-export-modal');
  renderExportPreviewModal();
  openModal('export-preview-modal');
  lucide.createIcons();
}

function buildAnalysisExcelPackage(scope, filterPrefix) {
  const data = computeAnalysisReportData(scope, filterPrefix);
  const workbook = XLSX.utils.book_new();
  const sheets = [];

  const addStyledAnalysisSheet = (sheetName, aoa, opts) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applyWorksheetStyling(ws, aoa, opts);
    XLSX.utils.book_append_sheet(workbook, ws, sanitizeExcelSheetName(sheetName));
    sheets.push({
      name: sheetName,
      txCount: Math.max(0, aoa.length - 1),
      aoa,
      merges: opts.merges || [],
      bannerRows: opts.bannerRows || new Set(),
      headerRows: opts.headerRows || new Set(),
      summaryRows: opts.summaryRows || new Set()
    });
  };

  // Sheet 1: Ringkasan Analisa, Struktur Pengeluaran, Evaluasi Belanja & Cashflow, Dana Darurat (4 kolom seragam)
  const s1Aoa = [
    [`LAPORAN ANALISA KEUANGAN (${data.periodLabel})`, '', `${data.isYear ? 'Mode Tahunan' : 'Mode Bulanan'} • Dicetak: ${new Date().toLocaleDateString('id-ID')}`, ''],
    [],
    ['1. KESEHATAN FINANSIAL & ARUS KAS', 'Nilai', 'Keterangan', ''],
    ['Total Transaksi Periode', data.txCount, `${data.txCount} transaksi tercatat`, ''],
    ['Total Pemasukan', data.totalInflow, `Tetap: ${formatCurrency(data.fixedIncome)} | Dinamis: ${formatCurrency(data.dynamicIncome)}`, ''],
    ['Total Pengeluaran (inc. Admin)', data.totalOutflow, `Biaya Admin Transfer: ${formatCurrency(data.totalTransferAdminFee)}`, ''],
    ['Arus Kas Bersih (Net)', data.netCashFlow, data.netCashFlow >= 0 ? 'Surplus (Pemasukan melebihi pengeluaran)' : 'Defisit (Pengeluaran melebihi pemasukan)', ''],
    ['Rasio Tabungan (%)', Number(data.savingRatio.toFixed(1)), data.savingStatus, ''],
    [],
    ['2. STRUKTUR PENGELUARAN', 'Nominal (IDR)', 'Persentase (%)', 'Keterangan'],
    ['Pengeluaran Tetap (Fixed)', data.fixedExpense, Number(data.fixedPct.toFixed(1)), 'Sewa, listrik, internet, air, cicilan wajib'],
    ['Pengeluaran Berkala (Periodic)', data.periodicExpense, Number(data.periodicPct.toFixed(1)), 'Langganan, asuransi, servis berkala'],
    ['Pengeluaran Dinamis (Dynamic)', data.dynamicExpense, Number(data.dynamicPct.toFixed(1)), 'Makan, belanja, hiburan, biaya admin'],
    [],
    [data.isYear ? '3. EVALUASI BELANJA TAHUNAN' : '3. EVALUASI BELANJA HARIAN', 'Hasil', 'Keterangan', ''],
    [data.isYear ? `Hari Bebas Belanja (${data.filterPrefix})` : 'Hari Bebas Belanja', data.evalStats.noSpendLabel, 'Hari tanpa transaksi pengeluaran', ''],
    [data.isYear ? 'Bulan Terboros' : 'Hari Terboros', data.evalStats.peakLabel, `Puncak pengeluaran: ${formatCurrency(data.evalStats.peakAmount)}`, ''],
    [data.isYear ? 'Rata-Rata / Bulan Aktif' : 'Rata-Rata / Hari Aktif', data.evalStats.avgActiveLabel, 'Rata-rata pengeluaran pada periode aktif', ''],
    [],
    [data.isYear ? '4. LAJU PENGELUARAN KUARTALAN' : '4. LAJU PENGELUARAN MINGGUAN', 'Pengeluaran (IDR)', 'Porsi (%)', ''],
    ...data.cashflowBlocks.map(b => [b.label, b.total, Number(b.pct.toFixed(1)), '']),
    [],
    ['5. KETAHANAN DANA DARURAT', 'Nilai', 'Status', ''],
    ['Total Saldo Likuid', data.totalLiquidAssets, 'Akumulasi saldo Bank, E-Wallet & Kas Tunai', ''],
    ['Biaya Hidup Wajib / Bulan', Math.round(data.mandatoryMonthlyCost), data.isYear ? 'Rata-rata bulanan pengeluaran tetap + berkala' : 'Total pengeluaran tetap + berkala bulan ini', ''],
    ['Ketahanan Dana Darurat (Bulan)', Number(data.survivalMonths.toFixed(1)), data.emergencyStatus, '']
  ];

  // Merge kolom C & D pada setiap baris Seksi 1, 3, 4, 5 serta judul banner atas
  const s1Merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }
  ];
  const s1HeaderRows = new Set([2, 9, 14, 19, 21 + data.cashflowBlocks.length]);
  for (let r = 2; r < s1Aoa.length; r++) {
    if (s1Aoa[r].length === 0) continue;
    // Seksi 2 (baris 9..12) memakai 4 kolom terpisah; seksi lainnya merge col 2..3
    if (r < 9 || r > 12) {
      s1Merges.push({ s: { r, c: 2 }, e: { r, c: 3 } });
    }
  }
  addStyledAnalysisSheet('Ringkasan Analisa', s1Aoa, {
    merges: s1Merges,
    bannerRows: new Set([0]),
    headerRows: s1HeaderRows,
    headerFill: '059669',
    bannerFill: '064E3B',
    rightCols: (r, c, val) => (c === 1 && typeof val === 'number') || (c === 2 && r >= 10 && r <= 12 && typeof val === 'number'),
    colCount: 4,
    minColWidths: { 0: 32, 1: 22, 2: 24, 3: 28 }
  });

  // Sheet 2: Rincian Kategori / Arus Kas 12 Bulan (5 kolom seragam)
  if (data.isYear) {
    const avgStartIdx = 4 + data.monthlyBreakdown12.length;
    const s2Aoa = [
      [`REKAP ARUS KAS 12 BULAN — Tahun ${data.filterPrefix}`, '', '', '', ''],
      ['Bulan', 'Jumlah Transaksi', 'Pemasukan (IDR)', 'Pengeluaran (IDR)', 'Arus Kas Bersih (IDR)'],
      ...data.monthlyBreakdown12.map(m => [m.monthName, m.txCount, m.inSum, m.outSum, m.net]),
      ['TOTAL TAHUNAN', data.txCount, data.totalInflow, data.totalOutflow, data.netCashFlow],
      [],
      ['RATA-RATA KATEGORI PER BULAN', 'Tipe', 'Total Tahunan (IDR)', 'Rata-Rata / Bulan (IDR)', ''],
      ...data.yearlyCatAverages.map(c => [c.name, c.type === 'income' ? 'Pemasukan' : 'Pengeluaran', c.total, Math.round(c.avgMonthly), ''])
    ];
    const s2Merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
    ];
    // Merge col 3..4 pada bagian Rata-Rata Kategori per Bulan agar border tabel penuh 5 kolom
    for (let r = avgStartIdx; r < s2Aoa.length; r++) {
      if (s2Aoa[r].length > 0) {
        s2Merges.push({ s: { r, c: 3 }, e: { r, c: 4 } });
      }
    }
    const totalRowIdx = 2 + data.monthlyBreakdown12.length;
    addStyledAnalysisSheet('Arus Kas 12 Bulan', s2Aoa, {
      merges: s2Merges,
      bannerRows: new Set([0]),
      headerRows: new Set([1, avgStartIdx]),
      summaryRows: new Set([totalRowIdx]),
      headerFill: '2563EB',
      bannerFill: '1E3A8A',
      rightCols: (r, c, val) => typeof val === 'number' && c >= 2,
      centerCols: (r, c) => r <= totalRowIdx && c === 1,
      signedCols: (r, c) => (r <= totalRowIdx && c === 4),
      colCount: 5,
      minColWidths: { 0: 26, 1: 18, 2: 20, 3: 20, 4: 22 }
    });
  } else {
    const s2Aoa = [
      [`RINCIAN KATEGORI & SUBKATEGORI — ${data.periodLabel}`, '', '', '', ''],
      ['Jenis', 'Kategori', 'Subkategori', 'Frekuensi', 'Nominal (IDR)']
    ];
    data.expenseCategories.forEach(cat => {
      s2Aoa.push(['Pengeluaran', cat.name, '(Total Kategori)', `${cat.count}x`, cat.total]);
      cat.subcategories.forEach(sub => {
        s2Aoa.push(['Pengeluaran', cat.name, sub.name, `${sub.count}x`, sub.total]);
      });
    });
    if (data.totalTransferAdminFee > 0) {
      s2Aoa.push(['Pengeluaran', 'Biaya Admin Transfer', '-', '-', data.totalTransferAdminFee]);
    }
    data.incomeCategories.forEach(cat => {
      s2Aoa.push(['Pemasukan', cat.name, '(Total Kategori)', `${cat.count}x`, cat.total]);
      cat.subcategories.forEach(sub => {
        s2Aoa.push(['Pemasukan', cat.name, sub.name, `${sub.count}x`, sub.total]);
      });
    });
    addStyledAnalysisSheet('Rincian Kategori', s2Aoa, {
      merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }],
      bannerRows: new Set([0]),
      headerRows: new Set([1]),
      headerFill: '2563EB',
      bannerFill: '1E3A8A',
      rightCols: new Set([4]),
      centerCols: new Set([0, 3]),
      colCount: 5,
      minColWidths: { 0: 15, 1: 24, 2: 26, 3: 14, 4: 20 }
    });
  }

  // Sheet 3: Frekuensi Tertinggi (>1x), Top 5 Pengeluaran, Anomali Lonjakan (5 kolom penuh, header banner ter-merge)
  const freqRows = data.topFrequencies.length > 0
    ? data.topFrequencies.map((f, idx) => [`#${idx + 1}`, f.name, `${f.count}x`, f.total, Math.round(f.avgTicket)])
    : [['-', 'Belum ada pengeluaran berulang (>1x) bersubkategori', '-', 0, 0]];
  const top5Rows = data.top5Expenses.length > 0
    ? data.top5Expenses.map((e, idx) => [`#${idx + 1}`, e.date, e.category, e.note, e.amount])
    : [['-', '-', 'Belum ada pengeluaran', '-', 0]];
  const abnRows = data.abnormalExpenses.length > 0
    ? data.abnormalExpenses.map(ab => [ab.date, ab.category, ab.note, `${ab.ratio.toFixed(1)}x (Rata2: ${formatCurrency(ab.avgCategory)})`, ab.amount])
    : [['-', 'Tidak ada lonjakan tidak wajar', '-', '-', 0]];

  const top5BannerIdx = 2 + freqRows.length + 1;
  const top5HeaderIdx = top5BannerIdx + 1;
  const abnBannerIdx = top5HeaderIdx + top5Rows.length + 2;
  const abnHeaderIdx = abnBannerIdx + 1;

  const s3Aoa = [
    [`${data.isYear ? 'FREKUENSI TERTINGGI (>1x, MAKS. 20 ITEM)' : 'FREKUENSI TERTINGGI (>1x)'} — ${data.periodLabel}`, '', '', '', ''],
    ['Peringkat', 'Subkategori', 'Frekuensi', 'Total Nominal (IDR)', 'Rata-Rata / Transaksi (IDR)'],
    ...freqRows,
    [],
    ['PERINGKAT PENGELUARAN TERBESAR (TOP 5)', '', '', '', ''],
    ['Peringkat', 'Tanggal', 'Kategori', 'Catatan', 'Nominal (IDR)'],
    ...top5Rows,
    [],
    ['DETEKSI TRANSAKSI ABNORMAL / LONJAKAN (>2.5x RATA-RATA)', '', '', '', ''],
    ['Tanggal', 'Kategori', 'Catatan', 'Lonjakan vs Rata-Rata', 'Nominal (IDR)'],
    ...abnRows
  ];
  addStyledAnalysisSheet('Frekuensi & Top 5', s3Aoa, {
    merges: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: top5BannerIdx, c: 0 }, e: { r: top5BannerIdx, c: 4 } },
      { s: { r: abnBannerIdx, c: 0 }, e: { r: abnBannerIdx, c: 4 } }
    ],
    bannerRows: new Set([0, top5BannerIdx, abnBannerIdx]),
    headerRows: new Set([1, top5HeaderIdx, abnHeaderIdx]),
    headerFill: 'D97706',
    bannerFill: '92400E',
    rightCols: (r, c, val) => typeof val === 'number' && (c === 3 || c === 4),
    centerCols: (r, c) => c === 0 || (r > 1 && r < top5BannerIdx && c === 2) || (r > top5HeaderIdx && r < abnBannerIdx && c === 1),
    colCount: 5,
    minColWidths: { 0: 14, 1: 24, 2: 18, 3: 30, 4: 24 }
  });

  const safePeriodSlug = data.filterPrefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Laporan_Analisa_${data.isYear ? 'Tahunan' : 'Bulanan'}_${safePeriodSlug}.xlsx`;

  return {
    format: 'excel',
    isAnalysisExport: true,
    scopeType: scope,
    layoutMode: 'analysis',
    filename,
    analysisData: data,
    sheets,
    activeSheetIndex: 0,
    workbook
  };
}

function buildAnalysisPdfPackage(scope, filterPrefix) {
  const { jsPDF } = window.jspdf;
  const data = computeAnalysisReportData(scope, filterPrefix);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const accentRgb = [5, 150, 105];

  const title = `Laporan Analisa Keuangan (${data.isYear ? 'Tahunan' : 'Bulanan'})`;
  const subtitle = `Periode: ${data.periodLabel}  •  Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`;

  let curY = drawPdfHeroHeader(doc, title, data.periodLabel, subtitle, accentRgb);

  // 1. Ringkasan Kesehatan Finansial & Dana Darurat
  curY = drawPdfSectionIntro(
    doc,
    curY,
    '1. Kesehatan Finansial, Rasio Tabungan & Dana Darurat',
    'Mengukur keseimbangan arus kas masuk-keluar, porsi pendapatan yang berhasil ditabung, serta daya tahan saldo likuid untuk menutup biaya hidup wajib.',
    [16, 185, 129],
    44
  );

  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [['Indikator Kesehatan Finansial', 'Nilai', 'Keterangan']],
    body: [
      ['Total Pemasukan', `+${formatCurrency(data.totalInflow)}`, `Tetap: ${formatCurrency(data.fixedIncome)} | Dinamis: ${formatCurrency(data.dynamicIncome)}`],
      ['Total Pengeluaran (inc. Admin)', `-${formatCurrency(data.totalOutflow)}`, `Admin Transfer: ${formatCurrency(data.totalTransferAdminFee)}`],
      ['Arus Kas Bersih (Net)', formatSignedCurrency(data.netCashFlow), data.netCashFlow >= 0 ? 'Surplus Arus Kas' : 'Defisit Arus Kas'],
      ['Rasio Tabungan', `${data.savingRatio.toFixed(1)}%`, data.savingStatus],
      ['Ketahanan Dana Darurat', `${data.survivalMonths.toFixed(1)} Bulan`, `${data.emergencyStatus} (Likuid: ${formatCurrency(data.totalLiquidAssets)})`]
    ],
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });
  curY = doc.lastAutoTable.finalY + 6;

  // 2. Struktur Pengeluaran
  curY = drawPdfSectionIntro(
    doc,
    curY,
    '2. Struktur Klasifikasi Pengeluaran',
    'Memetakan porsi pengeluaran antara kewajiban rutin (Tetap), pengeluaran terjadwal (Berkala), dan belanja konsumsi/gaya hidup (Dinamis).',
    [79, 70, 229],
    34
  );

  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [['Klasifikasi Biaya', 'Nominal', 'Porsi', 'Penjelasan Singkat']],
    body: [
      ['Pengeluaran Tetap (Fixed)', formatCurrency(data.fixedExpense), `${data.fixedPct.toFixed(1)}%`, 'Tagihan wajib rutin: sewa, listrik, internet, cicilan'],
      ['Pengeluaran Berkala (Periodic)', formatCurrency(data.periodicExpense), `${data.periodicPct.toFixed(1)}%`, 'Kebutuhan berkala: langganan, asuransi, servis'],
      ['Pengeluaran Dinamis (Dynamic)', formatCurrency(data.dynamicExpense), `${data.dynamicPct.toFixed(1)}%`, 'Konsumsi harian, belanja, hiburan & biaya admin']
    ],
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } }
  });
  curY = doc.lastAutoTable.finalY + 6;

  // 3. Evaluasi Belanja & Cashflow Blocks
  const evalRows = [
    [data.isYear ? 'Hari Bebas Belanja Setahun' : 'Hari Bebas Belanja', data.evalStats.noSpendLabel, 'Jumlah hari tanpa transaksi pengeluaran'],
    [data.isYear ? 'Bulan Terboros' : 'Hari Terboros', data.evalStats.peakLabel, `Puncak belanja tertinggi: ${formatCurrency(data.evalStats.peakAmount)}`],
    [data.isYear ? 'Rata-Rata / Bulan Aktif' : 'Rata-Rata / Hari Aktif', data.evalStats.avgActiveLabel, 'Rata-rata belanja saat periode aktif bertransaksi'],
    ...data.cashflowBlocks.map(b => [b.label, formatCurrency(b.total), `${b.pct.toFixed(1)}% dari total pengeluaran periode`])
  ];
  curY = drawPdfSectionIntro(
    doc,
    curY,
    data.isYear ? '3. Evaluasi Belanja Tahunan & Laju Kuartalan' : '3. Evaluasi Belanja Harian & Laju Mingguan',
    data.isYear
      ? 'Menunjukkan konsistensi hari tanpa belanja, bulan dengan pengeluaran puncak, serta distribusi arus keluar per kuartal (Q1–Q4).'
      : 'Menunjukkan hari bebas belanja, hari terboros, rata-rata pengeluaran per hari aktif, dan distribusi belanja per minggu.',
    [51, 65, 85],
    12 + (evalRows.length * 7)
  );

  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [[data.isYear ? 'Indikator Evaluasi Tahunan' : 'Indikator Evaluasi Harian', 'Hasil / Nominal', 'Keterangan']],
    body: evalRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });
  curY = doc.lastAutoTable.finalY + 6;

  // 4. Rincian Arus 12 Bulan (Tahunan) atau Kategori (Bulanan)
  if (data.isYear) {
    curY = drawPdfSectionIntro(
      doc,
      curY,
      '4. Rekapitulasi Arus Kas 12 Bulan',
      'Rincian performa pemasukan, pengeluaran, jumlah transaksi, serta surplus/defisit setiap bulan sepanjang tahun.',
      [37, 99, 235],
      94
    );

    doc.autoTable({
      startY: curY,
      margin: PDF_PAGE_MARGINS,
      head: [['Bulan', 'Trx', 'Pemasukan', 'Pengeluaran', 'Arus Kas Bersih']],
      body: data.monthlyBreakdown12.map(m => [
        m.monthName,
        String(m.txCount),
        `+${formatCurrency(m.inSum)}`,
        `-${formatCurrency(m.outSum)}`,
        formatSignedCurrency(m.net)
      ]),
      theme: 'striped',
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right', textColor: [5, 150, 105] },
        3: { halign: 'right', textColor: [225, 29, 72] },
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });
    curY = doc.lastAutoTable.finalY + 6;
  } else {
    const catBody = [];
    data.expenseCategories.forEach(c => catBody.push(['Pengeluaran', c.name, `${c.count}x`, `${c.pct.toFixed(1)}%`, formatCurrency(c.total)]));
    if (data.totalTransferAdminFee > 0) catBody.push(['Pengeluaran', 'Biaya Admin Transfer', '-', '-', formatCurrency(data.totalTransferAdminFee)]);
    data.incomeCategories.forEach(c => catBody.push(['Pemasukan', c.name, `${c.count}x`, `${c.pct.toFixed(1)}%`, formatCurrency(c.total)]));
    if (catBody.length === 0) catBody.push(['-', 'Belum ada kategori transaksi di bulan ini', '-', '-', '-']);

    curY = drawPdfSectionIntro(
      doc,
      curY,
      '4. Rincian Arus Kas per Kategori',
      'Kontribusi setiap kategori pengeluaran dan pemasukan beserta frekuensi transaksi dan porsi persentasenya.',
      [37, 99, 235],
      Math.min(85, 14 + (catBody.length * 6.5))
    );

    doc.autoTable({
      startY: curY,
      margin: PDF_PAGE_MARGINS,
      head: [['Jenis', 'Kategori', 'Frek.', 'Porsi', 'Total Nominal']],
      body: catBody,
      theme: 'grid',
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } }
    });
    curY = doc.lastAutoTable.finalY + 6;
  }

  // 5. Frekuensi Tertinggi (>1x)
  const freqBody = data.topFrequencies.length > 0
    ? data.topFrequencies.map((f, i) => [`#${i + 1} ${f.name}`, `${f.count}x`, formatCurrency(f.total), formatCurrency(Math.round(f.avgTicket))])
    : [['Belum ada pengeluaran berulang (>1x) bersubkategori', '-', '-', '-']];
  curY = drawPdfSectionIntro(
    doc,
    curY,
    data.isYear ? '5. Kebiasaan & Frekuensi Pengeluaran Tertinggi (>1x, Maks. 20)' : '5. Kebiasaan & Frekuensi Pengeluaran Tertinggi (>1x)',
    'Daftar subkategori pengeluaran yang paling sering berulang beserta total nominal dan rata-rata per transaksi.',
    [217, 119, 6],
    Math.min(90, 14 + (freqBody.length * 6.5))
  );

  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [['Subkategori', 'Frek.', 'Total', 'Rata-Rata / Trx']],
    body: freqBody,
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
  });
  curY = doc.lastAutoTable.finalY + 6;

  // 6. Top 5 Pengeluaran Terbesar
  const top5Body = data.top5Expenses.length > 0
    ? data.top5Expenses.map((e, i) => [`#${i + 1} ${e.note}`, e.date, e.category, formatCurrency(e.amount)])
    : [['Belum ada pengeluaran pada periode ini', '-', '-', '-']];
  curY = drawPdfSectionIntro(
    doc,
    curY,
    '6. Peringkat Top 5 Pengeluaran Terbesar',
    'Lima transaksi pengeluaran tunggal bernilai paling besar selama periode laporan untuk evaluasi prioritas belanja.',
    [225, 29, 72],
    14 + (top5Body.length * 6.5)
  );

  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [['Keterangan Transaksi', 'Tanggal', 'Kategori', 'Nominal']],
    body: top5Body,
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
  });
  curY = doc.lastAutoTable.finalY + 6;

  // 7. Deteksi Lonjakan / Transaksi Abnormal
  const abnBody = data.abnormalExpenses.length > 0
    ? data.abnormalExpenses.map(ab => [ab.date, ab.category, ab.note, `${ab.ratio.toFixed(1)}x (Rata2: ${formatCurrency(ab.avgCategory)})`, formatCurrency(ab.amount)])
    : [['-', '-', 'Tidak ditemukan lonjakan pengeluaran di atas 2.5x rata-rata kategori.', '-', '-']];
  curY = drawPdfSectionIntro(
    doc,
    curY,
    '7. Deteksi Transaksi Lonjakan / Abnormal (>2.5x Rata-Rata)',
    'Transaksi yang nilainya melonjak signifikan melampaui 2.5x rata-rata historis pada kategori terkait.',
    [124, 58, 237],
    Math.min(60, 14 + (abnBody.length * 6.5))
  );

  doc.autoTable({
    startY: curY,
    margin: PDF_PAGE_MARGINS,
    head: [['Tanggal', 'Kategori', 'Catatan', 'Rasio Lonjakan', 'Nominal']],
    body: abnBody,
    theme: 'grid',
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
  });

  // Terapkan Header lanjutan & Footer bernomor di setiap halaman A4
  applyPdfRunningHeaderAndFooter(doc, title, data.periodLabel, accentRgb);

  const pdfBlob = doc.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);
  const safePeriodSlug = data.filterPrefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Laporan_Analisa_${data.isYear ? 'Tahunan' : 'Bulanan'}_${safePeriodSlug}.pdf`;

  return {
    format: 'pdf',
    isAnalysisExport: true,
    scopeType: scope,
    layoutMode: 'analysis',
    filename,
    title: `${title} — ${data.periodLabel}`,
    subtitle,
    analysisData: data,
    doc,
    pdfBlobUrl,
    viewMode: 'table'
  };
}

function renderAnalysisExportPreviewBody(state, tableWrap) {
  const a = state.analysisData;
  if (!a) return;

  if (state.format === 'excel') {
    const sheet = state.sheets[state.activeSheetIndex] || state.sheets[0];
    if (!sheet) {
      tableWrap.innerHTML = `<div class="py-10 text-center text-xs text-slate-400">Tidak ada data analisa.</div>`;
      return;
    }

    const totalCols = Math.max(1, ...(sheet.aoa || []).map(r => (r ? r.length : 0)));
    tableWrap.innerHTML = `
      <table class="w-full text-left text-[11px] sm:text-xs border-collapse bg-white">
        <tbody class="divide-y divide-slate-200">
          ${sheet.aoa.map((row, rIdx) => {
            if (!row || row.length === 0) {
              return `<tr class="h-3 bg-slate-100/70"><td colspan="${totalCols}"></td></tr>`;
            }
            const isBanner = sheet.bannerRows && sheet.bannerRows.has(rIdx);
            const isHeader = sheet.headerRows && sheet.headerRows.has(rIdx);
            const isSummary = sheet.summaryRows && sheet.summaryRows.has(rIdx);
            const rowCls = isBanner
              ? 'bg-emerald-800 text-white font-bold'
              : (isHeader
                  ? 'bg-emerald-600 text-white font-bold'
                  : (isSummary ? 'bg-slate-200 text-slate-900 font-bold border-t-2 border-slate-400' : (rIdx % 2 === 1 ? 'bg-slate-50/70 hover:bg-emerald-50/30' : 'bg-white hover:bg-emerald-50/30')));

            return `
              <tr class="${rowCls}">
                ${renderMergedRowCellsHtml(row, rIdx, sheet.merges, (cell, cIdx, colspan) => {
                  const isNum = typeof cell === 'number';
                  const formatted = isNum
                    ? (Math.abs(cell) >= 100 || (cIdx >= 2 && isSummary) ? formatCurrency(cell) : String(cell))
                    : escapeHtml(String(cell ?? ''));
                  return `<td ${colspan > 1 ? `colspan="${colspan}"` : ''} class="px-3 py-2 border border-slate-200/80 ${isNum ? 'text-right font-semibold whitespace-nowrap' : ''}">${formatted}</td>`;
                })}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    return;
  }

  // PDF HTML TABLE MIRROR FOR ANALISA
  tableWrap.innerHTML = `
    <div class="p-3 sm:p-4 space-y-4 bg-white">
      <div class="border-l-4 border-emerald-600 bg-slate-50 rounded-r-xl p-3">
        <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">FinTrack • Format A4</div>
        <h4 class="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">${escapeHtml(state.title)}</h4>
        <p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(state.subtitle)}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-indigo-600 text-white text-[11px] font-bold px-3 py-2">Struktur Pengeluaran &amp; Dana Darurat</div>
          <div class="px-3 pt-2 text-[10px] text-slate-500 border-b border-slate-100 pb-1.5">Distribusi belanja Tetap, Berkala, Dinamis dan kecukupan dana darurat.</div>
          <div class="p-3 space-y-1.5 text-xs">
            <div class="flex justify-between"><span>Tetap (Fixed):</span><strong>${formatCurrency(a.fixedExpense)} (${a.fixedPct.toFixed(1)}%)</strong></div>
            <div class="flex justify-between"><span>Berkala (Periodic):</span><strong>${formatCurrency(a.periodicExpense)} (${a.periodicPct.toFixed(1)}%)</strong></div>
            <div class="flex justify-between"><span>Dinamis (Dynamic):</span><strong>${formatCurrency(a.dynamicExpense)} (${a.dynamicPct.toFixed(1)}%)</strong></div>
            <div class="flex justify-between border-t border-slate-100 pt-1.5 mt-1.5"><span>Dana Darurat (${a.survivalMonths.toFixed(1)} Bln):</span><strong class="text-indigo-700">${escapeHtml(a.emergencyStatus)}</strong></div>
          </div>
        </div>

        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-slate-700 text-white text-[11px] font-bold px-3 py-2">${a.isYear ? 'Evaluasi Tahunan &amp; Arus Kuartalan' : 'Evaluasi Harian &amp; Arus Mingguan'}</div>
          <div class="px-3 pt-2 text-[10px] text-slate-500 border-b border-slate-100 pb-1.5">Konsistensi bebas belanja, puncak pengeluaran, dan laju arus keluar.</div>
          <div class="p-3 space-y-1.5 text-xs">
            <div class="flex justify-between"><span>Bebas Belanja:</span><strong>${escapeHtml(a.evalStats.noSpendLabel)}</strong></div>
            <div class="flex justify-between"><span>${a.isYear ? 'Bulan Terboros' : 'Hari Terboros'}:</span><strong>${escapeHtml(a.evalStats.peakLabel)} (${formatCurrency(a.evalStats.peakAmount)})</strong></div>
            <div class="flex justify-between"><span>Rata-Rata Aktif:</span><strong>${escapeHtml(a.evalStats.avgActiveLabel)}</strong></div>
            <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
              ${a.cashflowBlocks.map(b => `<div class="text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200 flex justify-between"><span>${escapeHtml(b.label.split(' ')[0])} ${escapeHtml(b.label.split(' ')[1] || '')}</span><strong>${formatCurrency(b.total)}</strong></div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      ${a.isYear ? `
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-blue-600 text-white text-[11px] font-bold px-3 py-2">Rangkuman Arus Kas 12 Bulan (${escapeHtml(a.periodLabel)})</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-[11px]">
              <thead class="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th class="px-3 py-1.5">Bulan</th>
                  <th class="px-3 py-1.5 text-center">Trx</th>
                  <th class="px-3 py-1.5 text-right">Pemasukan</th>
                  <th class="px-3 py-1.5 text-right">Pengeluaran</th>
                  <th class="px-3 py-1.5 text-right">Arus Kas Bersih</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${a.monthlyBreakdown12.map(m => `
                  <tr>
                    <td class="px-3 py-1.5 font-semibold">${escapeHtml(m.monthName)}</td>
                    <td class="px-3 py-1.5 text-center">${m.txCount}</td>
                    <td class="px-3 py-1.5 text-right text-emerald-700">+${formatCurrency(m.inSum)}</td>
                    <td class="px-3 py-1.5 text-right text-rose-600">-${formatCurrency(m.outSum)}</td>
                    <td class="px-3 py-1.5 text-right font-bold">${formatSignedCurrency(m.net)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : `
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-blue-600 text-white text-[11px] font-bold px-3 py-2">Rincian Kategori (${escapeHtml(a.periodLabel)})</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-[11px]">
              <thead class="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th class="px-3 py-1.5">Jenis</th>
                  <th class="px-3 py-1.5">Kategori</th>
                  <th class="px-3 py-1.5 text-center">Frek.</th>
                  <th class="px-3 py-1.5 text-right">Porsi</th>
                  <th class="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${a.expenseCategories.map(c => `<tr><td class="px-3 py-1.5 text-rose-600 font-semibold">Pengeluaran</td><td class="px-3 py-1.5 font-semibold">${escapeHtml(c.name)}</td><td class="px-3 py-1.5 text-center">${c.count}x</td><td class="px-3 py-1.5 text-right">${c.pct.toFixed(1)}%</td><td class="px-3 py-1.5 text-right font-bold">${formatCurrency(c.total)}</td></tr>`).join('')}
                ${a.incomeCategories.map(c => `<tr><td class="px-3 py-1.5 text-emerald-700 font-semibold">Pemasukan</td><td class="px-3 py-1.5 font-semibold">${escapeHtml(c.name)}</td><td class="px-3 py-1.5 text-center">${c.count}x</td><td class="px-3 py-1.5 text-right">${c.pct.toFixed(1)}%</td><td class="px-3 py-1.5 text-right font-bold">${formatCurrency(c.total)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-amber-600 text-white text-[11px] font-bold px-3 py-2">${a.isYear ? 'Frekuensi Tertinggi (&gt;1x, Maks. 20)' : 'Frekuensi Tertinggi (&gt;1x)'}</div>
          <div class="divide-y divide-slate-100 max-h-56 overflow-y-auto text-[11px]">
            ${a.topFrequencies.length > 0
              ? a.topFrequencies.map((f, i) => `<div class="px-3 py-1.5 flex justify-between"><span><strong>#${i + 1} ${escapeHtml(f.name)}</strong> (${f.count}x)</span><strong>${formatCurrency(f.total)}</strong></div>`).join('')
              : `<div class="p-4 text-center text-slate-400 italic">Belum ada pengeluaran berulang (&gt;1x).</div>`}
          </div>
        </div>

        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-rose-600 text-white text-[11px] font-bold px-3 py-2">Top 5 Pengeluaran Terbesar</div>
          <div class="divide-y divide-slate-100 max-h-56 overflow-y-auto text-[11px]">
            ${a.top5Expenses.length > 0
              ? a.top5Expenses.map((e, i) => `<div class="px-3 py-1.5 flex justify-between gap-2"><span class="truncate"><strong>#${i + 1} ${escapeHtml(e.note)}</strong> (${e.date})</span><strong class="shrink-0">${formatCurrency(e.amount)}</strong></div>`).join('')
              : `<div class="p-4 text-center text-slate-400 italic">Belum ada pengeluaran.</div>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== 1. IMPOR TRANSAKSI: ANTI-DUPLIKAT & PRATINJAU ====================
let pendingTxImportList = [];

function importFromExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      let rawRows = [];

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);
        rawRows = rawRows.concat(rows);
      });

      if (rawRows.length === 0) {
        alert('File Excel kosong atau tidak memiliki data.');
        return;
      }

      const newRows = [];
      let duplicateCount = 0;
      const seenInImport = new Set();

      rawRows.forEach(r => {
        const rawAmount = r['Nominal (IDR)'] !== undefined ? r['Nominal (IDR)'] : (r.Nominal !== undefined ? r.Nominal : r.Amount);
        const rawDate = r['Tanggal'] || r.Date;
        const rawDateUpper = String(rawDate || '').trim().toUpperCase();
        if (rawDateUpper.startsWith('SALDO SAAT EKSPOR') || rawDateUpper.startsWith('TOTAL MUTASI')) {
          return;
        }

        if (rawAmount !== undefined && rawAmount !== null && String(rawAmount).trim() !== '' && rawDate) {
          const dateStr = String(rawDate).substring(0, 10);
          const amount = Math.abs(parseFloat(rawAmount)) || 0;
          const rawFee = r['Biaya Admin (IDR)'] || r['Biaya Admin'] || r.AdminFee || 0;
          const adminFee = Math.abs(parseFloat(rawFee)) || 0;
          const rawType = String(r['Tipe'] || r.Type || '').toLowerCase();
          let type = 'expense';
          let toAccountId = null;

          const accName = r['Sumber Rekening'] || r.Account || '';
          let acc = accName ? accounts.find(a => a.name.toLowerCase() === String(accName).toLowerCase()) : null;

          if (rawType.includes('transfer')) {
            type = 'transfer';
            if (String(accName).includes('->')) {
              const parts = String(accName).split('->').map(s => s.trim());
              const fromA = accounts.find(a => a.name.toLowerCase() === parts[0].toLowerCase());
              const toA = accounts.find(a => a.name.toLowerCase() === parts[1].toLowerCase());
              if (fromA) acc = fromA;
              if (toA) toAccountId = toA.id;
            } else {
              // Versi 2 (tanpa kolom Sumber Rekening): deteksi rekening sumber (< 0) & tujuan (> 0) dari kolom rekening
              for (const candidateAcc of accounts) {
                const colVal = r[candidateAcc.name];
                if (typeof colVal === 'number' && colVal < 0 && !acc) acc = candidateAcc;
                if (typeof colVal === 'number' && colVal > 0 && !toAccountId) toAccountId = candidateAcc.id;
              }
            }
            if (!acc) acc = accounts[0];
            if (!toAccountId) toAccountId = accounts.find(a => a.id !== acc.id)?.id || acc.id;
          } else if (rawType.includes('masuk') || rawType.includes('income')) {
            type = 'income';
            if (!acc) {
              acc = accounts.find(candidateAcc => typeof r[candidateAcc.name] === 'number' && r[candidateAcc.name] > 0) || accounts[0];
            }
          } else {
            if (!acc) {
              acc = accounts.find(candidateAcc => typeof r[candidateAcc.name] === 'number' && r[candidateAcc.name] < 0) || accounts[0];
            }
          }
          if (!acc) acc = accounts[0];

          const catName = r['Kategori'] || r.Category || 'Lain-lain';
          let catId = '';
          if (type !== 'transfer') {
            let cat = categories.find(c => c.name.toLowerCase() === String(catName).toLowerCase() && c.type === type);
            if (!cat) {
              cat = { 
                id: 'cat-' + Date.now() + Math.random().toString().slice(2, 6), 
                name: catName, 
                type, 
                expenseClass: (type === 'income' ? 'fixed' : 'dynamic'), 
                subcategories: [] 
              };
              categories.push(cat);
            }
            catId = cat.id;
          }

          const subcategory = r['Subkategori'] || r.Subcategory || '';
          const note = String(r['Catatan'] || r.Description || '');

          // ==================== CEK DUPLIKAT TERHADAP DATABASE LOKAL ====================
          const isDuplicateLocal = transactions.some(t => 
            t.date === dateStr &&
            Math.abs(t.amount - amount) < 0.01 &&
            t.type === type &&
            t.accountId === acc.id &&
            (t.note || '').trim().toLowerCase() === note.trim().toLowerCase() &&
            (t.subcategory || '').trim().toLowerCase() === subcategory.trim().toLowerCase()
          );

          // Cek duplikat di dalam file Excel itu sendiri
          const txFingerprint = `${dateStr}_${amount}_${type}_${acc.id}_${note}_${subcategory}`;
          const isDuplicateInFile = seenInImport.has(txFingerprint);

          if (isDuplicateLocal || isDuplicateInFile) {
            duplicateCount++;
          } else {
            seenInImport.add(txFingerprint);
            newRows.push({
              id: 'tx-' + Date.now() + Math.random().toString().slice(2, 6),
              date: dateStr,
              type,
              accountId: acc.id,
              toAccountId,
              categoryId: catId,
              subcategory,
              amount,
              adminFee,
              note,
              accName: acc.name,
              catName
            });
          }
        }
      });

      // Simpan data yang lolos verifikasi dan buka modal pratinjau konfirmasi
      pendingTxImportList = newRows;

      setText('preview-tx-total', rawRows.length);
      setText('preview-tx-valid', newRows.length);
      setText('preview-tx-duplicate', duplicateCount);

      const listEl = document.getElementById('preview-tx-list');
      if (listEl) {
        if (newRows.length === 0) {
          listEl.innerHTML = `<div class="py-8 text-center text-slate-400 italic">Semua transaksi di file Excel ini sudah ada (duplikat) dan akan dilewati.</div>`;
          document.getElementById('btn-confirm-import-tx').disabled = true;
        } else {
          document.getElementById('btn-confirm-import-tx').disabled = false;
          listEl.innerHTML = newRows.slice(0, 50).map(t => `
            <div class="pt-2 pb-1 flex items-start justify-between gap-2">
              <div class="space-y-0.5 truncate">
                <span class="font-bold text-slate-800 block truncate">${escapeHtml(t.note || t.catName)}</span>
                <span class="text-[10px] text-slate-400">${t.date} • ${escapeHtml(t.accName)} ${t.subcategory ? `• ${escapeHtml(t.subcategory)}` : ''}</span>
              </div>
              <span class="font-bold text-xs ${t.type === 'expense' ? 'text-rose-600' : (t.type === 'transfer' ? 'text-blue-600' : 'text-emerald-600')} shrink-0">
                ${formatCurrency(t.amount)}
              </span>
            </div>
          `).join('') + (newRows.length > 50 ? `<div class="text-center text-[10px] text-slate-400 pt-1">... dan ${newRows.length - 50} data baru lainnya.</div>` : '');
        }
      }

      openModal('import-tx-preview-modal');
      lucide.createIcons();
    } catch (err) {
      alert('Gagal memproses file Excel. Pastikan format kolom sesuai.');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}
	
	function executeConfirmedTxImport() {
  if (!pendingTxImportList || pendingTxImportList.length === 0) {
    closeModal('import-tx-preview-modal');
    return;
  }

  // Masukkan hanya transaksi baru yang lolos sortir duplikat
  pendingTxImportList.forEach(t => {
    transactions.unshift({
      id: t.id,
      date: t.date,
      type: t.type,
      accountId: t.accountId,
      toAccountId: t.toAccountId,
      categoryId: t.categoryId,
      subcategory: t.subcategory,
      amount: t.amount,
      adminFee: t.adminFee,
      note: t.note
    });
  });

  const count = pendingTxImportList.length;
  pendingTxImportList = [];

  persistState(true);
  renderAll();
  closeModal('import-tx-preview-modal');
  alert(`Berhasil mengimpor ${count} transaksi baru. Seluruh data duplikat berhasil dilewati!`);
}

function exportCategoriesToExcel() {
  const headers = ['Nama Kategori', 'Tipe', 'Klasifikasi Arus', 'Subkategori'];
  const aoa = [headers];

  categories.forEach(c => {
    let classLabel = 'Dinamis';
    if (c.expenseClass === 'fixed') classLabel = 'Tetap';
    else if (c.expenseClass === 'periodic') classLabel = 'Berkala';

    const subs = (c.subcategories && c.subcategories.length > 0) ? c.subcategories : ['-'];

    subs.forEach(sub => {
      aoa.push([
        c.name,
        c.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        classLabel,
        sub
      ]);
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  applyWorksheetStyling(worksheet, aoa, {
    headerRows: new Set([0]),
    headerFill: '059669',
    centerCols: new Set([1, 2]),
    colCount: 4,
    minColWidths: { 0: 24, 1: 15, 2: 18, 3: 28 }
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar_Kategori");
  XLSX.writeFile(workbook, `Kategori_Keuangan_${getLocalDateStr()}.xlsx`);
}

// ==================== 2. IMPOR KATEGORI: ANTI-DUPLIKAT & PRATINJAU ====================
let pendingCatImportPlan = { newCategories: [], newSubcategories: [], duplicateCount: 0 };

function importCategoriesFromExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet);

      if (rows.length === 0) {
        alert('File Excel kategori kosong.');
        return;
      }

      const newCategories = [];
      const newSubcategories = [];
      let duplicateCount = 0;

      rows.forEach(r => {
        const name = (r['Nama Kategori'] || r.Kategori || r.Category || '').toString().trim();
        if (name) {
          const rawType = (r['Tipe'] || r.Type || 'expense').toString().toLowerCase();
          const type = (rawType.includes('masuk') || rawType.includes('income')) ? 'income' : 'expense';

          const rawClass = (r['Klasifikasi Arus'] || r.Klasifikasi || r.Class || 'dynamic').toString().toLowerCase();
          let expenseClass = 'dynamic';
          if (rawClass.includes('tetap') || rawClass.includes('fixed')) expenseClass = 'fixed';
          else if (rawClass.includes('berkala') || rawClass.includes('periodic')) expenseClass = 'periodic';

          const subRaw = (r['Subkategori'] || r['Daftar Subkategori'] || r.Subcategories || '').toString().trim();
          const subList = (subRaw && subRaw !== '-') ? subRaw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [];

          let existing = categories.find(c => 
            c.name.toLowerCase() === name.toLowerCase() &&
            c.type.toLowerCase() === type.toLowerCase()
          );

          if (existing) {
            let addedSubCount = 0;
            subList.forEach(sub => {
              if (!existing.subcategories.some(s => s.toLowerCase() === sub.toLowerCase())) {
                newSubcategories.push({ catName: existing.name, subName: sub });
                addedSubCount++;
              } else {
                duplicateCount++;
              }
            });
            if (subList.length === 0 || addedSubCount === 0) {
              duplicateCount++;
            }
          } else {
            newCategories.push({
              name,
              type,
              expenseClass,
              subcategories: subList
            });
          }
        }
      });

      pendingCatImportPlan = { newCategories, newSubcategories, duplicateCount };

      setText('preview-cat-new', newCategories.length);
      setText('preview-sub-new', newSubcategories.length);
      setText('preview-cat-duplicate', duplicateCount);

      const listEl = document.getElementById('preview-cat-list');
      if (listEl) {
        if (newCategories.length === 0 && newSubcategories.length === 0) {
          listEl.innerHTML = `<div class="py-8 text-center text-slate-400 italic">Semua kategori & subkategori di file ini sudah terdaftar. Tidak ada penambahan.</div>`;
          document.getElementById('btn-confirm-import-cat').disabled = true;
        } else {
          document.getElementById('btn-confirm-import-cat').disabled = false;
          let html = '';
          newCategories.forEach(c => {
            html += `
              <div class="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <span class="font-bold text-emerald-950 block">+ Kategori Baru: ${escapeHtml(c.name)} (${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})</span>
                <span class="text-[10px] text-emerald-700">${c.subcategories.length > 0 ? `Sub: ${c.subcategories.join(', ')}` : 'Tanpa subkategori awal'}</span>
              </div>
            `;
          });
          newSubcategories.forEach(s => {
            html += `
              <div class="p-2 rounded-xl bg-blue-50 border border-blue-200">
                <span class="font-bold text-blue-950 block">+ Subkategori Baru: ${escapeHtml(s.subName)}</span>
                <span class="text-[10px] text-blue-700">Ditambahkan ke kategori: ${escapeHtml(s.catName)}</span>
              </div>
            `;
          });
          listEl.innerHTML = html;
        }
      }

      openModal('import-cat-preview-modal');
      lucide.createIcons();
    } catch (err) {
      alert('Gagal membaca file Excel kategori.');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}
	
	function executeConfirmedCatImport() {
  const { newCategories, newSubcategories } = pendingCatImportPlan;

  // 1. Tambah kategori baru
  newCategories.forEach(c => {
    categories.push({
      id: 'cat-' + Date.now() + Math.random().toString().slice(2, 6),
      name: toSmartTitleCase(c.name),
      type: c.type,
      expenseClass: c.expenseClass,
      subcategories: c.subcategories.map(s => toSmartTitleCase(s)).sort((a, b) => a.localeCompare(b, 'id'))
    });
  });

  // 2. Tambah subkategori baru ke kategori yang sudah ada
  newSubcategories.forEach(s => {
    const cat = categories.find(c => c.name.toLowerCase() === s.catName.toLowerCase());
    if (cat) {
      cat.subcategories.push(toSmartTitleCase(s.subName));
      cat.subcategories.sort((a, b) => a.localeCompare(b, 'id'));
    }
  });

  const totalAdded = newCategories.length + newSubcategories.length;
  pendingCatImportPlan = { newCategories: [], newSubcategories: [], duplicateCount: 0 };

  persistState(true);
  renderAll();
  closeModal('import-cat-preview-modal');
  alert(`Berhasil mengimpor! ${totalAdded} item baru berhasil ditambahkan.`);
}

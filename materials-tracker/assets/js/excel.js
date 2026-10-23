/* قراءة ملفات Excel/CSV (SheetJS) وتصدير تقارير ملوّنة بتنسيق RTL (ExcelJS). */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;

  const COLORS = { ok: 'FF37E0C2', short: 'FFFFC53D', excess: 'FF4B57E8', none: 'FFFF6B5E' };
  const INK = 'FF151845';

  async function readMatrix(file) {
    const XLSX = await MT.Lib.load('xlsx');
    let wb;
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
      wb = XLSX.read(await file.text(), { type: 'string', cellDates: true });
    } else {
      wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, codepage: 1256 });
    }
    const name = wb.SheetNames[0];
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: false });
    return { matrix, sheetName: name, sheets: wb.SheetNames };
  }

  const safeName = (n) => String(n).replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || 'ورقة';

  function cellValue(col, row) {
    const v = col.get(row);
    if (col.kind === 'num' || col.kind === 'diff') return typeof v === 'number' ? v : v == null || v === '' ? null : Number(v);
    return v == null ? '' : String(v);
  }

  /** يبني مصنفًا من أوراق معرّفة: [{name,title,columns:[{h,w,get,kind,status}],rows}] */
  async function build(sheets, { project = '', author = 'Eng. Ahmed Zahran' } = {}) {
    const ExcelJS = await MT.Lib.load('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = author;
    wb.created = new Date();
    wb.title = 'متابعة صرف المواد من الكهرباء';
    const bc = { argb: 'FFC9CEEF' };
    const border = { top: { style: 'thin', color: bc }, left: { style: 'thin', color: bc }, bottom: { style: 'thin', color: bc }, right: { style: 'thin', color: bc } };
    const stamp = `${project ? project + '، ' : ''}${U.fmtDate(U.today())}`;

    sheets.forEach((sh) => {
      const ws = wb.addWorksheet(safeName(sh.name), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }], properties: { tabColor: { argb: 'FF4B57E8' } } });
      const n = sh.columns.length;
      ws.columns = sh.columns.map((c) => ({ width: c.w || 16 }));
      ws.mergeCells(1, 1, 1, n);
      ws.getCell(1, 1).value = sh.title;
      ws.getCell(1, 1).font = { bold: true, size: 15, name: 'Arial' };
      ws.getCell(1, 1).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getRow(1).height = 26;
      ws.mergeCells(2, 1, 2, n);
      ws.getCell(2, 1).value = stamp;
      ws.getCell(2, 1).font = { color: { argb: 'FF5E574D' }, size: 11, name: 'Arial' };
      ws.getCell(2, 1).alignment = { horizontal: 'right' };

      const head = ws.getRow(4);
      sh.columns.forEach((c, i) => {
        const cell = head.getCell(i + 1);
        cell.value = c.h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = border;
      });
      head.height = 24;

      sh.rows.forEach((r, ri) => {
        const row = ws.getRow(5 + ri);
        sh.columns.forEach((c, i) => {
          const cell = row.getCell(i + 1);
          const v = cellValue(c, r);
          cell.value = v;
          cell.border = border;
          cell.font = { name: c.kind === 'code' ? 'Consolas' : 'Arial', size: 11 };
          cell.alignment = { vertical: 'middle', horizontal: c.kind === 'num' || c.kind === 'diff' || c.kind === 'code' ? 'center' : c.kind === 'status' ? 'center' : 'right', wrapText: c.kind === 'text' };
          if (c.kind === 'code') cell.numFmt = '@';
          if (c.kind === 'num') cell.numFmt = '#,##0.###';
          if (c.kind === 'diff') {
            cell.numFmt = '+#,##0.###;-#,##0.###;0';
            if (typeof v === 'number' && v < 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE9A8' } };
            if (typeof v === 'number' && v > 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCDFFF' } };
          }
          if (c.kind === 'status') {
            const key = c.status ? c.status(r) : null;
            if (COLORS[key]) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[key] } };
              cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: key === 'excess' ? 'FFFFFFFF' : INK } };
            }
          }
        });
      });

      const last = 4 + sh.rows.length;
      if (sh.rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };
      const footRow = last + 2;
      ws.mergeCells(footRow, 1, footRow, n);
      ws.getCell(footRow, 1).value = U.PM_LINE;
      ws.getCell(footRow, 1).font = { italic: true, bold: true, color: { argb: 'FF5E574D' }, name: 'Arial' };
      ws.getCell(footRow, 1).alignment = { horizontal: 'center' };
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      ws.headerFooter.oddFooter = `&C${U.PM_LINE}&R&P / &N`;
    });
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  async function save(sheets, filename, opts) {
    const blob = await build(sheets, opts);
    MT.UI.download(blob, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
    return blob;
  }

  MT.Excel = { readMatrix, build, save, COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.Excel;
})(typeof window !== 'undefined' ? window : globalThis);

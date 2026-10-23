/* تحميل المكتبات الخارجية عند الحاجة فقط (من CDN بإصدارات محددة) */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const LIBS = {
    xlsx: { src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', global: 'XLSX', name: 'قراءة Excel' },
    exceljs: { src: 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', global: 'ExcelJS', name: 'تصدير Excel' },
    pdfjs: { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', global: 'pdfjsLib', name: 'قراءة PDF', worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' },
    tesseract: { src: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', global: 'Tesseract', name: 'قراءة الصور' },
    supabase: { src: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js', global: 'supabase', name: 'قاعدة البيانات' },
  };
  const pending = {};

  function load(key) {
    const lib = LIBS[key];
    if (!lib) return Promise.reject(new Error('مكتبة غير معروفة: ' + key));
    if (g[lib.global]) return Promise.resolve(g[lib.global]);
    if (pending[key]) return pending[key];
    pending[key] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = lib.src;
      s.async = true;
      s.onload = () => (g[lib.global] ? resolve(g[lib.global]) : reject(new Error('تعذّر تهيئة مكتبة ' + lib.name)));
      s.onerror = () => {
        delete pending[key];
        reject(new Error(`تعذّر تحميل مكتبة ${lib.name}. تأكد من الاتصال بالإنترنت ثم حاول مرة أخرى.`));
      };
      document.head.appendChild(s);
    });
    return pending[key];
  }

  MT.Lib = { load, LIBS };
})(typeof window !== 'undefined' ? window : globalThis);

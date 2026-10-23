#!/usr/bin/env python3
"""يحوّل ملف إكسل الكتالوج (ورقة نجران) إلى assets/js/catalog-data.js

الاستخدام:
    python3 tools/build-catalog.py "مسار/الملف.xlsx" ["اسم يظهر في الشاشة"]

الأعمدة المتوقعة: No | Description | SEC # | Unit | Unit Price
تُستبعد الأسعار عمدًا: الموقع ملفات ثابتة قابلة للقراءة لمن يملك الرابط.
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

CATEGORY_AR = {
    "LOW VOLTAGE CABLES": "كابلات الجهد المنخفض",
    "MEDIUM VOLTAGE CABLES": "كابلات الجهد المتوسط",
    "LV OVERHEAD LINE CONDUCTORS(QUADRUPLEX)": "موصلات هوائية جهد منخفض (كوادروبلكس)",
    "13.8 & 33 KV OVERHEAD LINE CONDUCTORS": "موصلات هوائية 13.8 و33 ك.ف",
    "LV CABLE JOINTS & TERMINATIONS": "وصلات ونهايات كابلات الجهد المنخفض",
    "MV CABLE JOINTS & TERMINATIONS": "وصلات ونهايات كابلات الجهد المتوسط",
    "JOINTS & TERMINATIONS ACCESSORIES": "ملحقات الوصلات والنهايات",
    "DISTRIBUTION TRANSFORMERS": "محولات التوزيع",
    "UNIT SUBSTATIONS": "محطات الوحدة",
    "SF6 RING MAIN UNIT (13.8 KV)": "وحدات الحلقة SF6 (13.8 ك.ف)",
    "SF6 RING MAIN UNIT (33 KV)": "وحدات الحلقة SF6 (33 ك.ف)",
    "METERED RING MAIN UNIT": "وحدات حلقة بعدادات",
    "METAL OXIDE SURGE ARRESTERS": "مانعات صواعق أكسيد المعدن",
    "LV DITRIBUTION PILLAR": "أعمدة توزيع الجهد المنخفض (بيلر)",
    "LV DISTRIBUTION PANELS": "لوحات توزيع الجهد المنخفض",
    "OVERHEAD PORCELAIN INSULATORS": "عوازل خزفية هوائية",
    "OCTAGONAL STEEL POLES": "أعمدة فولاذية ثمانية الأضلاع",
    "BOTTOM CONNECTED KILO-WATT-HOUR METERS": "عدادات كيلوواط ساعة (توصيل سفلي)",
    "FIBERGLASS REINFORCED POLYESTER METER BOX": "صناديق عدادات فايبرجلاس",
    "CURRENT TRANSFORMERS": "محولات التيار",
    "LV MOULDED CASE CIRCUIT BREAKERS": "قواطع علبة مصبوبة للجهد المنخفض",
    "MV DROPOUT FUSE CUT OUTS": "قواطع فيوز ساقطة للجهد المتوسط",
    "MV DROPOUT FUSE CUT OUTS ACCESSORIES": "ملحقات القواطع الساقطة",
    "LOAD BREAK SWITCH": "مفاتيح فصل الحمل",
    "AUTO RECLOSERS": "معيدات الإغلاق الآلية",
    "AUTOMATIC LINE SECTIONLIOZER": "مقسّمات الخط الآلية",
    "OVERHEAD LINES ACCESSORIES": "ملحقات الخطوط الهوائية",
    "LV CABINET FOR POLE MOUNTED TRANSFORMER": "خزانة جهد منخفض لمحول معلّق",
    "VOLTAGE REGULATOR": "منظم الجهد",
    "CAPACITOR BANK": "بنك المكثفات",
    "MV LINE COVER": "أغطية خطوط الجهد المتوسط",
    "EARTHING CONDUCTORS": "موصلات التأريض",
    "PAD AND CYLENRICAL LOCKS": "أقفال حلقية وأسطوانية",
    "BYPASS/DISCONNECT SWITCH": "مفاتيح تجاوز وفصل",
    "CONTROL CABLE": "كابلات التحكم",
    "LV CABINET": "خزائن الجهد المنخفض",
    "TRANSFORMER INSULATING OIL": "زيت عزل المحولات",
    "EARTH FAULT INDICATOR": "مؤشر عطل أرضي",
    "DIGITAL PANEL METER": "عداد لوحة رقمي",
    "POLYMERIC INSULATORS": "عوازل بوليمرية",
    "SPACERS": "فواصل (Spacers)",
}


def clean(text):
    text = str(text or "").replace("`", "").strip()
    return re.sub(r"\s{2,}", " ", text)


def main(path, label=None):
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    cats, items, skipped, seen = [], [], [], set()
    cat_index = {}
    current = None
    for row_no, row in enumerate(ws.iter_rows(values_only=True), 1):
        _, no, desc, code, unit, *_ = (list(row) + [None] * 6)[:7]
        if isinstance(no, str) and desc is None and code is None:
            if no.strip().lower() == "no":
                continue
            current = no.strip()
            if current not in cat_index and current != "نجران":
                cat_index[current] = len(cats)
                cats.append([current, CATEGORY_AR.get(current, current)])
            continue
        if code is None:
            continue
        code = str(code).strip()
        if str(no).strip().lower() == "no" or code.upper().startswith("SEC"):
            continue
        if not re.fullmatch(r"\d{9}", code):
            skipped.append((row_no, code, clean(desc)))
            continue
        if code in seen:
            skipped.append((row_no, code, "مكرر"))
            continue
        seen.add(code)
        items.append([code, clean(desc), str(unit or "EA").strip(), cat_index.get(current, -1)])

    out = Path(__file__).resolve().parent.parent / "assets" / "js" / "catalog-data.js"
    payload = {"source": label or Path(path).name, "count": len(items), "cats": cats, "items": items}
    out.write_text(
        "/* مولَّد من tools/build-catalog.py، لا تعدّله يدويًا */\n"
        "window.MT_CATALOG = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"تم: {len(items)} صنف في {len(cats)} قسم → {out}")
    for r in skipped:
        print(f"  تنبيه سطر {r[0]}: رقم المادة '{r[1]}' غير صالح أو مكرر ({r[2][:60]})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)

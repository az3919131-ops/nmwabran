import {
  authorityFor, boqCalc, dashSummary, deckStats, feeders, firmStats, geoPoints, invoiceCalc, invoiceSheets, makeT, moneyOf, nfWith, projectSheets, projState, protectionRows, acceptanceRows,
  qtySheet, revisionSheet, ROLES, STATES, totals, wagesCalc, withSignature, type Lang, type ReportKey, type Role, type SheetRows,
} from "@iltizam/core";
import type { ReportData } from "./data";

export interface Kpi { k: string; v: string; d?: string }
const nf = nfWith, money = moneyOf;

/** 4–6 أرقام رئيسية لكل صفحة — تظهر في جسم البريد */
export function kpisFor(key: ReportKey, d: ReportData): Kpi[] {
  const T = makeT(d.lang), cat = d.cat, p = d.project;
  const need = () => { if (!p) throw new Error("مشروع مطلوب لهذا التقرير"); return p; };
  switch (key) {
    case "dash": {
      const s = dashSummary(d.mine, cat, d.lang);
      return [
        { k: T("القيمة التقديرية", "Estimated value"), v: money(s.tot.est), d: T("ريال", "SAR") },
        { k: T("المنفّذ (أجور)", "Executed works"), v: money(s.tot.exec), d: T("من مقايسة ", "of BOQ ") + money(s.tot.plan) },
        { k: T("انحراف المقايسة", "BOQ variance"), v: (s.varPct > 0 ? "+" : "") + nf(s.varPct, 1) + "%", d: s.authority },
        { k: T("جاهزة للفاتورة", "Ready to invoice"), v: `${nf(s.counts.ready)} / ${nf(d.mine.length)}` },
        { k: T("تغطية الإحداثيات", "Coordinate coverage"), v: nf(s.geoCov) + "%" },
        { k: T("تحتاج إجراء", "Need action"), v: nf(s.needAction), d: T("مشروع ناقص بيانات", "projects missing data") },
      ];
    }
    case "firms": {
      const tot = d.all.reduce((a, x) => { const s = firmStats([x], cat); a.est += s.est; a.exec += s.exec; a.pts += s.pts; a.rmu += s.rmu; return a; }, { est: 0, exec: 0, pts: 0, rmu: 0 });
      return [
        { k: T("المقاولون", "Contractors"), v: nf(d.contractors.filter((c) => d.all.some((x) => x.contractorId === c.id)).length) },
        { k: T("المشاريع", "Projects"), v: nf(d.all.length) },
        { k: T("القيمة التقديرية", "Estimated value"), v: money(tot.est), d: "SAR" },
        { k: T("المنفّذ (أجور)", "Executed works"), v: money(tot.exec), d: "SAR" },
        { k: T("وحدات RMU", "RMU units"), v: nf(tot.rmu) },
        { k: T("نقاط الإحداثيات", "Geo points"), v: nf(tot.pts) },
      ];
    }
    case "master": {
      const pp = need(), t = totals(pp), c = pp.derived?.cost;
      return [
        { k: T("وحدات حلقية RMU", "Ring main units"), v: nf(t.rmuNew), d: `${nf(t.rmu3w)} × 3W · ${nf(t.rmu4w)} × 4W` },
        { k: T("محطات وحدة", "Unit substations"), v: nf(t.trTot) },
        { k: T("كابل ج.متوسط 3×400 (م)", "MV cable 3×400 (m)"), v: nf(t.htCable) },
        { k: T("الحفريات (م.طولي)", "Trenching (m)"), v: nf(t.trench) },
        { k: T("التكلفة المستنبطة", "Derived total cost"), v: c ? money(c.total) : "—", d: T("ريال", "SAR") },
        { k: T("حالة الاستنباط", "Derivation"), v: pp.derived ? T("محصور", "Derived") : T("بانتظار الحصر", "Pending") },
      ];
    }
    case "qty": {
      const t = totals(need());
      return [
        { k: T("معدات أرضية", "Ground units"), v: nf(t.rmuNew + t.trTot), d: `${nf(t.rmuNew)} RMU + ${nf(t.trTot)} ${T("محطة", "subs")}` },
        { k: T("أطوال الكابلات (م)", "Cable length (m)"), v: nf(t.htCable + t.lt300 + t.lt185 + t.lt70 + t.mvSingle) },
        { k: T("إجمالي الحفريات (م)", "Total trench (m)"), v: nf(t.trench) },
        { k: T("سفلتة وكشط (م²)", "Asphalt & milling (m²)"), v: nf(t.asphalt + t.milling) },
        { k: T("أعمدة مُزالة", "Poles removed"), v: nf(t.poleSteel + t.poleWood) },
      ];
    }
    case "boq": {
      const b = boqCalc(need(), cat);
      return [
        { k: T("أجور المقايسة", "BOQ works"), v: money(b.planC), d: T("مخطط", "Planned") },
        { k: T("أجور المنفّذ", "Executed works"), v: money(b.execC), d: (b.execC > b.planC ? "+" : "") + money(b.execC - b.planC) },
        { k: T("أجور الكروكي", "Layout works"), v: need().derived ? money(b.derC) : "—" },
        { k: T("قيمة المصروف", "Issued value"), v: money(b.issC) },
        { k: T("قيمة المطلوب", "Required value"), v: money(b.reqC) },
        { k: T("فرق المواد", "Material gap"), v: money(b.reqC - b.issC), d: T("مطلوب − مصروف", "Required − issued") },
      ];
    }
    case "wages": {
      const w = wagesCalc(need(), cat);
      return [
        { k: T("صافي فاتورة الأجور", "Net wages invoice"), v: money(w.worksTotal), d: T("ريال", "SAR") },
        { k: T("قيمة المواد المطلوبة", "Required materials"), v: money(w.matReq), d: T("المصروف: ", "Issued: ") + money(w.matIss) },
        { k: T("التكاليف غير المباشرة", "Indirect costs"), v: money(w.ind), d: nf(need().factors.indirectPct, 1) + "%" },
        { k: T("إجمالي الاعتماد الحالي", "Current approval total"), v: money(w.curTotal) },
        { k: T("الفرق عن التقديرية", "Variance vs estimate"), v: (w.varPct > 0 ? "+" : "") + nf(w.varPct, 2) + "%" },
        { k: T("صاحب الصلاحية", "Approving authority"), v: authorityFor(w.varPct, d.lang) },
      ];
    }
    case "inv": {
      const c = invoiceCalc(need(), cat, d.lang);
      return [
        { k: T("إجمالي الأجور", "Works total"), v: money(c.wSum) },
        { k: T("إجمالي المواد", "Materials total"), v: money(c.mSum) },
        { k: T("الإجمالي قبل الخصومات", "Gross before deductions"), v: money(c.gross) },
        { k: T("المحتجز", "Retention"), v: "−" + money(c.ret), d: c.iv.retentionPct + "%" },
        { k: T("صافي المستحق", "Net payable"), v: money(c.net), d: T("ر.س", "SAR") },
      ];
    }
    case "forms": {
      const pp = need(), set = pp.rmus.filter((r) => r.set).length, hi = pp.rmus.filter((r) => +r.ohm > 3).length;
      return [
        { k: T("وحدات حلقية", "Ring main units"), v: nf(pp.rmus.length) },
        { k: T("ضبط الحماية مكتمل", "Protection set"), v: `${nf(set)} / ${nf(pp.rmus.length)}` },
        { k: T("تأريض يتجاوز 3 Ω", "Earth above 3 Ω"), v: nf(hi) },
        { k: T("وحدات بإحداثيات", "Geo-referenced"), v: nf(pp.rmus.filter((r) => r.gps).length) },
      ];
    }
    case "map": {
      const pp = need(), pts = geoPoints(pp), fs = feeders(pts).filter((f) => !f.noRoute), route = fs.reduce((a, f) => a + f.len, 0), t = totals(pp);
      return [
        { k: T("نقاط بإحداثيات", "Geo-referenced points"), v: nf(pts.length), d: T("من ", "of ") + nf(pp.rmus.length) },
        ...fs.slice(0, 2).map((f) => ({ k: T("مسار المغذي ", "Feeder route ") + f.name, v: nf(f.len) + " m", d: nf(f.pts.length) + " " + T("نقطة", "pts") })),
        { k: T("كابل الحصر ÷ طول المسار", "Takeoff cable ÷ route"), v: route ? nf(t.htCable / route, 2) + "×" : "—" },
      ];
    }
    case "recs": {
      const pp = need(), s = projState(pp, cat);
      return [
        { k: T("حالة المشروع", "Project state"), v: T(STATES[s.k].ar, STATES[s.k].en) },
        { k: T("مجموعات المستندات", "Document groups"), v: "6" },
        { k: T("مستندات متوقعة", "Expected documents"), v: "27" },
        { k: T("ضبط الحماية", "Protection settings"), v: `${nf(s.set)} / ${nf(s.rmus)}` },
      ];
    }
    case "deck": {
      const s = deckStats(need(), cat);
      return [
        { k: T("المقايسة التقديرية", "Estimated BOQ"), v: money(s.est) },
        { k: T("الاعتماد الحالي المطلوب", "Current approval sought"), v: money(s.cur) },
        { k: T("فرق المقايسة", "BOQ variance"), v: (s.varPct > 0 ? "+" : "") + nf(s.varPct, 1) + "%", d: authorityFor(s.varPct, d.lang) },
        { k: T("عجز المواد", "Material shortfall"), v: money(s.matReq - s.matIss) },
        { k: T("ضبط الحماية", "Protection settings"), v: `${nf(s.setDone)} / ${nf(need().rmus.length)}` },
        { k: T("وحدات تأريضها > 3Ω", "Units above 3 Ω"), v: nf(s.highOhm) },
      ];
    }
    case "emails": {
      const act = d.recipients.filter((r) => r.active).length;
      const last = d.sendLog.find((l) => l.sentAt);
      return [
        { k: T("عدد المستلمين", "Recipients"), v: nf(d.recipients.length) },
        { k: T("النشطون", "Active"), v: nf(act) },
        { k: T("آخر إرسال", "Last send"), v: last?.sentAt ? last.sentAt.toISOString().slice(0, 16).replace("T", " ") : "—" },
        { k: T("عمليات الإرسال المسجّلة", "Logged sends"), v: nf(d.sendLog.length) },
      ];
    }
    case "users":
      return [
        { k: T("المستخدمون", "Users"), v: nf(d.users.length), d: nf(d.users.filter((u) => u.active).length) + " " + T("نشط", "active") },
        { k: T("مدراء النظام", "Administrators"), v: nf(d.users.filter((u) => u.role === "admin").length) },
        { k: T("أحداث مسجّلة", "Logged events"), v: nf(d.auditCount) },
      ];
  }
}

/** أوراق الإكسل لكل تقرير (null = لا إكسل لهذه الصفحة) */
export function sheetsFor(key: ReportKey, d: ReportData): SheetRows | null {
  const lang = d.lang, T = makeT(lang), cat = d.cat, p = d.project;
  const need = () => { if (!p) throw new Error("مشروع مطلوب لهذا التقرير"); return p; };
  const kpiSheet = (): [string, (string | number)[][]] => [T("المقاييس", "Metrics"), [[T("المقياس", "Metric"), T("القيمة", "Value"), T("ملاحظة", "Note")], ...kpisFor(key, d).map((k) => [k.k, k.v, k.d ?? ""])]];
  let out: SheetRows | null;
  switch (key) {
    case "dash": {
      const s = dashSummary(d.mine, cat, lang);
      const rows: (string | number)[][] = [[T("المشروع", "Project"), T("أمر العمل", "W/O"), T("الموقع", "Site"), T("الحالة", "State"), T("الحصر %", "Takeoff %"), T("ضبط الحماية %", "Settings %"), T("المنفّذ من المقايسة %", "Executed of BOQ %"), T("إحداثيات", "Geo"), T("التقديرية", "Estimated")],
        ...d.mine.map((x, i) => [x.name, x.wo, x.site, T(STATES[s.st[i].k].ar, STATES[s.st[i].k].en), s.st[i].derived ? 100 : 0, Math.round(s.st[i].setPct), Math.round(Math.min(s.st[i].bill, 100)), s.st[i].pts, Math.round(s.st[i].est)])];
      out = [[T("المشاريع", "Projects"), rows], kpiSheet()]; break;
    }
    case "firms": {
      const cmp: (string | number)[][] = [[T("المقاول", "Contractor"), T("مشاريع", "Projects"), T("محصورة", "Derived"), "RMU", T("محطات", "Unit subs"), T("كابل ج.م (م)", "MV cable (m)"), T("إحداثيات", "Geo pts"), T("التقديرية", "Estimated"), T("المنفّذ", "Executed"), T("انحراف %", "Variance %"), T("مرفقات", "Files")]];
      for (const c of d.contractors) {
        const list = d.all.filter((x) => x.contractorId === c.id); if (!list.length) continue;
        const s = firmStats(list, cat);
        cmp.push([c.name, s.n, s.derived, s.rmu, s.tr, Math.round(s.mv), s.pts, Math.round(s.est), Math.round(s.exec), s.plan ? +(((s.exec - s.plan) / s.plan) * 100).toFixed(1) : 0, s.files]);
      }
      const proj: (string | number)[][] = [[T("المقاول", "Contractor"), T("المشروع", "Project"), T("أمر العمل", "W/O"), T("الموقع", "Site"), T("لوحات", "Sheets"), "RMU", T("إحداثيات", "Geo"), T("التقديرية", "Estimated"), T("المنفّذ", "Executed"), T("الحالة", "State")],
        ...d.all.map((x) => { const s = firmStats([x], cat); return [d.contractors.find((c) => c.id === x.contractorId)?.name ?? "", x.name, x.wo, x.site, x.sheets.length, s.rmus, s.pts, Math.round(s.est), Math.round(s.exec), x.derived ? T("محصور", "Derived") : T("بانتظار", "Pending")]; })];
      out = [[T("مقارنة", "Comparison"), cmp], [T("مشاريع", "Projects"), proj]]; break;
    }
    case "master": { const s = projectSheets(need(), cat, lang); out = [s[0], s[1]]; break; }
    case "qty": out = qtySheet(need(), cat, lang); break;
    case "boq": { const s = projectSheets(need(), cat, lang); out = [s[2], s[3]]; break; }
    case "wages": { const s = projectSheets(need(), cat, lang); out = [s[4], ...revisionSheet(need(), cat, lang, d.contractorName)]; break; }
    case "inv": {
      const c = invoiceCalc(need(), cat, lang);
      void c;
      out = null; // يُبنى في reports/service عبر invoiceSheets (يحتاج اسم المقاول)
      break;
    }
    case "forms": out = [[T("ضبط الحماية", "Protection"), protectionRows(need(), lang)], [T("الاستلام", "Acceptance"), acceptanceRows(need(), lang)]]; break;
    case "map": {
      const pts = geoPoints(need());
      const rows: (string | number)[][] = [[T("الوحدة", "Unit"), T("المغذي", "Feeder"), T("النوع", "Type"), "Lat", "Lon", "E (m)", "N (m)", T("من السابقة (م)", "From prev. (m)")]];
      feeders(pts).forEach((f) => f.pts.forEach((q) => rows.push([q.id, f.name, q.type + (q.hasTR ? " + TR" : ""), +q.lat.toFixed(6), +q.lon.toFixed(6), +q.E.toFixed(2), +q.N.toFixed(2), q.seg ? Math.round(q.seg) : 0])));
      out = [[T("إحداثيات", "Coordinates"), rows]]; break;
    }
    case "emails": {
      const rec: (string | number)[][] = [[T("البريد", "Email"), T("الاسم", "Name"), T("الجهة", "Role"), T("الحالة", "Status"), T("مستلم إلزامي", "Mandatory")],
        ...d.recipients.map((r) => [r.email, r.name, r.roleLabel, r.active ? T("نشط", "Active") : T("معطّل", "Inactive"), r.isSystem ? T("نعم", "Yes") : ""])];
      const log: (string | number)[][] = [[T("الوقت", "Time"), T("التقرير", "Report"), T("الحالة", "Status"), T("المستلمون", "Recipients"), T("الموضوع", "Subject")],
        ...d.sendLog.map((l) => [l.createdAt.toISOString().slice(0, 19).replace("T", " "), l.reportKey, l.status, Array.isArray(l.recipients) ? l.recipients.length : 0, l.subject])];
      out = [[T("المستلمون", "Recipients"), rec], [T("سجل الإرسال", "Send log"), log]]; break;
    }
    case "users": out = null; break;
    default: out = null;
  }
  void ROLES;
  return out ? withSignature(out, lang) : null;
}
export type { Role };

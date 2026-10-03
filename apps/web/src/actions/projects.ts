/** عمليات المقاولين والمشاريع عبر الـAPI (تقابل firmAdd/firmRename/... في المنصة القديمة) */
import { CF, CONTRACTORS, CONTRACTOR_IDS, S, T, esc, firmProjects, toast } from "../runtime";
import { del, patch, post } from "../api";
import { askOk, askText } from "../ui";
import { refreshContractors, reloadAllProjects, removeProject, replaceProject, save } from "../sync";
import { render } from "../render";
import { guardAct, safe } from "./common";
import { gaReset } from "../overlays/ga";

const goto = (id: string): void => { const i = S.projects.findIndex((p: any) => p.id === id); if (i >= 0) S.active = i; };

export async function createProject(name: string, wo: string, contractorIx: number, copyFromId?: string): Promise<any | undefined> {
  const dto = await safe(() => post("/projects", { name, wo, contractorId: CONTRACTOR_IDS[contractorIx], ...(copyFromId ? { copyFromId } : {}) }));
  if (!dto) return undefined;
  const p = replaceProject(dto);
  goto(p.id);
  return p;
}

/** المشروع الجديد يُنسب تلقائيًا للمقاول النشط */
export async function addProject(): Promise<void> {
  if (!guardAct("firms", "edit")) return;
  const i = CF(), n = firmProjects(i).length + 1;
  const p = await createProject(T("مشروع تحويل رقم ", "Conversion project ") + n, "", i);
  if (!p) return;
  S.page = "master"; save(); render();
  toast(T("أُضيف مشروع جديد للمقاول: ", "New project added for: ") + CONTRACTORS[i]);
}

export async function duplicateProject(ix: number): Promise<void> {
  if (!guardAct("firms", "edit")) return;
  const src = S.projects[ix]; if (!src) return;
  const p = await createProject(src.name + T(" (نسخة)", " (copy)"), src.wo || "", +src.contractor || 0, src.id);
  if (!p) return;
  save(); render(); toast(T("تم نسخ المشروع", "Project duplicated"));
}

export function deleteProject(ix: number, afterSidebar = false): void {
  if (!guardAct("firms", "del")) return;
  const pr = S.projects[ix]; if (!pr) return;
  if (S.projects.length <= 1) { toast(T("لا يمكن حذف المشروع الوحيد", "Cannot delete the only project")); return; }
  const f = +pr.contractor || 0;
  askOk(T("حذف المشروع", "Delete project"),
    afterSidebar
      ? T(`سيُحذف مشروع <b>${esc(pr.name)}</b> بكل بياناته ومرفقاته نهائيًا.`, `Project <b>${esc(pr.name)}</b> and all of its data will be permanently deleted.`)
      : T(`سيُحذف مشروع <b>${esc(pr.name)}</b> (أمر عمل ${esc(pr.wo || "—")}) بكل بياناته ومرفقاته نهائيًا.`, `Project <b>${esc(pr.name)}</b> (W/O ${esc(pr.wo || "—")}) and all of its data will be permanently deleted.`),
    async () => {
      const ok = await safe(() => del(`/projects/${pr.id}`));
      if (!ok) return;
      removeProject(pr.id);
      const mine = firmProjects(f);
      S.active = mine.length ? mine[0].ix : 0;
      gaReset(); save(); render(); toast(T("تم حذف المشروع", "Project deleted"));
    }, T("حذف نهائي", "Delete"));
}

/* ───────── المقاولون ───────── */
export function firmAdd(): void {
  if (!guardAct("firms", "edit")) return;
  askText(T("اسم المقاول الجديد", "New contractor name"), "", T("مثال: مؤسسة … للمقاولات الكهربائية", "e.g. … Electrical Contracting Est."), async (name) => {
    if (CONTRACTORS.some((c) => c.trim() === name)) { toast(T("هذا المقاول مسجّل بالفعل", "This contractor already exists")); return; }
    const row = await safe(() => post("/contractors", { name }));
    if (!row) return;
    await refreshContractors();
    const i = CONTRACTOR_IDS.indexOf(row.id);
    askOk(T("إنشاء أول مشروع", "Create the first project"),
      T(`تمت إضافة <b>${esc(name)}</b>. هل تنشئ له مشروعًا جديدًا الآن؟`, `<b>${esc(name)}</b> added. Create a project for them now?`),
      () => firmNewProject(i), T("نعم، أنشئ مشروعًا", "Yes, create a project"));
    render(); toast(T("تمت إضافة المقاول", "Contractor added"));
  });
}
export function firmRename(i: number): void {
  if (!guardAct("firms", "edit")) return;
  askText(T("تعديل اسم المقاول", "Rename contractor"), CONTRACTORS[i], "", async (name) => {
    const row = await safe(() => patch(`/contractors/${CONTRACTOR_IDS[i]}`, { name }));
    if (!row) return;
    await refreshContractors(); render(); toast(T("تم تحديث الاسم", "Name updated"));
  });
}
export function firmDelete(i: number): void {
  if (!guardAct("firms", "del")) return;
  if (CONTRACTORS.length <= 1) { toast(T("لا يمكن حذف المقاول الوحيد", "Cannot delete the only contractor")); return; }
  const list = firmProjects(i), to = i === 0 ? 1 : 0;
  askOk(T("حذف المقاول", "Delete contractor"),
    list.length
      ? T(`سيتم حذف <b>${esc(CONTRACTORS[i])}</b> ونقل <b>${list.length}</b> مشروعًا إلى <b>${esc(CONTRACTORS[to])}</b>. المشاريع لن تُحذف.`,
        `<b>${esc(CONTRACTORS[i])}</b> will be removed and their <b>${list.length}</b> project(s) moved to <b>${esc(CONTRACTORS[to])}</b>. No project is deleted.`)
      : T(`سيتم حذف <b>${esc(CONTRACTORS[i])}</b> (لا توجد له مشاريع).`, `<b>${esc(CONTRACTORS[i])}</b> will be removed (no projects).`),
    async () => {
      const ok = await safe(() => del(`/contractors/${CONTRACTOR_IDS[i]}?moveTo=${CONTRACTOR_IDS[to]}`));
      if (!ok) return;
      await refreshContractors(); await reloadAllProjects();
      render(); toast(T("تم حذف المقاول", "Contractor deleted"));
    }, T("حذف", "Delete"));
}
export function firmNewProject(i: number): void {
  if (!guardAct("firms", "edit")) return;
  askText(T("اسم المشروع الجديد", "New project name"), "", T("مثال: مشروع تحويل حي …", "e.g. … district conversion"), (name) => {
    askText(T("رقم أمر العمل", "Work order number"), "", "2340xxxxx", async (wo) => {
      const p = await createProject(name, wo, i);
      if (!p) return;
      S.page = "master"; save(); render();
      toast(T("تم إنشاء المشروع — ارفع الكروكي والملفات", "Project created — upload the layout and files"));
    });
  });
}
export function firmOpen(ix: number, page?: string): void { S.active = ix; if (page) S.page = page; save(); render(); }

/** نقل مشروع: يبقى العرض على المقاول الحالي ولا يتسرّب المشروع المنقول */
export async function firmMove(ix: number, to: number): Promise<void> {
  if (!guardAct("firms", "edit")) return;
  const pr = S.projects[ix]; if (!pr) return;
  const was = S.active === ix, from = +pr.contractor || 0;
  const dto = await safe(() => post(`/projects/${pr.id}/move`, { contractorId: CONTRACTOR_IDS[to] }));
  if (!dto) return;
  const p = replaceProject(dto);
  const nix = S.projects.findIndex((x: any) => x.id === p.id);
  if (was && from !== to) { const rest = firmProjects(from); S.active = rest.length ? rest[0].ix : nix; }
  gaReset(); save(); render();
  toast(T("تم نقل المشروع إلى ", "Project moved to ") + CONTRACTORS[to]);
}

/** الانتقال لمقاول: يعرض مشاريعه فقط — وإن لم تكن له مشاريع يعرض إنشاء أول مشروع */
export function firmGo(i: number): void {
  const list = firmProjects(i);
  gaReset();
  if (list.length) { S.active = list[0].ix; save(); render(); toast(T("عرض مشاريع: ", "Showing projects of: ") + CONTRACTORS[i]); return; }
  askOk(T("لا توجد مشاريع لهذا المقاول", "No projects for this contractor"),
    T(`المقاول <b>${esc(CONTRACTORS[i])}</b> ليس له أي مشروع بعد. هل تنشئ له مشروعًا الآن؟<br>
       <span style="color:var(--ink-3);font-size:11.5px">لن تُعرض مشاريع مقاول آخر تحت اسمه.</span>`,
      `<b>${esc(CONTRACTORS[i])}</b> has no projects yet. Create one now?<br>
       <span style="color:var(--ink-3);font-size:11.5px">No other contractor's projects are ever listed under this name.</span>`),
    () => firmNewProject(i), T("إنشاء مشروع", "Create project"));
  S.page = "firms"; save(); render();
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { aiProjBrief, firmStats } from "@iltizam/core";
import { asc } from "drizzle-orm";
import { contractors } from "../db/schema";
import { audit } from "../lib/audit";
import { HttpError } from "../lib/errors";
import { loadCatalog } from "../repo/catalog";
import { listProjects } from "../repo/projects";

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db;
  const r = app.withTypeProvider<ZodTypeProvider>();

  /** محفظة Ai — المساعد يقرأ بيانات المحفظة ويجيب (Claude API من الخادم؛ لا مفتاح في المتصفح) */
  r.post("/api/v1/ai/ask", {
    schema: {
      tags: ["ai"], summary: "اسأل محفظة Ai عن بيانات المحفظة",
      body: z.object({
        question: z.string().min(1).max(4000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12000) })).max(20).default([]),
        scope: z.enum(["firm", "one", "all"]).default("firm"), projectId: z.string().uuid().optional(), contractorId: z.string().uuid().optional(),
      }),
    },
    preHandler: app.requirePerm("ai", "view"), config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req) => {
    if (!ctx.ai.enabled) throw new HttpError(503, "المساعد الذكي غير مُهيّأ على الخادم — ضع ANTHROPIC_API_KEY في البيئة. كل الحسابات والتقارير تعمل بدونه.", "ai_disabled");
    const cat = await loadCatalog(db);
    const projects = await listProjects(db, cat, req.auth!.contractorIds); // العزل: لا يرى المساعد إلا ما يراه المستخدم
    const cs = (await db.select().from(contractors).orderBy(asc(contractors.sortOrder), asc(contractors.createdAt))).filter((c) => projects.some((p) => p.contractorId === c.id));
    const cur = projects.find((p) => p.id === req.body.projectId) ?? projects[0];
    const fid = req.body.contractorId ?? cur?.contractorId;
    const nameOf = (id: string) => cs.find((c) => c.id === id)?.name ?? "—";
    const firms = req.body.scope === "all" ? cs : cs.filter((c) => c.id === fid);
    const context: Record<string, unknown> = {
      المنصة: "محفظة الالتزام للمشاريع للمقاولين — حصر وإدارة مشاريع تحويل الشبكات الهوائية إلى أرضية بالشركة السعودية للكهرباء",
      نطاق_السؤال: req.body.scope === "all" ? "كل المقاولين في المحفظة" : req.body.scope === "one" ? "المشروع النشط فقط: " + (cur?.name ?? "") : "مشاريع المقاول المختار فقط: " + nameOf(fid ?? ""),
      المقاولون: firms.map((c) => { const st = firmStats(projects.filter((p) => p.contractorId === c.id), cat); return { الاسم: c.name, مشاريع: st.n, محصورة: st.derived, RMU: st.rmu, محطات: st.tr, كابل_ج_متوسط_م: Math.round(st.mv), نقاط_إحداثيات: st.pts, تقديرية: Math.round(st.est), منفّذ: Math.round(st.exec) }; }),
    };
    if (cur) context.المشروع_النشط = aiProjBrief(cur, cat, nameOf(cur.contractorId), true);
    if (req.body.scope !== "one") {
      const pool = req.body.scope === "all" ? projects : projects.filter((p) => p.contractorId === fid);
      const rest = pool.filter((p) => p.id !== cur?.id);
      if (rest.length) context.باقي_المشاريع = rest.map((p) => aiProjBrief(p, cat, nameOf(p.contractorId), false));
    }
    let text: string;
    try { text = await ctx.ai.ask({ question: req.body.question, history: req.body.history, context }); }
    catch (e: any) { throw new HttpError(502, "تعذّرت المعالجة الذكية: " + String(e?.message ?? e).slice(0, 200), "ai_error"); }
    await audit(req, "ai_ask", { detail: req.body.question.slice(0, 120) });
    return { answer: text };
  });
}

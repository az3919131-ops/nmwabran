import type { Hideable, ListKey, SiteContent } from "../data/content-types";

export type NavGroup = "about" | "services" | "experience" | "projects" | "platforms" | "presence" | "certifications" | "contact";
export type PlanEntry = { id: string; group: NavGroup };

const shown = (items: Hideable[]) => items.some((i) => !i.hidden);

/** الأقسام التي تُرسم فعلًا بالترتيب. في وضع التحرير تظهر كل الأقسام (حتى المخفية) ليتمكن صاحب الموقع من إدارتها. */
export function renderedSections(c: SiteContent, editing: boolean): PlanEntry[] {
  const out: PlanEntry[] = [];
  const add = (id: string, group: NavGroup) => out.push({ id, group });
  const addList = (key: ListKey, group: NavGroup) => {
    if (editing || (c.visibility[key] && shown(c[key] as unknown as Hideable[]))) add(key, group);
  };

  add("about", "about");
  addList("services", "services");
  add("experience", "experience");
  add("projects", "projects");
  addList("platforms", "platforms");
  addList("security", "platforms");
  addList("youtube", "presence");
  addList("linkedin", "presence");
  addList("pages", "presence");
  for (const s of c.custom) if (editing || (s.visible && shown(s.cards))) add(`custom-${s.id}`, "presence");
  add("certifications", "certifications");
  add("contact", "contact");
  return out;
}

/** عنصر تنقل واحد لكل مجموعة، يشير إلى أول قسم مرسوم فيها */
export function navItems(plan: PlanEntry[]): PlanEntry[] {
  const seen = new Set<NavGroup>();
  return plan.filter((e) => (seen.has(e.group) ? false : (seen.add(e.group), true)));
}

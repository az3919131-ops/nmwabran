import { Bot, Briefcase, Building2, GanttChartSquare, Globe, GraduationCap, LayoutTemplate, Link2, PlayCircle, ShieldCheck, Thermometer, Users, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { IconKey } from "../../data/content-types";

export const ICONS: Record<IconKey, LucideIcon> = {
  graduation: GraduationCap,
  building: Building2,
  shield: ShieldCheck,
  globe: Globe,
  layout: LayoutTemplate,
  wrench: Wrench,
  bolt: Zap,
  gantt: GanttChartSquare,
  mentor: Users,
  thermo: Thermometer,
  bot: Bot,
  briefcase: Briefcase,
  play: PlayCircle,
  link: Link2,
};

export function Icon({ name, className }: { name: IconKey; className?: string }) {
  const I = ICONS[name] ?? Globe;
  return <I className={className} aria-hidden />;
}

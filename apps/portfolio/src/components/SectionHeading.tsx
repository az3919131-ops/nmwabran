import type { ReactNode } from "react";

export function SectionHeading({ id, title, lead }: { id?: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mb-10 max-w-2xl">
      <h2 id={id} className="font-display text-3xl leading-tight text-white sm:text-4xl">
        {title}
      </h2>
      <div className="mt-3 h-0.5 w-14 rounded-full bg-gold-400" aria-hidden />
      {lead && <p className="mt-4 text-base text-slate-400 sm:text-lg">{lead}</p>}
    </div>
  );
}

import type { SVGProps } from "react";

/** شعار: صاعقة ذهبية داخل مربع كحلي */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="AZ" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#15213b" stroke="rgb(255 255 255 / 0.14)" />
      <path d="M36 9 18 36h12l-4 19 20-29H34z" fill="#f5c25b" />
    </svg>
  );
}

/** لينكدإن (الأيقونات التجارية غير متوفرة في lucide) */
export function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden {...props}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11.5H3V9.75Zm6.5 0h3.83v1.57h.06c.53-.95 1.84-1.95 3.78-1.95 4.04 0 4.78 2.66 4.78 6.1v5.78h-4v-5.12c0-1.22-.02-2.79-1.7-2.79-1.7 0-1.96 1.33-1.96 2.7v5.21h-4V9.75Z" />
    </svg>
  );
}

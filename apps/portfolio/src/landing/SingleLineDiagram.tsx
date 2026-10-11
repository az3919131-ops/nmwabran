import { motion, useReducedMotion } from "motion/react";

// مخطط أحادي الخط لمحطة 33/13.8 ك.ف: وارد ← قاطع ← محول ← قضبان ← مغذيات.
// هذا ما كان أحمد يرسمه ويختبره يوميًا، فصار رسم الواجهة. النبضات الذهبية = مرور التيار.
const FEEDERS = [110, 220, 340, 450];
const BUS_Y = 310;
const END_Y = 500;

export function SingleLineDiagram({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const draw = (delay: number) =>
    reduce
      ? { initial: false as const }
      : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 1, delay, ease: "easeOut" as const } };

  const line = "rgb(148 163 184 / 0.6)";
  const sym = "rgb(52 211 153 / 0.9)";
  const text = { fontFamily: "Inter, sans-serif", fontSize: 17, fill: "rgb(203 213 225 / 0.9)" };

  return (
    // اتجاه LTR دائمًا: الرموز والأرقام الهندسية لا تنعكس في الواجهة العربية
    <svg viewBox="0 0 560 540" className={className} fill="none" aria-hidden style={{ direction: "ltr" }}>
      {/* الوارد 33 ك.ف */}
      <motion.path d="M280 0V70" stroke={line} strokeWidth="2.5" {...draw(0)} />
      <rect x="271" y="70" width="18" height="18" rx="2" stroke={sym} strokeWidth="2.5" fill="#0f172a" />
      <motion.path d="M280 88V150" stroke={line} strokeWidth="2.5" {...draw(0.3)} />
      {/* المحول */}
      <circle cx="280" cy="172" r="22" stroke={sym} strokeWidth="2.5" />
      <circle cx="280" cy="200" r="22" stroke={sym} strokeWidth="2.5" />
      <motion.path d="M280 222V262" stroke={line} strokeWidth="2.5" {...draw(0.6)} />
      <rect x="271" y="262" width="18" height="18" rx="2" stroke={sym} strokeWidth="2.5" fill="#0f172a" />
      <motion.path d={`M280 280V${BUS_Y}`} stroke={line} strokeWidth="2.5" {...draw(0.8)} />
      {/* قضبان التوزيع 13.8 ك.ف */}
      <motion.path d={`M70 ${BUS_Y}H490`} stroke="rgb(245 194 91 / 0.9)" strokeWidth="6" strokeLinecap="round" {...draw(0.9)} />
      {/* المغذيات */}
      {FEEDERS.map((x, i) => (
        <g key={x}>
          <motion.path d={`M${x} ${BUS_Y}V${END_Y}`} stroke={line} strokeWidth="2.5" {...draw(1.1 + i * 0.12)} />
          <rect x={x - 9} y="360" width="18" height="18" rx="2" stroke={sym} strokeWidth="2.5" fill="#0f172a" />
          <path d={`M${x - 11} ${END_Y - 2}h22l-11 20z`} stroke={sym} strokeWidth="2.5" strokeLinejoin="round" />
          <text x={x} y="412" textAnchor="middle" {...text} fontSize={15}>
            F{i + 1}
          </text>
        </g>
      ))}
      <text x="302" y="40" {...text}>
        33 kV
      </text>
      <text x="312" y="182" {...text}>
        TR1
      </text>
      <text x="312" y="204" {...text} fontSize={14} fill="rgb(148 163 184 / 0.9)">
        33/13.8 kV
      </text>
      <text x="70" y="296" {...text} fill="rgb(245 194 91 / 0.95)">
        13.8 kV
      </text>

      {/* مرور التيار */}
      {!reduce && (
        <g fill="#f5c25b">
          <circle r="4.5" visibility="hidden">
            <set attributeName="visibility" to="visible" begin="2s" />
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="2s" path={`M280 0V${BUS_Y}`} />
          </circle>
          {FEEDERS.map((x, i) => (
            <circle key={x} r="4" visibility="hidden">
              <set attributeName="visibility" to="visible" begin={`${3.4 + i * 0.5}s`} />
              <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${3.4 + i * 0.5}s`} path={`M${x} ${BUS_Y}V${END_Y}`} />
            </circle>
          ))}
        </g>
      )}
    </svg>
  );
}

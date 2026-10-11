import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/** عدّاد يصعد من الصفر عند ظهوره؛ مع تفضيل تقليل الحركة يظهر الرقم النهائي فورًا */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setN(value);
      return;
    }
    const controls = animate(0, value, { duration: 1.6, ease: "easeOut", onUpdate: setN });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className="nums" dir="ltr">
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}

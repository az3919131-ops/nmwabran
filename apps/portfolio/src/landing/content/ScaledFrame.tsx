import { useEffect, useRef, useState } from "react";

const W = 1280;
const H = 720;

/** معاينة مصغّرة لموقع داخل بطاقة: إطار 1280×720 يُصغَّر ليملأ العرض، ويُحمَّل عند الاقتراب من الشاشة فقط. */
export function ScaledFrame({ url, title }: { url: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.1, el.clientWidth / W));
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setLoad(true), { rootMargin: "200px" }) : null;
    if (io) io.observe(el);
    else setLoad(true);
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={box} className="relative size-full overflow-hidden bg-navy-950" dir="ltr">
      {load && (
        <iframe
          title={title}
          src={url}
          width={W}
          height={H}
          loading="lazy"
          tabIndex={-1}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms"
          style={{ transform: `scale(${scale})`, transformOrigin: "top left", border: 0, pointerEvents: "none", position: "absolute", top: 0, left: 0 }}
        />
      )}
    </div>
  );
}

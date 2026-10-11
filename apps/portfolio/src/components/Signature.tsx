import { useLang } from "../i18n/lang";
import { signature } from "../config";

/** التوقيع المطلوب أسفل كل صفحة وكل عمل يُنشر من التطبيق */
export function Signature({ className = "" }: { className?: string }) {
  const { isAr } = useLang();
  return (
    <div className={`text-center ${className}`} data-testid="signature">
      <div className="mx-auto mb-3 h-px w-16 bg-gradient-to-r from-transparent via-gold-400 to-transparent" aria-hidden />
      <p className="font-semibold tracking-wide text-slate-200" dir="ltr" lang="en">
        {signature.en}
      </p>
      {isAr && <p className="text-sm text-slate-400">{signature.ar}</p>}
    </div>
  );
}

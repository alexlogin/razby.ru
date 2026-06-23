import { Sparkles } from "lucide-react";

export function RazbyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="Razby">
      <span className="brand-mark">
        <Sparkles size={18} strokeWidth={2.4} />
      </span>
      {!compact ? <span>Razby</span> : null}
    </span>
  );
}

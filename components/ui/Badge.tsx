import type { HTMLAttributes } from "react";

export type RagVariant = "on_track" | "at_risk" | "off_track" | "complete";

const RAG_STYLES: Record<RagVariant, { bg: string; text: string; label: string }> = {
  on_track: { bg: "var(--color-rag-green-bg)", text: "var(--color-rag-green-text)", label: "ON TRACK" },
  at_risk: { bg: "var(--color-rag-amber-bg)", text: "var(--color-rag-amber-text)", label: "AT RISK" },
  off_track: { bg: "var(--color-rag-red-bg)", text: "var(--color-rag-red-text)", label: "OFF TRACK" },
  complete: { bg: "var(--color-rag-green-bg)", text: "var(--color-rag-green-text)", label: "COMPLETE" },
};

export function Badge({
  variant,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant: RagVariant }) {
  const style = RAG_STYLES[variant];
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${className}`}
      style={{ background: style.bg, color: style.text }}
      {...props}
    >
      {style.label}
    </span>
  );
}

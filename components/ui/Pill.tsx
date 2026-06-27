import type { HTMLAttributes } from "react";

export type PillStatus = "not_started" | "in_progress" | "complete";

const PILL_STYLES: Record<PillStatus, { bg: string; text: string; label: string }> = {
  not_started: { bg: "#F0F2F5", text: "var(--color-text-secondary)", label: "Not Started" },
  in_progress: { bg: "#E8F0FE", text: "var(--color-primary)", label: "In Progress" },
  complete: { bg: "var(--color-rag-green-bg)", text: "var(--color-rag-green-text)", label: "✓ Done" },
};

export function Pill({
  status,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { status: PillStatus }) {
  const style = PILL_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ background: style.bg, color: style.text }}
      {...props}
    >
      {style.label}
    </span>
  );
}

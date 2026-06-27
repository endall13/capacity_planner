import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg p-4 ${className}`}
      style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)" }}
      {...props}
    />
  );
}

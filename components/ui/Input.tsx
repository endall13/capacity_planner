import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded px-3 py-2 text-sm outline-none focus:ring-2 ${className}`}
      style={{ border: "1px solid var(--color-border)" }}
      {...props}
    />
  );
}

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = "rounded px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60";
  const variants: Record<Variant, string> = {
    primary: "text-white",
    secondary: "",
    ghost: "bg-transparent",
  };
  const style =
    variant === "primary"
      ? { background: "var(--color-primary)" }
      : variant === "secondary"
        ? { border: "1px solid var(--color-border)", background: "var(--color-card-bg)" }
        : undefined;

  return <button className={`${base} ${variants[variant]} ${className}`} style={style} {...props} />;
}

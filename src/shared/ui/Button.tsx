import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "green" | "blue" | "red" | "yellow" | "white" | "gray";

// An exact copy of Duolingo's signature button: flat fill + a solid (not
// blurred) shadow at the bottom instead of an outline, which "presses in"
// on click — not a blurred shadow, and not just darkening on hover/active.
const VARIANTS: Record<Variant, { bg: string; shadow: string; text: string; border?: string }> = {
  green: { bg: "#58CC02", shadow: "#58A700", text: "#FFFFFF" },
  blue: { bg: "#1CB0F6", shadow: "#1899D6", text: "#FFFFFF" },
  red: { bg: "#FF4B4B", shadow: "#EA2B2B", text: "#FFFFFF" },
  yellow: { bg: "#FFC800", shadow: "#E5B400", text: "#4B4B4B" },
  white: { bg: "#FFFFFF", shadow: "#E5E5E5", text: "#3C3C3C", border: "#E5E5E5" },
  gray: { bg: "#E5E5E5", shadow: "#CCCCCC", text: "#AFAFAF", border: undefined },
};

export function DuoButton({
  variant = "green",
  children,
  className = "",
  size = "lg",
  ...props
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  size?: "lg" | "sm";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = VARIANTS[variant];
  const pad = size === "lg" ? "py-[15px]" : "py-[10px]";
  const text = size === "lg" ? "text-[15px]" : "text-[13px]";
  return (
    <button
      {...props}
      className={`duo-press w-full ${pad} rounded-2xl font-extrabold ${text} uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 ${className}`}
      style={{
        background: v.bg,
        color: v.text,
        border: v.border ? `2px solid ${v.border}` : "none",
        boxShadow: `0 4px 0 0 ${v.shadow}`,
      }}
    >
      {children}
    </button>
  );
}

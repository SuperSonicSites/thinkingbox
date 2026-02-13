import type { ReactNode } from "react";

export type BadgeVariant =
  | "confidence-high"
  | "confidence-medium"
  | "confidence-low"
  | "fibre"
  | "cable"
  | "wireless"
  | "satellite"
  | "lte"
  | "info"
  | "warning"
  | "mock";

export interface BadgeProps {
  variant: BadgeVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  "confidence-high": "bg-confidence-high-bg text-confidence-high",
  "confidence-medium": "bg-confidence-medium-bg text-confidence-medium",
  "confidence-low": "bg-confidence-low-bg text-confidence-low",
  fibre: "bg-blue-50 text-tech-fibre",
  cable: "bg-purple-50 text-tech-cable",
  wireless: "bg-orange-50 text-tech-fixed-wireless",
  satellite: "bg-slate-100 text-tech-satellite",
  lte: "bg-pink-50 text-tech-lte",
  info: "bg-primary-50 text-primary-600",
  warning: "bg-confidence-medium-bg text-confidence-medium",
  mock: "bg-surface-sunken text-text-muted border border-dashed border-border",
};

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  variant,
  size = "sm",
  icon,
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

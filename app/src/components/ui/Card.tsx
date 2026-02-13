import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "highlighted";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const variantClasses: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "border border-border bg-surface-raised shadow-card",
  raised: "border border-border-subtle bg-surface-raised shadow-card-hover",
  highlighted:
    "border-2 border-primary-300 bg-surface-raised shadow-card ring-1 ring-primary-100",
};

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

export function Card({
  variant = "default",
  hover = false,
  padding = "md",
  children,
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-lg transition-shadow duration-200",
        variantClasses[variant],
        paddingClasses[padding],
        hover
          ? "hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

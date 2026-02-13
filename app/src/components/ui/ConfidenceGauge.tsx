import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n/utils";
import type { ConfidenceLevel, Locale } from "@/types/index";

export interface ConfidenceGaugeProps {
  score: number;
  level: ConfidenceLevel;
  locale: Locale;
  showBreakdown?: boolean;
  className?: string;
}

const levelConfig: Record<
  ConfidenceLevel,
  { colorClass: string; bgClass: string; barClass: string }
> = {
  high: {
    colorClass: "text-confidence-high",
    bgClass: "bg-confidence-high-bg",
    barClass: "bg-confidence-high",
  },
  medium: {
    colorClass: "text-confidence-medium",
    bgClass: "bg-confidence-medium-bg",
    barClass: "bg-confidence-medium",
  },
  low: {
    colorClass: "text-confidence-low",
    bgClass: "bg-confidence-low-bg",
    barClass: "bg-confidence-low",
  },
};

function getZoneLabel(zone: ConfidenceLevel, locale: Locale): string {
  return t(locale, `results.confidence.${zone}`);
}

export function ConfidenceGauge({
  score,
  level,
  locale,
  showBreakdown = false,
  className = "",
}: ConfidenceGaugeProps) {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const config = levelConfig[level];
  const levelLabel = t(locale, `results.confidence.${level}`);

  // Build screen reader announcement from i18n
  const announcement = t(locale, "accessibility.confidence_announcement")
    .replace("{{level}}", levelLabel)
    .replace("{{score}}", String(clampedScore));

  useEffect(() => {
    if (hasAnimated.current) return;

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      setAnimatedWidth(clampedScore);
      hasAnimated.current = true;
      return;
    }

    // Animate fill when the gauge scrolls into view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          requestAnimationFrame(() => {
            setAnimatedWidth(clampedScore);
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (gaugeRef.current) {
      observer.observe(gaugeRef.current);
    }

    return () => observer.disconnect();
  }, [clampedScore]);

  return (
    <div
      ref={gaugeRef}
      className={["flex flex-col gap-3", className].filter(Boolean).join(" ")}
      role="meter"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={announcement}
    >
      {/* Score header */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text-secondary">
          {t(locale, "results.confidence.score_label")}
        </span>
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-bold ${config.colorClass}`}>
            {clampedScore}
          </span>
          <span className="text-sm text-text-muted">/ 100</span>
        </div>
      </div>

      {/* Segmented horizontal bar */}
      <div className="relative">
        {/* Background: three colored zones */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunken">
          {/* Low zone: 0-39 (39%) */}
          <div
            className="h-full bg-confidence-low/20"
            style={{ width: "39%" }}
            aria-hidden="true"
          />
          {/* Medium zone: 40-69 (30%) */}
          <div
            className="h-full bg-confidence-medium/20"
            style={{ width: "30%" }}
            aria-hidden="true"
          />
          {/* High zone: 70-100 (31%) */}
          <div
            className="h-full bg-confidence-high/20"
            style={{ width: "31%" }}
            aria-hidden="true"
          />
        </div>

        {/* Animated fill bar overlay */}
        <div
          className={[
            "absolute left-0 top-0 h-3 rounded-full",
            "transition-[width] duration-700 ease-out",
            "motion-reduce:transition-none",
            config.barClass,
          ].join(" ")}
          style={{ width: `${animatedWidth}%` }}
          aria-hidden="true"
        />

        {/* Zone labels beneath the bar */}
        {showBreakdown && (
          <div
            className="mt-1.5 flex text-[10px] text-text-muted"
            aria-hidden="true"
          >
            <span className="w-[39%] text-left">
              {getZoneLabel("low", locale)}
            </span>
            <span className="w-[30%] text-center">
              {getZoneLabel("medium", locale)}
            </span>
            <span className="w-[31%] text-right">
              {getZoneLabel("high", locale)}
            </span>
          </div>
        )}
      </div>

      {/* Human-readable level label */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${config.barClass}`}
          aria-hidden="true"
        />
        <span className={`text-sm font-semibold ${config.colorClass}`}>
          {levelLabel}
        </span>
      </div>

      {/* Screen reader live region */}
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}

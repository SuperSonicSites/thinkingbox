export interface SkeletonProps {
  variant?: "text" | "card" | "gauge";
  lines?: number;
  className?: string;
}

const shimmerBase =
  "relative overflow-hidden bg-surface-sunken before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-surface-raised/60 before:to-transparent before:animate-[shimmer_1.5s_infinite] motion-reduce:before:animate-none";

function TextSkeleton({ lines = 3 }: { lines: number }) {
  return (
    <div className="flex flex-col gap-2.5" role="presentation">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={[
            shimmerBase,
            "h-4 rounded-sm",
            i === lines - 1 ? "w-3/5" : "w-full",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div
      className="rounded-lg border border-border bg-surface-raised p-5"
      role="presentation"
    >
      {/* Header area */}
      <div className="flex items-center gap-3">
        <div className={`${shimmerBase} h-10 w-10 rounded-full`} />
        <div className="flex flex-1 flex-col gap-2">
          <div className={`${shimmerBase} h-4 w-2/5 rounded-sm`} />
          <div className={`${shimmerBase} h-3 w-3/5 rounded-sm`} />
        </div>
      </div>
      {/* Body lines */}
      <div className="mt-4 flex flex-col gap-2.5">
        <div className={`${shimmerBase} h-3 w-full rounded-sm`} />
        <div className={`${shimmerBase} h-3 w-full rounded-sm`} />
        <div className={`${shimmerBase} h-3 w-4/5 rounded-sm`} />
      </div>
      {/* Footer badge area */}
      <div className="mt-4 flex gap-2">
        <div className={`${shimmerBase} h-6 w-16 rounded-full`} />
        <div className={`${shimmerBase} h-6 w-20 rounded-full`} />
      </div>
    </div>
  );
}

function GaugeSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="presentation">
      {/* Score header */}
      <div className="flex items-baseline justify-between">
        <div className={`${shimmerBase} h-4 w-28 rounded-sm`} />
        <div className={`${shimmerBase} h-7 w-16 rounded-sm`} />
      </div>
      {/* Segmented bar */}
      <div className={`${shimmerBase} h-3 w-full rounded-full`} />
      {/* Level label */}
      <div className="flex items-center gap-2">
        <div className={`${shimmerBase} h-2.5 w-2.5 rounded-full`} />
        <div className={`${shimmerBase} h-4 w-32 rounded-sm`} />
      </div>
    </div>
  );
}

export function Skeleton({
  variant = "text",
  lines = 3,
  className = "",
}: SkeletonProps) {
  return (
    <div
      className={className}
      aria-busy="true"
      aria-label="Loading"
      role="status"
    >
      <span className="sr-only">Loading...</span>
      {variant === "text" && <TextSkeleton lines={lines} />}
      {variant === "card" && <CardSkeleton />}
      {variant === "gauge" && <GaugeSkeleton />}
    </div>
  );
}

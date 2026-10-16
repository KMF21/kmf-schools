import { cx } from "@kmf/ui";
import type { School } from "@kmf/core";

/** The school's logo, or a monogram in its colours when no logo is uploaded yet. */
export function SchoolMark({ school, size = 44, inverted = false, className }: { school: School; size?: number; inverted?: boolean; className?: string }) {
  const monogram = (school.shortName ?? school.name)
    .split(/\s+/)
    .filter((w) => !/^(the|of|and)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (school.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={school.logoUrl}
        alt={`${school.name} logo`}
        width={size}
        height={size}
        className={cx("shrink-0 rounded-[0.875rem] bg-white object-contain p-1", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-[0.875rem] font-[family-name:var(--font-display)] font-bold",
        inverted ? "bg-white text-brand" : "bg-brand text-brand-on",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {monogram || "S"}
    </span>
  );
}

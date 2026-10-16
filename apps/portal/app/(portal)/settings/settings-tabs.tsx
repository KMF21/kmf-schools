"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@kmf/ui";

const TABS = [
  { href: "/settings", label: "School profile" },
  { href: "/settings/calendar", label: "Session and term" },
  { href: "/settings/grading", label: "Grading" },
  { href: "/settings/reports", label: "Report cards" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mb-6 overflow-x-auto">
      <ul className="flex w-max gap-1 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-card)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "block rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors",
                  active ? "bg-brand text-brand-on" : "text-ink-muted hover:bg-surface-sunk hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

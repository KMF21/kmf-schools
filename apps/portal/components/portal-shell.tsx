"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { School } from "@kmf/core";
import { Avatar, cx, initials } from "@kmf/ui";
import { signOut } from "@/app/login/actions";
import { SchoolMark } from "./school-mark";
import { ThemeToggle } from "./theme-toggle";

const ICONS = {
  dashboard: LayoutDashboard,
  results: FileSpreadsheet,
  students: GraduationCap,
  classes: BookOpen,
  staff: Users,
  logins: KeyRound,
  announcements: Megaphone,
  settings: Settings,
  kmf: ShieldCheck,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const KMF_SUPPORT = "https://wa.me/2349110137795";

export function PortalShell({
  school,
  viewer,
  nav,
  termLabel,
  isDemo,
  children,
}: {
  school: School;
  viewer: { name: string; roleLabel: string };
  nav: NavItem[];
  termLabel: string | null;
  isDemo: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so it closes by itself after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  // Close with the Escape key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = nav.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-brand text-brand-on">
      {/* Fine dot grid, echoing the school's printed materials */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1.2px)", backgroundSize: "18px 18px" }}
      />
      <div className="relative flex items-center gap-3 px-5 pt-6 pb-5">
        <SchoolMark school={school} inverted size={46} />
        <div className="min-w-0">
          <p className="truncate font-[family-name:var(--font-display)] text-[1.0625rem] leading-tight font-bold">{school.name}</p>
          <p className="truncate text-xs text-white/75">{school.motto ?? "School portal"}</p>
        </div>
      </div>

      <nav aria-label="Main" className="relative flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const active = current?.href === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.9375rem] font-semibold transition-colors",
                    active ? "bg-white text-brand shadow-[0_6px_18px_-8px_rgb(0_0_0/0.35)]" : "text-white/85 hover:bg-white/12 hover:text-white",
                  )}
                >
                  <Icon className="size-[1.125rem] shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative space-y-2 px-3 pb-4">
        <div className="flex items-center gap-3 rounded-[1rem] bg-white/12 p-3">
          <span aria-hidden className="grid size-[38px] shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-[var(--brand)]">
            {initials(viewer.name)}
          </span>
          <Link href="/account" className="min-w-0 flex-1 rounded-md outline-offset-4 hover:underline" title="My account">
            <p className="truncate text-sm font-bold">{viewer.name}</p>
            <p className="truncate text-xs text-white/75">{viewer.roleLabel}</p>
          </Link>
          <form action={signOut}>
            <button type="submit" className="grid size-9 place-items-center rounded-full text-white/85 hover:bg-white/15 hover:text-white" aria-label="Sign out" title="Sign out">
              <LogOut className="size-[1.0625rem]" aria-hidden />
            </button>
          </form>
        </div>
        <a
          href={KMF_SUPPORT}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-[1rem] border border-dashed border-white/30 px-3 py-2.5 text-xs font-semibold text-white/85 hover:border-white/60 hover:text-white"
        >
          <LifeBuoy className="size-4" aria-hidden />
          Need help? Chat with KMF support
        </a>
        <p className="px-1 pt-1 text-[0.6875rem] text-white/60">Powered by KMF Schools</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17.5rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(19rem,86vw)] shadow-2xl">
            {sidebar}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-5 right-3 grid size-9 place-items-center rounded-full bg-white/15 text-white"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        {/* The page background fills the strip above the floating bar, so content never peeks through. */}
        <header className="sticky top-0 z-30 bg-canvas px-3 pt-3 sm:px-6 sm:pt-4">
          <div className="flex h-16 items-center gap-3 rounded-full border border-line bg-surface/95 px-3 shadow-[var(--shadow-float)] backdrop-blur sm:px-4">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-sunk lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <p className="min-w-0 flex-1 truncate pl-1 font-[family-name:var(--font-display)] text-[1.0625rem] font-bold">
              {current?.label ?? school.name}
            </p>
            {termLabel ? (
              <span className="hidden rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-brand-text sm:inline-flex">{termLabel}</span>
            ) : null}
            {isDemo ? (
              <span className="hidden rounded-full border border-warn/40 bg-warn-soft px-3 py-1.5 text-xs font-bold text-warn md:inline-flex">Demo data</span>
            ) : null}
            <ThemeToggle className="grid size-10 place-items-center rounded-full text-ink-muted hover:bg-surface-sunk hover:text-ink" />
            <Avatar name={viewer.name} size={38} className="hidden sm:grid" />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[84rem] px-3 pt-6 pb-16 sm:px-6 sm:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}

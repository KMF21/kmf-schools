import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Badge } from "@kmf/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { IS_DEMO } from "@/lib/env";
import { requirePlatformAdmin } from "@/lib/platform";
import { signOutAdmin } from "../actions";

export const metadata = { title: { default: "KMF admin", template: "%s | KMF admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <header className="flex items-center gap-3 rounded-full bg-surface px-4 py-2.5 shadow-[var(--shadow-float)] sm:px-5">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-[family-name:var(--font-display)] text-sm font-bold text-brand-on">
              K
            </span>
            <span className="truncate font-[family-name:var(--font-display)] font-bold">KMF admin</span>
          </Link>
          {IS_DEMO ? <Badge tone="warn">Demo</Badge> : null}
          <span className="ml-auto hidden truncate text-sm text-ink-muted sm:block">{me.email}</span>
          <ThemeToggle className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-sunk hover:text-ink" />
          <form action={signOutAdmin}>
            <button type="submit" className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunk hover:text-ink" aria-label="Sign out" title="Sign out">
              <LogOut className="size-[1.0625rem]" aria-hidden />
            </button>
          </form>
        </header>
        <main className="py-6">{children}</main>
      </div>
    </div>
  );
}

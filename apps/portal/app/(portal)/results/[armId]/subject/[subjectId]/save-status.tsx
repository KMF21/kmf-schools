"use client";

import { CircleAlert, CircleCheck, CloudOff, LoaderCircle } from "lucide-react";
import type { SaveStatus } from "./use-autosave";

export function SaveStatusPill({ status, error, onRetry }: { status: SaveStatus; error: string | null; onRetry: () => void }) {
  const look = {
    saved: { icon: <CircleCheck className="size-4" aria-hidden />, text: "All changes saved", cls: "bg-ok-soft text-ok" },
    pending: { icon: <LoaderCircle className="size-4 animate-spin" aria-hidden />, text: "Saving soon", cls: "bg-surface-sunk text-ink-muted" },
    saving: { icon: <LoaderCircle className="size-4 animate-spin" aria-hidden />, text: "Saving", cls: "bg-surface-sunk text-ink-muted" },
    offline: { icon: <CloudOff className="size-4" aria-hidden />, text: "No connection. Kept on this phone; will save when you're back online.", cls: "bg-warn-soft text-warn" },
    error: { icon: <CircleAlert className="size-4" aria-hidden />, text: error ?? "Not saved.", cls: "bg-bad-soft text-bad" },
  }[status];
  return (
    <div role="status" aria-live="polite" className={`flex items-start gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold ${look.cls}`}>
      <span className="mt-0.5">{look.icon}</span>
      <span className="min-w-0 flex-1">{look.text}</span>
      {status === "error" || status === "offline" ? (
        <button type="button" onClick={onRetry} className="shrink-0 underline underline-offset-4">
          Try again
        </button>
      ) : null}
    </div>
  );
}

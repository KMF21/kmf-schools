"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { School } from "@kmf/core";
import { SchoolMark } from "@/components/school-mark";
import type { Credential } from "./actions";

type Props = { school: School; credentials: Credential[]; portalAddress: string };

const subscribe = () => () => {};

/**
 * Cut-out slips, two per row, that print on plain A4 (about 10 per page).
 * A copy is placed directly in <body> for printing, and the print styles in
 * globals.css hide everything else, so only the slips come out of the printer.
 */
export function CredentialSlips(props: Props) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <>
      <Slips {...props} className="grid gap-3 sm:grid-cols-2" />
      {mounted ? createPortal(<Slips {...props} className="print-portal hidden grid-cols-2 print:grid" />, document.body) : null}
    </>
  );
}

function Slips({ school, credentials, portalAddress, className }: Props & { className: string }) {
  return (
    <div className={className}>
      {credentials.map((c, i) => (
        <article
          key={`${c.login}-${i}`}
          className="break-inside-avoid rounded-[var(--radius-control)] border border-dashed border-line-strong bg-surface p-4 print:rounded-none print:border-black/40 print:bg-white print:text-black"
        >
          <header className="flex items-center gap-2.5 border-b border-line pb-2.5 print:border-black/20">
            <SchoolMark school={school} size={30} />
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-display)] text-sm font-bold">{school.name}</p>
              <p className="truncate text-xs text-ink-muted print:text-black/70">Portal login</p>
            </div>
          </header>
          <p className="mt-2.5 font-bold">{c.name}</p>
          <p className="text-xs text-ink-muted print:text-black/70">{c.detail}</p>
          <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-muted print:text-black/70">Website</dt>
            <dd className="break-all font-semibold">{portalAddress}</dd>
            <dt className="text-ink-muted print:text-black/70">Login</dt>
            <dd className="break-all font-mono font-bold">{c.login}</dd>
            <dt className="text-ink-muted print:text-black/70">Password</dt>
            <dd className="font-mono font-bold tracking-wider">{c.password ?? <span className="font-sans font-semibold tracking-normal">Your current password</span>}</dd>
          </dl>
          <p className="mt-2.5 text-[0.6875rem] text-ink-faint print:text-black/60">Keep this slip private. Change your password after you sign in.</p>
        </article>
      ))}
    </div>
  );
}

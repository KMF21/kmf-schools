"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/**
 * Shows its content on the page, and places a copy directly in <body> for
 * printing. The print styles in globals.css hide everything else, so only this
 * content comes out of the printer, without the sidebar or buttons.
 */
export function PrintArea({ children, className }: { children: ReactNode; className?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <>
      <div className={className}>{children}</div>
      {mounted ? createPortal(<div className="print-portal hidden print:block">{children}</div>, document.body) : null}
    </>
  );
}

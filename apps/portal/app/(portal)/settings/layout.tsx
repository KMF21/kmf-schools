import type { ReactNode } from "react";
import { MANAGER_ROLES } from "@kmf/core";
import { IS_DEMO } from "@/lib/env";
import { requireViewer } from "@/lib/session";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireViewer(MANAGER_ROLES);
  return (
    <>
      <SettingsTabs />
      {IS_DEMO ? (
        <p className="mb-6 rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft px-5 py-3 text-sm font-semibold text-warn">
          This is the demo school, so changes here aren&apos;t saved.
        </p>
      ) : null}
      {children}
    </>
  );
}

import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Card, CardHeader, IconTile } from "@kmf/ui";
import { IS_DEMO, ROOT_DOMAIN } from "@/lib/env";
import { getTenant } from "@/lib/tenant";
import { requireViewer } from "@/lib/session";
import { LogoForm } from "./logo-form";
import { SchoolForm } from "./school-form";

export const metadata: Metadata = { title: "School settings" };

export default async function SettingsPage() {
  const { school } = await requireViewer(MANAGER_ROLES);
  const tenant = await getTenant();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          title="School profile"
          description={
            IS_DEMO
              ? "This is the demo school, so changes aren't saved."
              : "Shown on the login page, report cards and the school website."
          }
        />
        <SchoolForm school={school} />
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Logo" />
          <LogoForm school={school} />
        </Card>

        <Card>
          <CardHeader title="Web address" />
          <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
            <IconTile tone="info">
              <Globe />
            </IconTile>
            <div className="min-w-0">
              <p className="truncate font-bold">{tenant.kind === "school" && !tenant.chosenByPath ? tenant.hostname : `${school.slug}.${ROOT_DOMAIN}`}</p>
              <p className="text-sm text-ink-muted">To use your own domain, such as portal.yourschool.com.ng, contact KMF support.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Globe, Palette } from "lucide-react";
import { MANAGER_ROLES, brandPalette } from "@kmf/core";
import { Card, CardHeader, IconTile } from "@kmf/ui";
import { SchoolMark } from "@/components/school-mark";
import { ROOT_DOMAIN } from "@/lib/env";
import { getTenant } from "@/lib/tenant";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "School settings" };

export default async function SettingsPage() {
  const { school } = await requireViewer(MANAGER_ROLES);
  const tenant = await getTenant();
  const palette = brandPalette(school.brandColor);

  const details: Array<[string, string | null]> = [
    ["School name", school.name],
    ["Short name", school.shortName],
    ["Motto", school.motto],
    ["Address", school.address],
    ["Phone", school.phone],
    ["Email", school.email],
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="School profile" description="Shown on report cards, the login page and the school website." />
        <div className="flex items-center gap-4 border-b border-line px-5 py-5 sm:px-6">
          <SchoolMark school={school} size={64} />
          <div>
            <p className="font-bold">{school.logoUrl ? "Logo uploaded" : "No logo yet"}</p>
            <p className="text-sm text-ink-muted">{school.logoUrl ? "Used on report cards and the portal." : "Until you upload one, the portal shows your initials."}</p>
          </div>
        </div>
        <dl className="divide-y divide-line">
          {details.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:px-6">
              <dt className="text-sm font-bold text-ink-muted">{label}</dt>
              <dd className={value ? "text-ink" : "text-ink-faint"}>{value || "Not added"}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-line px-5 py-4 text-sm text-ink-muted sm:px-6">Editing these details arrives in the next update. Until then, KMF support can change them for you.</p>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Brand colour" />
          <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
            <IconTile><Palette /></IconTile>
            <div className="min-w-0">
              <p className="font-bold">{palette.base.toUpperCase()}</p>
              <p className="text-sm text-ink-muted">
                {palette.base === palette.solid ? "Used as chosen across the portal." : "Darkened slightly on buttons so text stays readable."}
              </p>
            </div>
          </div>
          <div className="flex gap-2 px-5 pb-5 sm:px-6" aria-hidden>
            {[palette.solid, palette.strong, palette.line, palette.soft, palette.wash].map((c) => (
              <span key={c} className="h-10 flex-1 rounded-[0.75rem] border border-line" style={{ background: c }} />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Web address" />
          <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
            <IconTile tone="info"><Globe /></IconTile>
            <div className="min-w-0">
              <p className="truncate font-bold">{tenant.kind === "school" ? tenant.hostname : `${school.slug}.${ROOT_DOMAIN}`}</p>
              <p className="text-sm text-ink-muted">To use your own domain, such as portal.yourschool.com.ng, contact KMF support.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

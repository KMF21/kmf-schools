import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Badge, Card, CardHeader, EmptyState } from "@kmf/ui";
import { getAnnouncements } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Announcements" };

const AUDIENCE: Record<string, string> = { everyone: "Everyone", staff: "Staff only", parents: "Parents", public: "Also on website" };

export default async function AnnouncementsPage() {
  const { school, viewer } = await requireViewer();
  const items = await getAnnouncements(school, viewer.roles, 50);
  const isManager = viewer.roles.some((r) => MANAGER_ROLES.includes(r));

  return (
    <Card>
      <CardHeader title="Announcements" description={isManager ? "What staff, parents and students see on their dashboards." : `News from ${school.name}`} />
      {items.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No announcements yet">
          {isManager ? "Posting announcements arrives in the next update." : "School news will appear here."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="px-5 py-5 sm:px-6">
              <article>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base">{a.title}</h2>
                  {isManager ? <Badge tone={a.audience === "staff" ? "info" : a.audience === "public" ? "brand" : "neutral"}>{AUDIENCE[a.audience] ?? a.audience}</Badge> : null}
                </div>
                <p className="mt-1.5 max-w-[70ch] text-ink-muted">{a.body}</p>
                <p className="mt-2 text-xs text-ink-faint">Posted {formatDate(a.publishedAt, { day: "numeric", month: "long", year: "numeric" })}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

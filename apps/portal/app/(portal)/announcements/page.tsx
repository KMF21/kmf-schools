import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState } from "@kmf/ui";
import { getAnnouncements } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { isManager, requireViewer } from "@/lib/session";
import { DeleteAnnouncementButton, NewAnnouncementForm } from "./announcement-forms";

export const metadata: Metadata = { title: "Announcements" };

const AUDIENCE: Record<string, string> = { everyone: "Everyone", staff: "Staff only", parents: "Parents", public: "Also on website" };

export default async function AnnouncementsPage() {
  const { school, viewer } = await requireViewer();
  const items = await getAnnouncements(school, viewer.roles, 50);
  const canManage = isManager(viewer);

  return (
    <div className={canManage ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" : ""}>
      {canManage ? (
        <Card className="xl:sticky xl:top-28">
          <CardHeader title="Post an announcement" description="It appears on dashboards straight away." />
          <NewAnnouncementForm />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Announcements" description={canManage ? "What staff, parents and students see." : `News from ${school.name}`} />
        {items.length === 0 ? (
          <EmptyState icon={<Megaphone />} title="No announcements yet">
            {canManage ? "Post term dates, events and reminders for staff and parents." : "School news will appear here."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((a) => (
              <li key={a.id} className="px-5 py-5 sm:px-6">
                <article>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base">{a.title}</h2>
                    {canManage ? (
                      <Badge tone={a.audience === "staff" ? "info" : a.audience === "public" ? "brand" : "neutral"}>{AUDIENCE[a.audience] ?? a.audience}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 max-w-[70ch] whitespace-pre-line text-ink-muted">{a.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-ink-faint">Posted {formatDate(a.publishedAt, { day: "numeric", month: "long", year: "numeric" })}</p>
                    {canManage ? <DeleteAnnouncementButton id={a.id} title={a.title} /> : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

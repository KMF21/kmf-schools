import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, GraduationCap, Plus, Receipt, School, Signal } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, StatTile, buttonClasses } from "@kmf/ui";
import { SchoolMark } from "@/components/school-mark";
import { formatNaira, formatNumber } from "@/lib/format";
import { listSchools, platformAddress, schoolPortalLink } from "@/lib/platform";
import { StatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Schools" };

export default async function AdminHome() {
  const schools = await listSchools();
  const links = await Promise.all(schools.map((s) => schoolPortalLink(s.slug)));
  const live = schools.filter((s) => s.status === "active").length;
  const students = schools.reduce((n, s) => n + s.students, 0);
  const owed = schools.reduce((n, s) => n + (s.billing.status === "unpaid" ? (s.billing.amount ?? 0) : 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Schools" value={formatNumber(schools.length)} icon={<School />} />
        <StatTile label="Live" value={formatNumber(live)} note={`${formatNumber(schools.length - live)} setting up or suspended`} icon={<Signal />} tone="ok" />
        <StatTile label="Active students" value={formatNumber(students)} icon={<GraduationCap />} tone="info" />
        <StatTile label="Unpaid invoices" value={formatNaira(owed)} note={`${schools.filter((s) => s.billing.overdue).length} overdue`} icon={<Receipt />} tone="warn" />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Schools"
          description="Every school on KMF Schools."
          action={
            <Link href="/admin/schools/new" className={buttonClasses("solid", "sm")}>
              <Plus className="size-4" aria-hidden /> New school
            </Link>
          }
        />
        {schools.length === 0 ? (
          <EmptyState icon={<School />} title="No schools yet" action={<Link href="/admin/schools/new" className={buttonClasses("solid", "sm")}>Set up the first school</Link>}>
            Set up a school, then give its proprietor a login.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {schools.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-brand-wash sm:px-6">
                <SchoolMark school={{ ...s, shortName: null, motto: null, address: null, phone: null, email: null }} size={40} />
                <div className="min-w-0 flex-1 basis-48">
                  <Link href={`/admin/schools/${s.id}`} className="font-bold text-ink underline-offset-4 hover:text-brand-text hover:underline">
                    {s.name}
                  </Link>
                  <p className="truncate text-sm text-ink-muted">{[platformAddress(s.slug), ...s.domains].join(" · ")}</p>
                </div>
                <span className="text-sm text-ink-muted tabular-nums">{formatNumber(s.students)} students</span>
                <StatusBadge status={s.status} />
                {s.billing.plan === "free" ? (
                  <Badge>Free plan</Badge>
                ) : s.billing.status === "paid" || s.billing.status === "waived" ? (
                  <Badge tone="ok">Paid</Badge>
                ) : s.billing.status === "unpaid" ? (
                  <Badge tone={s.billing.overdue ? "bad" : "warn"}>
                    {s.billing.overdue ? "Overdue" : "Unpaid"} {formatNaira(s.billing.amount)}
                  </Badge>
                ) : (
                  <Badge tone="warn">No invoice</Badge>
                )}
                {s.status === "suspended" ? null : (
                  <a href={links[i]} className={buttonClasses("outline", "sm")}>
                    Open portal <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

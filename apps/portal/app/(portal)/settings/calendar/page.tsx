import type { Metadata } from "next";
import { Card, CardHeader } from "@kmf/ui";
import { getCurrentTerm } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { requireSchool } from "@/lib/tenant";
import { TermForm } from "./term-form";

export const metadata: Metadata = { title: "Session and term" };

export default async function CalendarPage() {
  const school = await requireSchool();
  const term = await getCurrentTerm(school);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          title="Current session and term"
          description="Results, attendance and report cards are recorded against the current term. Change it when a new term begins."
        />
        <TermForm term={term} />
      </Card>
      <Card>
        <CardHeader title="Now showing" />
        <dl className="divide-y divide-line">
          {[
            ["Session", term?.session ?? "Not set"],
            ["Term", term?.name ?? "Not set"],
            ["Starts", formatDate(term?.startsOn, { day: "numeric", month: "long", year: "numeric" })],
            ["Ends", formatDate(term?.endsOn, { day: "numeric", month: "long", year: "numeric" })],
            ["Next term begins", formatDate(term?.nextTermBegins, { day: "numeric", month: "long", year: "numeric" })],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-5 py-3.5 sm:px-6">
              <dt className="text-sm font-bold text-ink-muted">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

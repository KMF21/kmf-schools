import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Card, CardHeader, EmptyState, buttonClasses } from "@kmf/ui";
import { formatDate } from "@/lib/format";
import { defaultDestination, getPromotionData } from "@/lib/promotion";
import { requireViewer } from "@/lib/session";
import { PromotionPlanner } from "./promotion-planner";

export const metadata: Metadata = { title: "Promote students" };

export default async function PromotePage() {
  const { school } = await requireViewer(MANAGER_ROLES);
  const data = await getPromotionData(school);
  const session = data.term?.session ?? "";
  const alreadyDone = data.lastRun && data.lastRun.fromSession === session;

  return (
    <div className="space-y-4">
      <Link href="/students" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> Students
      </Link>
      <Card>
        <CardHeader
          title="Promote students to a new session"
          description={`Move every class up at once${session ? `, from ${session}` : ""}. Past results stay with the class each student was in. Nothing changes until you confirm at the bottom.`}
        />
        <div className="space-y-2 px-5 py-4 sm:px-6">
          {alreadyDone ? (
            <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Students were already promoted from {session} on {formatDate(data.lastRun!.at)}. Promoting again would move them up another class. Set the new session first under School settings, Session and term.
            </p>
          ) : null}
          {data.term && data.term.number !== 3 ? (
            <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              The current term is {data.term.name}. Schools usually promote after third term results are published.
            </p>
          ) : null}
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>Check where each class goes. Change any student, tick several to move them together, or split a class evenly.</li>
            <li>Confirm. Everyone moves in one step; if anything fails, nothing changes.</li>
            <li>Then set the new session under School settings, Session and term, and import only your new students.</li>
          </ol>
        </div>
      </Card>

      {data.classes.length === 0 ? (
        <Card>
          <EmptyState title="No students in classes yet">Add students to classes first.</EmptyState>
        </Card>
      ) : (
        <PromotionPlanner
          fromSession={session || "Unknown session"}
          classes={data.classes.map((c) => ({ ...c, defaultChoice: defaultDestination(c, data.destinations) }))}
          destinations={data.destinations}
        />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, EmptyState, buttonClasses } from "@kmf/ui";
import { PrintArea } from "@/components/print-area";
import { PrintButton } from "@/components/print-button";
import { ReportCard } from "@/components/report-card";
import { classReportCards } from "@/lib/report-cards";
import { loadClass } from "../load";

export const metadata: Metadata = { title: "Report cards" };

export default async function PrintReportCardsPage({ params, searchParams }: { params: Promise<{ armId: string }>; searchParams: Promise<{ term?: string }> }) {
  const { armId } = await params;
  const { term: termParam } = await searchParams;
  const { school, cls, term, access } = await loadClass(armId, termParam);
  if (!access.manage && !access.formTeacher) redirect(`/results/${armId}?term=${term.id}`);
  const ctx = await classReportCards(school, cls, term);

  return (
    <div className="space-y-4">
      <Link href={`/results/${cls.id}?term=${term.id}`} className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> {cls.label}
      </Link>
      <Card>
        <CardHeader
          title={`Report cards, ${cls.label}`}
          description={
            ctx.published
              ? `${ctx.cards.length} report cards for ${term.label}. Each prints on its own A4 page. To save as PDF, choose "Save as PDF" in the print window.`
              : "These results aren't published yet, so each card is marked as a draft. Publish the class to print official copies."
          }
          action={ctx.cards.length ? <PrintButton label={`Print ${ctx.cards.length} cards`} /> : null}
        />
      </Card>
      {ctx.cards.length === 0 ? (
        <Card>
          <EmptyState title="No students in this class">Add students to this class first.</EmptyState>
        </Card>
      ) : (
        <PrintArea className="space-y-6">
          {ctx.cards.map((card) => (
            <div key={card.student.id} className="report-page overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)] print:rounded-none print:border-0 print:shadow-none">
              <ReportCard ctx={ctx} card={card} />
            </div>
          ))}
        </PrintArea>
      )}
    </div>
  );
}

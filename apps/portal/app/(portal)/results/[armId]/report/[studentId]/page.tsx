import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, buttonClasses } from "@kmf/ui";
import { PrintArea } from "@/components/print-area";
import { PrintButton } from "@/components/print-button";
import { ReportCard } from "@/components/report-card";
import { classReportCards, ownReportCard } from "@/lib/report-cards";
import { loadClass } from "../../load";

export const metadata: Metadata = { title: "Report card" };

export default async function ReportCardPage({ params, searchParams }: { params: Promise<{ armId: string; studentId: string }>; searchParams: Promise<{ term?: string }> }) {
  const { armId, studentId } = await params;
  const { term: termParam } = await searchParams;
  const { school, viewer, cls, term, access } = await loadClass(armId, termParam, ["owner", "admin", "teacher", "parent", "student"]);
  const staffView = access.manage || access.formTeacher;
  const isFamily = viewer.roles.some((r) => r === "parent" || r === "student");

  const ctx = staffView ? await classReportCards(school, cls, term, studentId) : isFamily ? await ownReportCard(school, cls, term, studentId) : null;
  const card = ctx?.cards[0];
  if (!ctx || !card) notFound();

  return (
    <div className="space-y-4">
      <Link href={staffView ? `/results/${cls.id}?term=${term.id}` : "/results"} className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> {staffView ? cls.label : "Results"}
      </Link>
      <Card>
        <CardHeader title={card.student.name} description={`${term.label} · ${cls.label}. To save as PDF, press Print and choose "Save as PDF".`} action={<PrintButton />} />
      </Card>
      <PrintArea>
        <div className="report-page overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)] print:rounded-none print:border-0 print:shadow-none">
          <ReportCard ctx={ctx} card={card} />
        </div>
      </PrintArea>
    </div>
  );
}

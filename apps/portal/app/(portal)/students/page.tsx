import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, GraduationCap, Plus, Search, TrendingUp } from "lucide-react";
import { STAFF_ROLES } from "@kmf/core";
import { Card, CardHeader, EmptyState, Select, buttonClasses } from "@kmf/ui";
import { getStudents } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { getArmOptions } from "@/lib/people";
import { isManager, requireViewer } from "@/lib/session";
import { StudentTable } from "./student-table";

export const metadata: Metadata = { title: "Students" };

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "graduated", label: "Graduated" },
  { value: "withdrawn", label: "Left the school" },
  { value: "all", label: "Everyone" },
] as const;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; class?: string; status?: string }> }) {
  const { school, viewer } = await requireViewer(STAFF_ROLES);
  const canManage = isManager(viewer);
  const { q = "", class: classId = "", status: statusParam = "active" } = await searchParams;
  const status = STATUSES.find((s) => s.value === statusParam)?.value ?? "active";
  const [students, arms] = await Promise.all([getStudents(school, { search: q, classId: classId || undefined, status }), getArmOptions(school)]);
  const filtered = Boolean(q || classId || status !== "active");

  return (
    <Card>
      <CardHeader
        title="Students"
        description={
          filtered
            ? `${formatNumber(students.length)} ${students.length === 1 ? "student" : "students"} shown`
            : `${formatNumber(students.length)} active students${canManage ? ". Tick students to move them to another class." : ""}`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <>
              <Link href="/students/import" className={buttonClasses("outline", "sm")}>
                <FileSpreadsheet className="size-4" aria-hidden /> Import from Excel
              </Link>
              <Link href="/students/new" className={buttonClasses("solid", "sm")}>
                <Plus className="size-4" aria-hidden /> Add student
              </Link>
            </>
          ) : null}
          {canManage ? (
            <Link href="/students/promote" className={buttonClasses("outline", "sm")}>
              <TrendingUp className="size-4" aria-hidden /> Promote to new session
            </Link>
          ) : null}
          </div>
        }
      />

      <form role="search" className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 sm:px-6">
        <span className="relative min-w-0 flex-1 basis-56">
          <label htmlFor="q" className="sr-only">Search students</label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name or admission number"
            className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm placeholder:text-ink-faint focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
        </span>
        <span className="block w-40">
          <Select name="class" defaultValue={classId} aria-label="Class" className="h-10 text-sm">
            <option value="">All classes</option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </span>
        <span className="block w-40">
          <Select name="status" defaultValue={status} aria-label="Status" className="h-10 text-sm">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </span>
        <button type="submit" className={buttonClasses("soft", "sm")}>Show</button>
      </form>

      {students.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title={filtered ? "No students match" : "No students yet"}
          action={
            filtered ? (
              <Link href="/students" className={buttonClasses("outline", "sm")}>Show all active students</Link>
            ) : canManage ? (
              <Link href="/students/import" className={buttonClasses("solid", "sm")}>
                <FileSpreadsheet className="size-4" aria-hidden /> Import from Excel
              </Link>
            ) : undefined
          }
        >
          {filtered ? "Check the spelling, or choose another class or status." : canManage ? "Import your student list from Excel, or add students one by one." : "The school admin adds students."}
        </EmptyState>
      ) : (
        <StudentTable students={students} canManage={canManage} arms={arms.map((a) => ({ id: a.id, label: a.label }))} />
      )}
    </Card>
  );
}

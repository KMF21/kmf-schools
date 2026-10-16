import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, GraduationCap, Plus, Search } from "lucide-react";
import { STAFF_ROLES } from "@kmf/core";
import { Avatar, Badge, Card, CardHeader, EmptyState, buttonClasses } from "@kmf/ui";
import { getStudents } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { isManager, requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { school, viewer } = await requireViewer(STAFF_ROLES);
  const canManage = isManager(viewer);
  const { q = "" } = await searchParams;
  const students = await getStudents(school, q);

  return (
    <Card>
      <CardHeader
        title="Students"
        description={q ? `${formatNumber(students.length)} matching "${q}"` : `${formatNumber(students.length)} students`}
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
          <form role="search" className="relative">
            <label htmlFor="q" className="sr-only">Search students</label>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name or admission number"
              className="h-10 w-64 max-w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm placeholder:text-ink-faint focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </form>
          </div>
        }
      />

      {students.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title={q ? "No students match your search" : "No students yet"}
          action={
            q ? (
              <Link href="/students" className={buttonClasses("outline", "sm")}>Clear search</Link>
            ) : canManage ? (
              <Link href="/students/import" className={buttonClasses("solid", "sm")}>
                <FileSpreadsheet className="size-4" aria-hidden /> Import from Excel
              </Link>
            ) : undefined
          }
        >
          {q ? "Check the spelling, or search by admission number instead." : canManage ? "Import your student list from Excel, or add students one by one." : "The school admin adds students."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-sunk text-xs text-ink-muted">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold">Name</th>
                <th scope="col" className="px-4 py-3 font-bold">Admission number</th>
                <th scope="col" className="px-4 py-3 font-bold">Class</th>
                <th scope="col" className="px-4 py-3 font-bold">Gender</th>
                <th scope="col" className="px-6 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-brand-wash">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} size={34} />
                      {canManage ? (
                        <Link href={`/students/${s.id}`} className="font-bold text-ink underline-offset-4 hover:text-brand-text hover:underline">
                          {s.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-ink">{s.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted tabular-nums">{s.admissionNo}</td>
                  <td className="px-4 py-3">{s.className}</td>
                  <td className="px-4 py-3 text-ink-muted capitalize">{s.gender ?? "Not recorded"}</td>
                  <td className="px-6 py-3">
                    <Badge tone={s.status === "active" ? "ok" : "neutral"}>{s.status === "active" ? "Active" : s.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

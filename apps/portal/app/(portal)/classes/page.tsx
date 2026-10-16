import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState } from "@kmf/ui";
import { getStructure } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Classes and subjects" };

export default async function ClassesPage() {
  const { school } = await requireViewer(["owner", "admin", "teacher"]);
  const structure = await getStructure(school);

  if (structure.length === 0) {
    return (
      <Card>
        <EmptyState icon={<BookOpen />} title="No sections set up yet">
          Choose which sections your school runs, from nursery to senior secondary, and the starter classes and subjects are added for you.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {structure.map((section) => {
        const students = section.levels.reduce((n, l) => n + l.arms.reduce((m, a) => m + a.students, 0), 0);
        return (
          <Card key={section.id}>
            <CardHeader
              title={section.name}
              description={`${section.levels.length} classes, ${formatNumber(students)} students`}
              action={<Badge tone={section.assessmentStyle === "rating" ? "info" : "brand"}>{section.assessmentStyle === "rating" ? "Rated by skills" : "Scored with CA and exam"}</Badge>}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface-sunk text-xs text-ink-muted">
                  <tr>
                    <th scope="col" className="w-36 px-6 py-3 font-bold">Class</th>
                    <th scope="col" className="w-48 px-4 py-3 font-bold">Arms and students</th>
                    <th scope="col" className="px-6 py-3 font-bold">Subjects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {section.levels.map((level) => (
                    <tr key={level.id}>
                      <th scope="row" className="px-6 py-4 font-bold text-ink">{level.name}</th>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {level.arms.map((arm) => (
                            <span key={arm.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunk px-2.5 py-1 text-xs">
                              <span className="font-bold">{arm.name}</span>
                              <span className="text-ink-muted tabular-nums">{arm.students}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-ink-muted">
                        {level.subjects.length ? `${level.subjects.length} subjects: ${level.subjects.join(", ")}` : "No subjects assigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

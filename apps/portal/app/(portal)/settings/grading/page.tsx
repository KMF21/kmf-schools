import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@kmf/ui";
import { getGrading } from "@/lib/structure";
import { requireSchool } from "@/lib/tenant";
import { GradingEditor } from "./grading-editor";

export const metadata: Metadata = { title: "Grading" };

export default async function GradingPage() {
  const school = await requireSchool();
  const sections = await getGrading(school);

  if (sections.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Scale />} title="No scored sections yet">
          Add primary or secondary sections under Classes and subjects. Nursery uses skill ratings instead of scores.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <Card key={s.sectionId}>
          <CardHeader title={s.sectionName} description="How scores add up, and how totals turn into grades on report cards." />
          <GradingEditor grading={s} />
        </Card>
      ))}
    </div>
  );
}

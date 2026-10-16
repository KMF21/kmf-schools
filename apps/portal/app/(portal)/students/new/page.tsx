import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Card, CardHeader, buttonClasses } from "@kmf/ui";
import { getArmOptions } from "@/lib/people";
import { requireViewer } from "@/lib/session";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Add a student" };

export default async function NewStudentPage() {
  const { school } = await requireViewer(MANAGER_ROLES);
  const arms = await getArmOptions(school);
  return (
    <div className="space-y-4">
      <Link href="/students" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All students
      </Link>
      <Card>
        <CardHeader title="Add a student" description="To add many at once, import your list from Excel instead." />
        <StudentForm student={null} arms={arms} />
      </Card>
    </div>
  );
}

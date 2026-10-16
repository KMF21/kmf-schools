import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Card, CardHeader, buttonClasses } from "@kmf/ui";
import { getArmOptions, getStudent } from "@/lib/people";
import { requireViewer } from "@/lib/session";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { school } = await requireViewer(MANAGER_ROLES);
  const { id } = await params;
  const { added } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) && !id.startsWith("demo-")) notFound();

  const [student, arms] = await Promise.all([getStudent(school, id), getArmOptions(school)]);
  if (!student) notFound();

  return (
    <div className="space-y-4">
      <Link href="/students" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All students
      </Link>
      <Card>
        <CardHeader title={[student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ")} description={`Admission number ${student.admissionNo}`} />
        <StudentForm key={student.id} student={student} arms={arms} notice={added ? "Student added." : undefined} />
      </Card>
    </div>
  );
}

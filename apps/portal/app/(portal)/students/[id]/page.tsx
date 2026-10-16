import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Card, CardHeader, buttonClasses } from "@kmf/ui";
import { getLoginStatus, getPortalAddress } from "@/lib/logins";
import { getArmOptions, getStudent } from "@/lib/people";
import { requireViewer } from "@/lib/session";
import { LoginCard } from "../../logins/login-card";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { school, viewer } = await requireViewer(MANAGER_ROLES);
  const { id } = await params;
  const { added } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) && !id.startsWith("demo-")) notFound();

  const [student, arms] = await Promise.all([getStudent(school, id), getArmOptions(school)]);
  if (!student) notFound();
  const [login, portalAddress] = await Promise.all([getLoginStatus(school, "students", student.id, viewer.userId), getPortalAddress(school)]);
  const name = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      <Link href="/students" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All students
      </Link>
      <Card>
        <CardHeader title={name} description={`Admission number ${student.admissionNo}`} />
        <StudentForm key={student.id} student={student} arms={arms} notice={added ? "Student added." : undefined} />
      </Card>
      <LoginCard
        school={school}
        portalAddress={portalAddress}
        canCreate={login.canCreate || login.hasLogin}
        people={[
          { kind: "students", id: student.id, name, hasLogin: login.hasLogin },
          ...student.guardians.filter((g) => g.phone).map((g) => ({ kind: "parents" as const, id: g.id, name: g.fullName, hasLogin: Boolean(g.hasLogin) })),
        ]}
      />
    </div>
  );
}

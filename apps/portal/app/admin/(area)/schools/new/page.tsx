import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, buttonClasses } from "@kmf/ui";
import { ROOT_DOMAIN } from "@/lib/env";
import { NewSchoolForm } from "./new-school-form";

export const metadata: Metadata = { title: "New school" };

export default function NewSchoolPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All schools
      </Link>
      <Card>
        <CardHeader title="New school" description="The school can add its logo, classes, students and staff after signing in." />
        <NewSchoolForm rootDomain={ROOT_DOMAIN} />
      </Card>
    </div>
  );
}

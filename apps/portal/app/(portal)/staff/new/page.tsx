import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Card, CardHeader, buttonClasses } from "@kmf/ui";
import { requireViewer } from "@/lib/session";
import { StaffForm } from "../staff-form";

export const metadata: Metadata = { title: "Add a staff member" };

export default async function NewStaffPage() {
  await requireViewer(MANAGER_ROLES);
  return (
    <div className="space-y-4">
      <Link href="/staff" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All staff
      </Link>
      <Card>
        <CardHeader title="Add a staff member" description="To add many at once, import your staff list from Excel instead." />
        <StaffForm member={null} />
      </Card>
    </div>
  );
}

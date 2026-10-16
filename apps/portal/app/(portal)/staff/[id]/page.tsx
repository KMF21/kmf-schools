import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Card, CardHeader, buttonClasses } from "@kmf/ui";
import { getLoginStatus, getPortalAddress } from "@/lib/logins";
import { getStaffMember } from "@/lib/people";
import { requireViewer } from "@/lib/session";
import { LoginCard } from "../../logins/login-card";
import { StaffForm } from "../staff-form";

export const metadata: Metadata = { title: "Staff member" };

export default async function StaffMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { school, viewer } = await requireViewer(MANAGER_ROLES);
  const { id } = await params;
  const { added } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) && !id.startsWith("demo-")) notFound();

  const member = await getStaffMember(school, id);
  if (!member) notFound();
  const [login, portalAddress] = await Promise.all([getLoginStatus(school, "staff", member.id, viewer.userId), getPortalAddress(school)]);
  const name = [member.title, member.firstName, member.lastName].filter(Boolean).join(" ");
  const staffRole = (["admin", "bursar", "teacher"] as const).find((r) => login.roles.includes(r)) ?? null;

  return (
    <div className="space-y-4">
      <Link href="/staff" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All staff
      </Link>
      <Card>
        <CardHeader title={name} description={member.position ?? "Staff member"} />
        <StaffForm key={member.id} member={member} notice={added ? "Staff member added." : undefined} />
      </Card>
      {login.roles.includes("owner") ? null : (
        <LoginCard
          school={school}
          portalAddress={portalAddress}
          canCreate={login.canCreate || login.hasLogin}
          people={[{ kind: "staff", id: member.id, name, hasLogin: login.hasLogin }]}
          staffRole={login.hasLogin ? { staffId: member.id, role: staffRole, isSelf: login.isSelf } : undefined}
        />
      )}
    </div>
  );
}

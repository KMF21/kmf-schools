import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Plus, Users } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { Avatar, Badge, Card, CardHeader, EmptyState, buttonClasses } from "@kmf/ui";
import { IS_DEMO } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { getStaffList } from "@/lib/people";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { school } = await requireViewer(MANAGER_ROLES);
  const { staff, total } = await getStaffList(school);
  const active = staff.filter((s) => s.isActive).length;

  return (
    <Card>
      <CardHeader
        title="Staff"
        description={IS_DEMO ? `Showing ${staff.length} of ${formatNumber(total)} sample staff` : `${formatNumber(active)} working at the school`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/staff/import" className={buttonClasses("outline", "sm")}>
              <FileSpreadsheet className="size-4" aria-hidden /> Import from Excel
            </Link>
            <Link href="/staff/new" className={buttonClasses("solid", "sm")}>
              <Plus className="size-4" aria-hidden /> Add staff member
            </Link>
          </div>
        }
      />
      {staff.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No staff yet"
          action={
            <Link href="/staff/import" className={buttonClasses("solid", "sm")}>
              <FileSpreadsheet className="size-4" aria-hidden /> Import from Excel
            </Link>
          }
        >
          Import your staff list from Excel, or add staff one by one.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-sunk text-xs text-ink-muted">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold">Name</th>
                <th scope="col" className="px-4 py-3 font-bold">Position</th>
                <th scope="col" className="px-4 py-3 font-bold">Email</th>
                <th scope="col" className="px-4 py-3 font-bold">Phone</th>
                <th scope="col" className="px-6 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.map((s) => {
                const name = [s.title, s.firstName, s.lastName].filter(Boolean).join(" ");
                return (
                  <tr key={s.id} className="hover:bg-brand-wash">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${s.firstName} ${s.lastName}`} size={34} />
                        <Link href={`/staff/${s.id}`} className="font-bold text-ink underline-offset-4 hover:text-brand-text hover:underline">
                          {name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">{s.position ?? <span className="text-ink-faint">Not set</span>}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.email ?? <span className="text-ink-faint">None</span>}</td>
                    <td className="px-4 py-3 text-ink-muted tabular-nums">{s.phone ?? <span className="text-ink-faint">None</span>}</td>
                    <td className="px-6 py-3">
                      <Badge tone={s.isActive ? "ok" : "neutral"}>{s.isActive ? "Working" : "Left"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

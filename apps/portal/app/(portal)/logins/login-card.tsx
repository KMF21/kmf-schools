"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, KeyRound, LoaderCircle, Printer } from "lucide-react";
import type { School } from "@kmf/core";
import { Badge, Button, Card, CardHeader, Select, buttonClasses } from "@kmf/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-bits";
import { resetPassword, setStaffRole, type Credential, type LoginKind } from "./actions";
import { CredentialSlips } from "./credential-slips";

export type LoginPerson = { kind: LoginKind; id: string; name: string; hasLogin: boolean };

const ROLE_OPTIONS = [
  { value: "teacher", label: "Teacher" },
  { value: "bursar", label: "Bursar" },
  { value: "admin", label: "School admin" },
];

/** Sign-in status for a student, staff member or parent, with password reset and (staff) portal role. */
export function LoginCard({
  school,
  portalAddress,
  people,
  canCreate,
  staffRole,
}: {
  school: School;
  portalAddress: string;
  people: LoginPerson[];
  canCreate: boolean;
  /** For a staff member with a login: their current portal role, and whether it's the viewer's own. */
  staffRole?: { staffId: string; role: string | null; isSelf: boolean };
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [slip, setSlip] = useState<Credential | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset(p: LoginPerson) {
    if (!window.confirm(`Give ${p.name} a new password? Their old password will stop working.`)) return;
    setBusy(p.id);
    setError(null);
    setSlip(null);
    try {
      const result = await resetPassword(p.kind, p.id);
      if (result.error) setError(result.error);
      else if (result.credentials?.[0]) setSlip(result.credentials[0]);
    } catch {
      setError("The connection dropped. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Portal login" description="Who can sign in, and a new password if someone forgets theirs." />
      <div className="space-y-4 p-5 sm:p-6">
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={`${p.kind}-${p.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-ink-muted">{p.kind === "students" ? "Student" : p.kind === "parents" ? "Parent" : "Staff member"}</p>
              </div>
              {p.hasLogin ? (
                <div className="flex items-center gap-2">
                  <Badge tone="ok">Can sign in</Badge>
                  <Button variant="outline" size="sm" disabled={Boolean(busy) || !canCreate} onClick={() => reset(p)}>
                    {busy === p.id ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
                    Reset password
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge>No login yet</Badge>
                  <Link href="/logins" className={buttonClasses("outline", "sm")}>
                    Create logins
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>

        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        {slip ? (
          <div className="space-y-3 rounded-[var(--radius-card)] bg-brand-wash p-4">
            <p className="text-sm font-semibold">New password created. Print or copy it now; it won&apos;t be shown again.</p>
            <div className="max-w-sm">
              <CredentialSlips school={school} credentials={[slip]} portalAddress={portalAddress} />
            </div>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print slip
            </Button>
          </div>
        ) : null}

        {staffRole ? (
          <ActionForm action={setStaffRole} hidden={{ staff_id: staffRole.staffId }} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <div className="space-y-1.5">
              <label htmlFor="role" className="block text-sm font-bold">
                Portal role
              </label>
              <span className="block w-48">
                <Select id="role" name="role" defaultValue={staffRole.role ?? "teacher"} disabled={staffRole.isSelf}>
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </span>
            </div>
            {staffRole.isSelf ? (
              <p className="pb-3 text-sm text-ink-muted">This is you. Another admin can change your role.</p>
            ) : (
              <SubmitButton variant="outline" pendingLabel="Saving">
                Save role
              </SubmitButton>
            )}
            <p className="basis-full text-sm text-ink-muted">Teachers see their classes. Bursars handle fees. School admins can manage everything in the portal.</p>
          </ActionForm>
        ) : null}
      </div>
    </Card>
  );
}

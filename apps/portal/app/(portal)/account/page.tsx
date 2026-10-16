import type { Metadata } from "next";
import { ROLE_LABELS, displayLogin } from "@kmf/core";
import { Card, CardHeader } from "@kmf/ui";
import { requireViewer } from "@/lib/session";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const { school, viewer } = await requireViewer();
  const roles = viewer.isPlatformAdmin ? "KMF admin" : viewer.roles.map((r) => ROLE_LABELS[r]).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader title="My account" description={`How you sign in to ${school.name}.`} />
        <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-[10rem_1fr] sm:p-6">
          <dt className="text-ink-muted">Name</dt>
          <dd className="font-bold">{viewer.name}</dd>
          <dt className="text-ink-muted">Signs in with</dt>
          <dd className="break-all font-bold">{viewer.email ? displayLogin(viewer.email) : "Not available"}</dd>
          <dt className="text-ink-muted">Access</dt>
          <dd className="font-bold">{roles}</dd>
        </dl>
      </Card>
      <Card>
        <CardHeader title="Change password" description="Choose something you'll remember, at least 8 characters. Don't share it with anyone." />
        <PasswordForm />
      </Card>
    </div>
  );
}

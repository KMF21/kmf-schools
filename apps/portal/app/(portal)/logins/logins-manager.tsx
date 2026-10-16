"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Download, GraduationCap, KeyRound, LoaderCircle, Printer, ShieldCheck, UserRound, Users } from "lucide-react";
import type { School } from "@kmf/core";
import { Badge, Button, Card, CardHeader, IconTile } from "@kmf/ui";
import type { LoginCounts } from "@/lib/logins";
import { createLogins, type Credential, type LoginKind } from "./actions";
import { CredentialSlips } from "./credential-slips";

const GROUPS: Array<{ kind: LoginKind; title: string; icon: React.ReactNode; signsInWith: string; missing: string }> = [
  { kind: "students", title: "Students", icon: <GraduationCap />, signsInWith: "Sign in with their admission number.", missing: "active students" },
  { kind: "parents", title: "Parents", icon: <Users />, signsInWith: "Sign in with their phone number. One login covers all their children.", missing: "parents with a phone number" },
  { kind: "staff", title: "Staff", icon: <UserRound />, signsInWith: "Sign in with their email, or phone number if they have no email. They start as teachers; change roles on each staff page.", missing: "staff with an email or phone" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;

export function LoginsManager({ school, counts, portalAddress, sample }: { school: School; counts: LoginCounts; portalAddress: string; sample: Credential[] | null }) {
  const router = useRouter();
  const [running, setRunning] = useState<LoginKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: LoginKind, missing: number) {
    setRunning(kind);
    setProgress(0);
    setError(null);
    setProblems([]);
    const made: Credential[] = [];
    try {
      // Small batches keep each request short on slow connections.
      for (let round = 0; round < 400; round++) {
        const result = await createLogins(kind);
        if (result.credentials) made.push(...result.credentials);
        if (result.problems?.length) setProblems((p) => [...p, ...result.problems!]);
        setCredentials([...made]);
        setProgress(Math.min(made.length, missing));
        if (result.error) {
          setError(result.error);
          break;
        }
        if (!result.remaining || !result.credentials?.length) break;
      }
    } catch {
      setError("The connection dropped. Logins created so far are shown below; press the button again to continue.");
    } finally {
      setRunning(null);
      router.refresh();
    }
  }

  const shown = sample ?? credentials;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Logins"
          description="Create sign-in details for students, parents and staff, then print slips to hand out."
        />
        {!counts.canCreate && !sample ? (
          <p role="alert" className="mx-5 mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm font-semibold text-warn sm:mx-6">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Logins can&apos;t be created yet because the portal&apos;s secret setting isn&apos;t set up. Ask KMF support to add it.
          </p>
        ) : null}
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
          {GROUPS.map((g) => {
            const c = counts[g.kind];
            const missing = Math.max(0, c.total - c.withLogin);
            const pct = c.total ? Math.round((c.withLogin / c.total) * 100) : 0;
            const busy = running === g.kind;
            return (
              <div key={g.kind} className="flex flex-col rounded-[var(--radius-card)] border border-line p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base">{g.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{g.signsInWith}</p>
                  </div>
                  <IconTile>{g.icon}</IconTile>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold text-ink tabular-nums">
                      {c.withLogin.toLocaleString("en-NG")} of {c.total.toLocaleString("en-NG")}
                    </span>
                    <span className="text-ink-muted">can sign in</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.title} with logins`}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="mt-auto pt-4">
                  {c.total === 0 ? (
                    <p className="text-sm text-ink-faint">No {g.missing} yet.</p>
                  ) : missing === 0 ? (
                    <Badge tone="ok">
                      <ShieldCheck className="size-3.5" aria-hidden /> Everyone has a login
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={Boolean(running) || !counts.canCreate}
                      onClick={() => run(g.kind, missing)}
                    >
                      {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
                      {busy ? `Creating ${progress} of ${missing}` : `Create ${plural(missing, "login")}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {error ? (
          <p role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm font-semibold text-bad sm:mx-6">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        {problems.length ? (
          <div className="mx-5 mb-5 rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm text-warn sm:mx-6">
            <p className="font-bold">{plural(problems.length, "person", "people")} skipped. Fix their details, then create logins again.</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.slice(0, 10).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 10 ? <li>and {problems.length - 10} more</li> : null}
            </ul>
          </div>
        ) : null}
      </Card>

      {shown.length ? (
        <SlipsCard school={school} credentials={shown} portalAddress={portalAddress} isSample={Boolean(sample)} />
      ) : null}
    </div>
  );
}

function SlipsCard({ school, credentials, portalAddress, isSample }: { school: School; credentials: Credential[]; portalAddress: string; isSample: boolean }) {
  function downloadCsv() {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = [["Name", "Class or role", "Login", "Password", "Portal"], ...credentials.map((c) => [c.name, c.detail, c.login, c.password ?? "Uses current password", portalAddress])];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${school.slug}-logins.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Card>
      <CardHeader
        title={isSample ? "Sample login slips" : `${plural(credentials.length, "login slip")} ready`}
        description={
          isSample
            ? "This is what a school prints. These are examples, not real accounts."
            : "Print or download these now. For security, passwords are shown only once; if you leave this page you'll need to reset them."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="size-4" aria-hidden /> Download CSV
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print slips
            </Button>
          </div>
        }
      />
      <div className="p-5 sm:p-6">
        <CredentialSlips school={school} credentials={credentials} portalAddress={portalAddress} />
      </div>
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Globe, Trash2 } from "lucide-react";
import { ROLE_LABELS, type Role } from "@kmf/core";
import { Avatar, Badge, Card, CardHeader, Field, Input, Select, buttonClasses } from "@kmf/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-bits";
import { SchoolMark } from "@/components/school-mark";
import { formatDate, formatNumber } from "@/lib/format";
import { getSchoolDetail, platformAddress, schoolPortalLink } from "@/lib/platform";
import { addDomain, markDomainWorking, removeDomain, setSchoolStatus } from "../../../actions";
import { StatusBadge } from "../../status-badge";
import { getBilling } from "@/lib/billing";
import { BillingCard } from "./billing-card";
import { ManagerForm } from "./manager-form";
import { ResetManager } from "./reset-manager";

export const metadata: Metadata = { title: "School" };

export default async function AdminSchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const school = await getSchoolDetail(id);
  if (!school) notFound();
  const [portal, billing] = await Promise.all([schoolPortalLink(school.slug), getBilling(school.id)]);

  return (
    <div className="space-y-4">
      <Link href="/admin" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All schools
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <SchoolMark school={{ ...school, motto: null, address: null }} size={56} />
          <div className="min-w-0 flex-1 basis-56">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl">{school.name}</h1>
              <StatusBadge status={school.status} />
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {platformAddress(school.slug)} · {formatNumber(school.students)} active students · added {formatDate(school.createdAt)}
            </p>
          </div>
          {school.status === "suspended" ? null : (
            <a href={portal} className={buttonClasses("solid", "sm")}>
              Open portal <ArrowUpRight className="size-4" aria-hidden />
            </a>
          )}
        </div>
        <ActionForm action={setSchoolStatus} hidden={{ school_id: school.id }} className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4 sm:px-6">
          <Field label="Status" htmlFor="status">
            <span className="block w-56">
              <Select id="status" name="status" defaultValue={school.status}>
                <option value="setup">Setting up</option>
                <option value="active">Live</option>
                <option value="suspended">Suspended (portal closed)</option>
              </Select>
            </span>
          </Field>
          <SubmitButton variant="outline" pendingLabel="Saving">
            Save status
          </SubmitButton>
        </ActionForm>
      </Card>

      <BillingCard schoolId={school.id} plan={billing.plan} invoices={billing.invoices} activeStudents={school.students} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Proprietor and admins" description="People who manage this school. They add teachers, students and parents themselves." />
          <div className="space-y-5 p-5 sm:p-6">
            {school.managers.length ? (
              <ul className="divide-y divide-line">
                {school.managers.map((m) => (
                  <ResetManager key={`${m.userId}-${m.role}`} schoolId={school.id} userId={m.userId} name={m.name}>
                    <Avatar name={m.name} size={34} />
                    <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
                    <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE_LABELS[m.role as Role] ?? m.role}</Badge>
                  </ResetManager>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nobody can manage this school yet. Give the proprietor a login.</p>
            )}
            <div className="border-t border-line pt-4">
              <ManagerForm schoolId={school.id} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Web addresses" description={`Works now at ${platformAddress(school.slug)}. Add the school's own domain if it has one.`} />
          <div className="space-y-5 p-5 sm:p-6">
            {school.domainRows.length ? (
              <ul className="divide-y divide-line">
                {school.domainRows.map((d) => (
                  <li key={d.hostname} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0">
                    <Globe className="size-4 text-ink-muted" aria-hidden />
                    <span className="min-w-0 flex-1 break-all font-bold">{d.hostname}</span>
                    <Badge>{d.kind === "portal" ? "Portal" : "Website"}</Badge>
                    {d.verifiedAt ? (
                      <Badge tone="ok">Working</Badge>
                    ) : (
                      <ActionForm action={markDomainWorking} hidden={{ school_id: school.id, hostname: d.hostname }} className="contents" messageClassName="hidden">
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Saving">
                          Mark working
                        </SubmitButton>
                      </ActionForm>
                    )}
                    <ActionForm action={removeDomain} hidden={{ school_id: school.id, hostname: d.hostname }} confirm={`Remove ${d.hostname}? The school will stop opening on it.`} className="contents" messageClassName="hidden">
                      <button type="submit" className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-bad-soft hover:text-bad" aria-label={`Remove ${d.hostname}`} title="Remove">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            ) : null}

            <ActionForm action={addDomain} hidden={{ school_id: school.id }} resetOnSuccess className="space-y-3 border-t border-line pt-4 first:border-0 first:pt-0">
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <Field label="Domain" htmlFor="hostname">
                  <Input id="hostname" name="hostname" placeholder="portal.brightfield.com.ng" autoCapitalize="none" spellCheck={false} maxLength={253} required />
                </Field>
                <Field label="Used for" htmlFor="kind">
                  <Select id="kind" name="kind" defaultValue="portal">
                    <option value="portal">Portal</option>
                    <option value="website">Website</option>
                  </Select>
                </Field>
              </div>
              <SubmitButton variant="outline" pendingLabel="Adding">
                Add domain
              </SubmitButton>
            </ActionForm>

            <details className="rounded-[var(--radius-control)] bg-surface-sunk p-4 text-sm">
              <summary className="cursor-pointer font-bold">How to connect a domain</summary>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-muted">
                <li>Add the domain here.</li>
                <li>In Vercel, open the kmf-schools project, then Settings, Domains, and add the same domain.</li>
                <li>
                  At the school&apos;s domain registrar, add the record Vercel shows. Usually a <span className="font-semibold text-ink">CNAME</span> to{" "}
                  <code className="font-semibold text-ink">cname.vercel-dns.com</code> for an address like portal.school.com.ng, or an{" "}
                  <span className="font-semibold text-ink">A record</span> to <code className="font-semibold text-ink">76.76.21.21</code> for the bare domain.
                </li>
                <li>When Vercel shows the domain as valid, open it to check, then press Mark working.</li>
              </ol>
            </details>
          </div>
        </Card>
      </div>
    </div>
  );
}

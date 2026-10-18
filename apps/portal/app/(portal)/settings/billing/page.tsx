import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState } from "@kmf/ui";
import { getBilling, isOverdue, PLAN_LABELS } from "@/lib/billing";
import { formatDate, formatNaira } from "@/lib/format";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Billing" };

const KMF_SUPPORT = "https://wa.me/2349110137795";

export default async function BillingPage() {
  const { school } = await requireViewer(["owner", "admin"]);
  const { plan, invoices } = await getBilling(school.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Your KMF Schools plan" description="Set up by KMF. Contact KMF support to change it." />
        <dl className="grid gap-x-6 gap-y-3 px-5 py-5 text-sm sm:grid-cols-[12rem_1fr] sm:px-6">
          <dt className="text-ink-muted">Plan</dt>
          <dd className="font-bold">{PLAN_LABELS[plan.plan]}</dd>
          {plan.plan === "per_student" ? (
            <>
              <dt className="text-ink-muted">Rate</dt>
              <dd className="font-bold">
                {formatNaira(plan.rate)} per active student, per term (minimum {plan.minimumStudents} students)
              </dd>
            </>
          ) : null}
          {plan.plan === "yearly" ? (
            <>
              <dt className="text-ink-muted">Amount</dt>
              <dd className="font-bold">{formatNaira(plan.yearlyAmount)} per session</dd>
            </>
          ) : null}
          {plan.plan !== "free" ? (
            <>
              <dt className="text-ink-muted">Publishing results</dt>
              <dd>Open once the invoice for the term is paid, or within {plan.graceDays} days of the invoice date.</dd>
            </>
          ) : null}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Invoices"
          action={
            <a href={KMF_SUPPORT} target="_blank" rel="noreferrer" className="text-sm font-bold text-brand-text underline-offset-4 hover:underline">
              Questions? Chat with KMF support
            </a>
          }
        />
        {invoices.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No invoices yet">
            Invoices from KMF appear here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {invoices.map((inv) => {
              const overdue = isOverdue(inv);
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-bold">{inv.label}</p>
                    <p className="text-sm text-ink-muted">
                      {inv.rate ? `${inv.studentCount} students × ${formatNaira(inv.rate)} · ` : ""}
                      {inv.status === "unpaid" ? `Due ${formatDate(inv.dueOn)}` : `${inv.status === "paid" ? "Paid" : "Waived"} ${formatDate(inv.paidAt)}`}
                    </p>
                  </div>
                  <span className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums">{formatNaira(inv.amount)}</span>
                  {inv.status === "paid" ? (
                    <Badge tone="ok">Paid</Badge>
                  ) : inv.status === "waived" ? (
                    <Badge tone="info">Waived</Badge>
                  ) : (
                    <Badge tone={overdue ? "bad" : "warn"}>{overdue ? "Overdue" : "Unpaid"}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

import { CalendarPlus, Receipt, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, Input } from "@kmf/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-bits";
import { isOverdue, termAmount, type BillingPlan, type Invoice } from "@/lib/billing";
import { formatDate, formatNaira } from "@/lib/format";
import { createInvoice, deleteInvoice, extendInvoice, recountInvoice, setInvoiceStatus } from "../../../actions";
import { PlanForm } from "./plan-form";

/** KMF's view of one school's plan and invoices. */
export function BillingCard({ schoolId, plan, invoices, activeStudents }: { schoolId: string; plan: BillingPlan; invoices: Invoice[]; activeStudents: number }) {
  const estimate = termAmount(plan, activeStudents);
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Receipt className="size-4" aria-hidden /> Billing
          </span>
        }
        description="The school can publish results once the term's invoice is paid, or while it's within the grace period."
      />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <PlanForm schoolId={schoolId} plan={plan} />

        <div className="space-y-4">
          {plan.plan !== "free" ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-surface-sunk p-4">
              <p className="min-w-0 flex-1 text-sm">
                {plan.plan === "yearly" ? (
                  <>
                    Yearly invoice: <span className="font-bold">{formatNaira(plan.yearlyAmount)}</span> for the current session.
                  </>
                ) : (
                  <>
                    {activeStudents} active students{activeStudents < plan.minimumStudents ? ` (billed as the minimum of ${plan.minimumStudents})` : ""} × {formatNaira(plan.rate)} ={" "}
                    <span className="font-bold">{formatNaira(estimate.amount)}</span> for the current term.
                  </>
                )}
              </p>
              <ActionForm action={createInvoice} hidden={{ school_id: schoolId }} className="flex flex-wrap items-center gap-2">
                <SubmitButton size="sm" pendingLabel="Creating">
                  <CalendarPlus className="size-4" aria-hidden /> Create invoice
                </SubmitButton>
              </ActionForm>
            </div>
          ) : (
            <p className="rounded-[var(--radius-control)] bg-surface-sunk p-4 text-sm text-ink-muted">Free plan: this school publishes results without an invoice.</p>
          )}

          {invoices.length === 0 ? (
            <p className="text-sm text-ink-muted">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {invoices.map((inv) => {
                const overdue = isOverdue(inv);
                return (
                  <li key={inv.id} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{inv.label}</span>
                      {inv.status === "paid" ? (
                        <Badge tone="ok">Paid</Badge>
                      ) : inv.status === "waived" ? (
                        <Badge tone="info">Waived</Badge>
                      ) : overdue ? (
                        <Badge tone="bad">Overdue</Badge>
                      ) : (
                        <Badge tone="warn">Unpaid</Badge>
                      )}
                      <span className="ml-auto font-[family-name:var(--font-display)] text-lg font-bold tabular-nums">{formatNaira(inv.amount)}</span>
                    </div>
                    <p className="text-sm text-ink-muted">
                      {inv.rate ? `${inv.studentCount} students × ${formatNaira(inv.rate)} · ` : ""}
                      {inv.status === "unpaid" ? `Due ${formatDate(inv.dueOn)}` : `${inv.status === "paid" ? "Paid" : "Waived"} ${formatDate(inv.paidAt)}${inv.paymentNote ? ` · ${inv.paymentNote}` : ""}`}
                    </p>
                    {inv.status === "unpaid" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionForm action={setInvoiceStatus} hidden={{ school_id: schoolId, invoice_id: inv.id, status: "paid" }} className="flex flex-wrap items-center gap-2">
                          <span className="block w-44">
                            <Input name="note" placeholder="Payment reference" maxLength={120} className="h-9 text-sm" aria-label="Payment reference" />
                          </span>
                          <SubmitButton size="sm" pendingLabel="Saving">
                            Mark paid
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={extendInvoice} hidden={{ school_id: schoolId, invoice_id: inv.id, days: "7" }}>
                          <SubmitButton variant="outline" size="sm" pendingLabel="Saving">
                            Give 7 more days
                          </SubmitButton>
                        </ActionForm>
                        {inv.termId ? (
                          <ActionForm action={recountInvoice} hidden={{ school_id: schoolId, invoice_id: inv.id }}>
                            <SubmitButton variant="ghost" size="sm" pendingLabel="Counting">
                              <RefreshCw className="size-4" aria-hidden /> Recount students
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                        <ActionForm action={setInvoiceStatus} hidden={{ school_id: schoolId, invoice_id: inv.id, status: "waived" }} confirm="Waive this invoice? The school won't pay for this period.">
                          <SubmitButton variant="ghost" size="sm" pendingLabel="Saving">
                            Waive
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={deleteInvoice} hidden={{ school_id: schoolId, invoice_id: inv.id }} confirm="Delete this invoice?" messageClassName="hidden">
                          <button type="submit" className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-bad-soft hover:text-bad" aria-label="Delete invoice" title="Delete">
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </ActionForm>
                      </div>
                    ) : (
                      <ActionForm action={setInvoiceStatus} hidden={{ school_id: schoolId, invoice_id: inv.id, status: "unpaid" }} confirm="Mark this invoice as unpaid again?">
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Saving">
                          Undo
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

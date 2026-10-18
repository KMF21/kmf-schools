"use client";

import { useState } from "react";
import { Field, Input, Select } from "@kmf/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-bits";
import { PLAN_LABELS, type BillingPlan, type PlanKind } from "@/lib/billing-shared";
import { saveBillingPlan } from "../../../actions";

const HELP: Record<PlanKind, string> = {
  per_student: "Invoiced each term: active students × rate, never below the minimum.",
  yearly: "One fixed invoice per session, covering all three terms.",
  free: "No invoices. The school can always publish results.",
};

/** The billing plan, showing only the boxes that apply to the chosen plan. */
export function PlanForm({ schoolId, plan }: { schoolId: string; plan: BillingPlan }) {
  const [kind, setKind] = useState<PlanKind>(plan.plan);

  // Boxes for other plans are hidden but keep their saved values, so switching back loses nothing.
  const keep = (name: string, value: number) => <input type="hidden" name={name} value={value} />;

  return (
    <ActionForm action={saveBillingPlan} hidden={{ school_id: schoolId }} className="space-y-4">
      <Field label="Plan" htmlFor="plan" hint={HELP[kind]}>
        <Select id="plan" name="plan" value={kind} onChange={(e) => setKind(e.target.value as PlanKind)} aria-describedby="plan-hint">
          {Object.entries(PLAN_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>

      {kind === "per_student" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rate per student (₦)" htmlFor="rate">
            <Input id="rate" name="rate" inputMode="numeric" defaultValue={plan.rate} />
          </Field>
          <Field label="Minimum students" htmlFor="minimum_students">
            <Input id="minimum_students" name="minimum_students" inputMode="numeric" defaultValue={plan.minimumStudents} />
          </Field>
        </div>
      ) : (
        <>
          {keep("rate", plan.rate)}
          {keep("minimum_students", plan.minimumStudents)}
        </>
      )}

      {kind === "yearly" ? (
        <Field label="Amount per session (₦)" htmlFor="yearly_amount">
          <Input id="yearly_amount" name="yearly_amount" inputMode="numeric" defaultValue={plan.yearlyAmount} />
        </Field>
      ) : (
        keep("yearly_amount", plan.yearlyAmount)
      )}

      {kind !== "free" ? (
        <Field label="Days to pay" htmlFor="grace_days" hint="After an invoice is created, results can be published for this many days before payment.">
          <Input id="grace_days" name="grace_days" inputMode="numeric" defaultValue={plan.graceDays} aria-describedby="grace_days-hint" />
        </Field>
      ) : (
        keep("grace_days", plan.graceDays)
      )}

      <Field label="Notes" htmlFor="notes" hint="Only KMF sees this, e.g. agreed discount.">
        <Input id="notes" name="notes" defaultValue={plan.notes ?? ""} maxLength={200} aria-describedby="notes-hint" />
      </Field>
      <SubmitButton variant="outline" pendingLabel="Saving">
        Save plan
      </SubmitButton>
    </ActionForm>
  );
}

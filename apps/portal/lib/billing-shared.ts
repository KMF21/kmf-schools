/* Billing types and sums that are safe to use in the browser too. */

export type PlanKind = "per_student" | "yearly" | "free";
export type BillingPlan = { plan: PlanKind; rate: number; minimumStudents: number; yearlyAmount: number; graceDays: number; notes: string | null };
export type InvoiceStatus = "unpaid" | "paid" | "waived";
export type Invoice = {
  id: string;
  label: string;
  termId: string | null;
  sessionId: string;
  studentCount: number | null;
  rate: number | null;
  amount: number;
  status: InvoiceStatus;
  dueOn: string;
  paidAt: string | null;
  paymentNote: string | null;
  createdAt: string;
};

export const PLAN_LABELS: Record<PlanKind, string> = { per_student: "Per student, per term", yearly: "Yearly", free: "Free (no billing)" };
export const DEFAULT_PLAN: BillingPlan = { plan: "per_student", rate: 2000, minimumStudents: 200, yearlyAmount: 1000000, graceDays: 14, notes: null };

/** Amount for a per-student term invoice: students × rate, with the minimum. */
export function termAmount(plan: BillingPlan, students: number): { billed: number; amount: number } {
  const billed = Math.max(students, plan.minimumStudents);
  return { billed, amount: billed * plan.rate };
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

/** Unpaid and past its due date. */
export function isOverdue(inv: Invoice): boolean {
  return inv.status === "unpaid" && inv.dueOn < today();
}

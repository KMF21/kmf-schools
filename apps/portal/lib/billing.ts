import { cache } from "react";
import type { School } from "@kmf/core";
import { IS_DEMO } from "./env";
import { supabaseForRequest } from "./supabase";

/* KMF billing: each school's plan and termly (or yearly) invoices. Only KMF changes these. */

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

const DEMO_INVOICES: Invoice[] = [
  {
    id: "demo-invoice-1",
    label: "First term, 2026/2027",
    termId: "demo-term-1",
    sessionId: "demo-session",
    studentCount: 340,
    rate: 2000,
    amount: 680000,
    status: "paid",
    dueOn: "2026-10-23",
    paidAt: "2026-10-15T10:00:00Z",
    paymentNote: "Bank transfer",
    createdAt: "2026-10-09T09:00:00Z",
  },
];

type PlanRow = { plan: PlanKind; rate: number; minimum_students: number; yearly_amount: number; grace_days: number; notes: string | null };
type InvoiceRow = {
  id: string;
  label: string;
  term_id: string | null;
  session_id: string;
  student_count: number | null;
  rate: number | null;
  amount: number;
  status: InvoiceStatus;
  due_on: string;
  paid_at: string | null;
  payment_note: string | null;
  created_at: string;
};

const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  label: r.label,
  termId: r.term_id,
  sessionId: r.session_id,
  studentCount: r.student_count,
  rate: r.rate === null ? null : Number(r.rate),
  amount: Number(r.amount),
  status: r.status,
  dueOn: r.due_on,
  paidAt: r.paid_at,
  paymentNote: r.payment_note,
  createdAt: r.created_at,
});

/** A school's plan and invoices, newest first. Readable by KMF and the school's managers. */
export const getBilling = cache(async (schoolId: string): Promise<{ plan: BillingPlan; invoices: Invoice[] }> => {
  if (IS_DEMO) return { plan: DEFAULT_PLAN, invoices: DEMO_INVOICES };
  const supabase = await supabaseForRequest();
  const [plan, invoices] = await Promise.all([
    supabase.from("billing_plans").select("plan, rate, minimum_students, yearly_amount, grace_days, notes").eq("school_id", schoolId).maybeSingle(),
    supabase
      .from("invoices")
      .select("id, label, term_id, session_id, student_count, rate, amount, status, due_on, paid_at, payment_note, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  const p = plan.data as PlanRow | null;
  return {
    plan: p
      ? { plan: p.plan, rate: Number(p.rate), minimumStudents: p.minimum_students, yearlyAmount: Number(p.yearly_amount), graceDays: p.grace_days, notes: p.notes }
      : DEFAULT_PLAN,
    invoices: ((invoices.data ?? []) as InvoiceRow[]).map(toInvoice),
  };
});

export type PublishStatus = { allowed: boolean; message: string | null; invoice: Invoice | null };

/**
 * Whether a school may publish results for a term. Mirrors private.can_publish
 * in the database, which has the final say.
 */
export async function getPublishStatus(school: School, term: { id: string; sessionId: string }, isPlatformAdmin: boolean): Promise<PublishStatus> {
  if (isPlatformAdmin) return { allowed: true, message: null, invoice: null };
  const { plan, invoices } = await getBilling(school.id);
  if (plan.plan === "free") return { allowed: true, message: null, invoice: null };
  const invoice = invoices.find((i) => i.termId === term.id) ?? invoices.find((i) => i.termId === null && i.sessionId === term.sessionId) ?? null;
  if (!invoice) {
    return { allowed: false, message: "Publishing opens once KMF sends this term's invoice. Contact KMF support.", invoice: null };
  }
  if (invoice.status !== "unpaid") return { allowed: true, message: null, invoice };
  if (!isOverdue(invoice)) return { allowed: true, message: null, invoice };
  return { allowed: false, message: "Publishing is locked because this term's KMF invoice is overdue. It opens again as soon as it's paid.", invoice };
}

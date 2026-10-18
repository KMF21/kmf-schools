"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightLeft, LoaderCircle } from "lucide-react";
import { Avatar, Badge, Button, Select, cx } from "@kmf/ui";
import { FormMessage } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import type { StudentRow } from "@/lib/data";
import { moveStudents } from "./actions";

const STATUS: Record<string, { label: string; tone: "ok" | "neutral" | "info" | "warn" }> = {
  active: { label: "Active", tone: "ok" },
  graduated: { label: "Graduated", tone: "info" },
  withdrawn: { label: "Left", tone: "neutral" },
  suspended: { label: "Suspended", tone: "warn" },
};

/** Student list. Managers can tick students and move them to another class. */
export function StudentTable({ students, canManage, arms }: { students: StudentRow[]; canManage: boolean; arms: Array<{ id: string; label: string }> }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const movable = students.filter((s) => s.status === "active");
  const allPicked = movable.length > 0 && movable.every((s) => picked.has(s.id));

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const move = () => {
    if (!target || picked.size === 0) return;
    const label = arms.find((a) => a.id === target)?.label ?? "the class";
    if (!window.confirm(`Move ${picked.size} ${picked.size === 1 ? "student" : "students"} to ${label}?`)) return;
    start(async () => {
      const result = await moveStudents({ studentIds: [...picked], armId: target });
      setState(result);
      if (result.ok) setPicked(new Set());
    });
  };

  return (
    <>
      {canManage && (picked.size > 0 || state.ok || state.error) ? (
        <div className="sticky top-2 z-20 mx-3 my-3 space-y-2 rounded-[var(--radius-card)] border border-brand-line bg-brand-wash p-3 shadow-[var(--shadow-card)] sm:mx-5">
          {picked.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">{picked.size} ticked</span>
              <span className="block w-48">
                <Select aria-label="Move to class" value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 text-sm">
                  <option value="">Move to class…</option>
                  {arms.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </span>
              <Button size="sm" onClick={move} disabled={!target || pending}>
                {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ArrowRightLeft className="size-4" aria-hidden />}
                Move
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
                Clear
              </Button>
            </div>
          ) : null}
          <FormMessage state={state} />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-surface-sunk text-xs text-ink-muted">
            <tr>
              {canManage ? (
                <th scope="col" className="w-10 py-3 pl-5">
                  <input
                    type="checkbox"
                    aria-label="Tick all students shown"
                    checked={allPicked}
                    onChange={() => setPicked(allPicked ? new Set() : new Set(movable.map((s) => s.id)))}
                    className="size-4 accent-[var(--brand)]"
                  />
                </th>
              ) : null}
              <th scope="col" className={cx("py-3 font-bold", canManage ? "px-3" : "px-6")}>Name</th>
              <th scope="col" className="px-4 py-3 font-bold">Admission number</th>
              <th scope="col" className="px-4 py-3 font-bold">Class</th>
              <th scope="col" className="px-4 py-3 font-bold">Gender</th>
              <th scope="col" className="px-6 py-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((s) => {
              const st = STATUS[s.status] ?? { label: s.status, tone: "neutral" as const };
              return (
                <tr key={s.id} className={cx("hover:bg-brand-wash", picked.has(s.id) && "bg-brand-wash")}>
                  {canManage ? (
                    <td className="py-3 pl-5">
                      {s.status === "active" ? (
                        <input type="checkbox" aria-label={`Tick ${s.name}`} checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[var(--brand)]" />
                      ) : null}
                    </td>
                  ) : null}
                  <td className={cx("py-3", canManage ? "px-3" : "px-6")}>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} size={34} />
                      {canManage ? (
                        <Link href={`/students/${s.id}`} className="font-bold text-ink underline-offset-4 hover:text-brand-text hover:underline">
                          {s.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-ink">{s.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted tabular-nums">{s.admissionNo}</td>
                  <td className="px-4 py-3">{s.className}</td>
                  <td className="px-4 py-3 text-ink-muted capitalize">{s.gender ?? "Not recorded"}</td>
                  <td className="px-6 py-3">
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

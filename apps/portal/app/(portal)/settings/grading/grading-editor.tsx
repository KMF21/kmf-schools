"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { validateScale, type GradeBand } from "@kmf/core";
import { Button, cx } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import type { SectionGrading } from "@/lib/structure";
import { saveGrading } from "./actions";

type Comp = { id: string | null; name: string; maxScore: number };

const NO_SPIN = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const cell =
  "h-10 w-full rounded-[0.625rem] border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none aria-[invalid=true]:border-bad";

export function GradingEditor({ grading }: { grading: SectionGrading }) {
  const [state, action] = useActionState<ActionState, FormData>(saveGrading, {});
  const [comps, setComps] = useState<Comp[]>(grading.components.map((c) => ({ id: isUuid(c.id) ? c.id : null, name: c.name, maxScore: c.maxScore })));
  const [bands, setBands] = useState<GradeBand[]>([...grading.scale.bands].sort((a, b) => b.min - a.min));

  const total = comps.reduce((n, c) => n + (Number.isFinite(c.maxScore) ? c.maxScore : 0), 0);
  const totalOk = Math.abs(total - 100) < 0.001;
  const scaleProblems = validateScale(bands);

  const setComp = (i: number, patch: Partial<Comp>) => setComps((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setBand = (i: number, patch: Partial<GradeBand>) => setBands((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const num = (v: string) => (v === "" ? NaN : Number(v));

  return (
    <form action={action} className="space-y-6 px-5 py-5 sm:px-6">
      <input type="hidden" name="section_id" value={grading.sectionId} />
      <input type="hidden" name="scale_name" value={grading.scale.name} />
      <input type="hidden" name="components" value={JSON.stringify(comps)} />
      <input type="hidden" name="bands" value={JSON.stringify(bands)} />
      <FormMessage state={state} />

      <div className="grid gap-8 lg:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold">CA and exam scores</legend>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr>
                <th className="pb-1.5 font-bold">Name</th>
                <th className="w-24 pb-1.5 font-bold">Out of</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {comps.map((c, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input aria-label={`Name of score ${i + 1}`} className={cell} value={c.name} maxLength={30} onChange={(e) => setComp(i, { name: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`${c.name || `Score ${i + 1}`} out of`}
                      className={cx(cell, NO_SPIN, "tabular-nums")}
                      type="number"
                      min={1}
                      max={100}
                      inputMode="numeric"
                      value={Number.isNaN(c.maxScore) ? "" : c.maxScore}
                      onChange={(e) => setComp(i, { maxScore: num(e.target.value) })}
                    />
                  </td>
                  <td className="py-1">
                    <Button variant="ghost" size="sm" className="px-2" disabled={comps.length <= 1} onClick={() => setComps((cs) => cs.filter((_, j) => j !== i))} aria-label={`Remove ${c.name || "this score"}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={comps.length >= 8} onClick={() => setComps((cs) => [...cs, { id: null, name: `CA ${cs.length}`, maxScore: 10 }])}>
              <Plus className="size-4" aria-hidden /> Add a CA or exam
            </Button>
            <p className={cx("text-sm font-bold tabular-nums", totalOk ? "text-ok" : "text-bad")} aria-live="polite">
              Total {total || 0} of 100{totalOk ? "" : ", must be exactly 100"}
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold">Grades ({grading.scale.name})</legend>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr>
                <th className="w-[3.25rem] pb-1.5 font-bold sm:w-[4.5rem]">From</th>
                <th className="w-[3.25rem] pb-1.5 font-bold sm:w-[4.5rem]">To</th>
                <th className="w-[3.25rem] pb-1.5 font-bold sm:w-[4.5rem]">Grade</th>
                <th className="pb-1.5 font-bold">Remark</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {bands.map((b, i) => (
                <tr key={i}>
                  {(["min", "max"] as const).map((k) => (
                    <td key={k} className="py-1 pr-2">
                      <input
                        aria-label={`${b.grade || `Grade ${i + 1}`} ${k === "min" ? "from" : "to"}`}
                        className={cx(cell, NO_SPIN, "px-1 text-center tabular-nums sm:px-2")}
                        type="number"
                        min={0}
                        max={100}
                        inputMode="numeric"
                        value={Number.isNaN(b[k]) ? "" : b[k]}
                        onChange={(e) => setBand(i, { [k]: num(e.target.value) })}
                      />
                    </td>
                  ))}
                  <td className="py-1 pr-2">
                    <input aria-label={`Grade label ${i + 1}`} className={cx(cell, "px-1 text-center font-bold sm:px-2")} value={b.grade} maxLength={4} onChange={(e) => setBand(i, { grade: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2">
                    <input aria-label={`Remark for ${b.grade || `grade ${i + 1}`}`} className={cell} value={b.remark} maxLength={30} onChange={(e) => setBand(i, { remark: e.target.value })} />
                  </td>
                  <td className="py-1">
                    <Button variant="ghost" size="sm" className="px-2" disabled={bands.length <= 2} onClick={() => setBands((bs) => bs.filter((_, j) => j !== i))} aria-label={`Remove grade ${b.grade}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={bands.length >= 15} onClick={() => setBands((bs) => [...bs, { min: 0, max: 0, grade: "", remark: "" }])}>
              <Plus className="size-4" aria-hidden /> Add a grade
            </Button>
            <p className={cx("text-sm font-bold", scaleProblems.length ? "text-bad" : "text-ok")} aria-live="polite">
              {scaleProblems.length ? scaleProblems[0] : "Covers 0 to 100 with no gaps"}
            </p>
          </div>
        </fieldset>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving">Save grading</SubmitButton>
      </div>
    </form>
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

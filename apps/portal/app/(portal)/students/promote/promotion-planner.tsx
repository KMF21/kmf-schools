"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, LoaderCircle, Shuffle } from "lucide-react";
import { Badge, Button, Card, CardHeader, Select, buttonClasses, cx } from "@kmf/ui";
import { FormMessage } from "@/components/form-bits";
import type { Destination, PromoClass } from "@/lib/promotion";
import { promoteStudents, type PromoteResult } from "../actions";

/** A choice for one student: "move:<armId>", "stay", "graduate" or "withdraw". */
type Choice = string;
type PlannerClass = PromoClass & { defaultChoice: Choice };

const SPECIAL: Record<string, string> = { stay: "Repeats (stays in this class)", graduate: "Graduates", withdraw: "Leaves the school" };

export function PromotionPlanner({ fromSession, classes, destinations }: { fromSession: string; classes: PlannerClass[]; destinations: Destination[] }) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() => Object.fromEntries(classes.flatMap((c) => c.students.map((s) => [s.id, c.defaultChoice]))));
  const [passMark, setPassMark] = useState("40");
  const [result, setResult] = useState<PromoteResult>({});
  const [pending, start] = useTransition();
  const mark = Number(passMark);

  const labelOf = useMemo(() => new Map(destinations.map((d) => [d.armId, d.label])), [destinations]);
  const describe = (c: Choice, fromLabel: string) => (c.startsWith("move:") ? (labelOf.get(c.slice(5)) ?? "Another class") : c === "stay" ? `Repeats ${fromLabel}` : SPECIAL[c]!);

  const set = (ids: string[], choice: Choice) => setChoices((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, choice])) }));

  // Totals for the summary, by where students end up.
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of classes) {
      for (const s of c.students) {
        const ch = choices[s.id] ?? c.defaultChoice;
        const key = ch === "stay" ? `move:${c.armId}` : ch;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const order = [...destinations.map((d) => `move:${d.armId}`), "graduate", "withdraw"];
    return order.filter((k) => counts.has(k)).map((k) => ({ key: k, label: k.startsWith("move:") ? labelOf.get(k.slice(5))! : SPECIAL[k]!, count: counts.get(k)! }));
  }, [choices, classes, destinations, labelOf]);
  const total = classes.reduce((n, c) => n + c.students.length, 0);

  const confirm = () => {
    if (!window.confirm(`Promote ${total} students now? Check the summary first. This changes every student's class at once.`)) return;
    const moves = classes.flatMap((c) =>
      c.students.map((s) => {
        const ch = choices[s.id] ?? c.defaultChoice;
        if (ch.startsWith("move:")) {
          const armId = ch.slice(5);
          return armId === c.armId ? { studentId: s.id, action: "stay" as const } : { studentId: s.id, action: "move" as const, armId };
        }
        return { studentId: s.id, action: ch as "stay" | "graduate" | "withdraw" };
      }),
    );
    start(async () => setResult(await promoteStudents({ fromSession, moves })));
  };

  if (result.ok && result.summary) {
    const r = result.summary;
    return (
      <Card>
        <div className="space-y-4 p-6">
          <p className="flex items-center gap-2 text-lg font-bold text-ok">
            <CircleCheck className="size-6" aria-hidden /> Students promoted
          </p>
          <p className="text-sm text-ink-muted">
            {r.moved} moved up or to another class, {r.stayed} repeating, {r.graduated} graduated, {r.withdrawn} left the school.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/calendar" className={buttonClasses("solid", "md")}>
              Next: set the new session
            </Link>
            <Link href="/students" className={buttonClasses("outline", "md")}>
              See students
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          <label htmlFor="pass-mark" className="text-sm font-bold">
            Flag students with a yearly average below
          </label>
          <span className="block w-24">
            <input
              id="pass-mark"
              inputMode="decimal"
              value={passMark}
              onChange={(e) => setPassMark(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-10 w-full rounded-full border border-line-strong bg-surface px-4 text-sm focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </span>
          <span className="text-sm text-ink-muted">Flags are only a guide. You decide who repeats.</span>
        </div>
      </Card>

      <div className="space-y-3">
        {classes.map((c) => (
          <ClassPlan key={c.armId} cls={c} choices={choices} set={set} destinations={destinations} describe={describe} passMark={Number.isFinite(mark) ? mark : 0} />
        ))}
      </div>

      <Card>
        <CardHeader title="Summary" description={`${total} students. Nothing changes until you press Promote.`} />
        <div className="flex flex-wrap gap-2 px-5 py-3 sm:px-6">
          {summary.map((s) => (
            <Badge key={s.key} tone={s.key === "graduate" ? "info" : s.key === "withdraw" ? "neutral" : "brand"}>
              {s.label}: {s.count}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3 sm:px-6">
          <FormMessage state={result.error ? result : {}} className="flex-1" />
          <Button onClick={confirm} disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {pending ? "Promoting" : `Promote ${total} students`}
          </Button>
        </div>
      </Card>
    </>
  );
}

function DestinationOptions({ destinations, fromLabel }: { destinations: Destination[]; fromLabel: string }) {
  const groups = [...new Set(destinations.map((d) => d.levelName))];
  return (
    <>
      <optgroup label="Special">
        <option value="stay">Repeats {fromLabel}</option>
        <option value="graduate">Graduates</option>
        <option value="withdraw">Leaves the school</option>
      </optgroup>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {destinations
            .filter((d) => d.levelName === g)
            .map((d) => (
              <option key={d.armId} value={`move:${d.armId}`}>
                Move to {d.label}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

function ClassPlan({
  cls,
  choices,
  set,
  destinations,
  describe,
  passMark,
}: {
  cls: PlannerClass;
  choices: Record<string, Choice>;
  set: (ids: string[], choice: Choice) => void;
  destinations: Destination[];
  describe: (c: Choice, fromLabel: string) => string;
  passMark: number;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState("");
  const [splitArms, setSplitArms] = useState<string[]>([]);
  const [splitBy, setSplitBy] = useState<"result" | "name">("result");
  const [showSplit, setShowSplit] = useState(false);
  const ids = cls.students.map((s) => s.id);
  const flagged = cls.students.filter((s) => s.average !== null && s.average < passMark).length;

  // What most of the class is doing, for the one-line summary.
  const mains = new Map<string, number>();
  for (const id of ids) mains.set(choices[id]!, (mains.get(choices[id]!) ?? 0) + 1);
  const main = [...mains.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const others = ids.length - (mains.get(main) ?? 0);

  const splitOptions = destinations.filter((d) => cls.nextLevelArms.includes(d.armId) || d.levelId === cls.levelId);

  const split = () => {
    if (splitArms.length < 2) return;
    const order =
      splitBy === "name"
        ? [...cls.students].sort((a, b) => a.name.localeCompare(b.name))
        : [...cls.students].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
    const k = splitArms.length;
    const next: Record<string, Choice> = {};
    order.forEach((s, i) => {
      // By name: blocks (A–M, N–Z). By result: snake order, so each class gets a fair mix.
      const idx = splitBy === "name" ? Math.min(k - 1, Math.floor((i * k) / order.length)) : Math.floor(i / k) % 2 === 0 ? i % k : k - 1 - (i % k);
      next[s.id] = `move:${splitArms[idx]}`;
    });
    for (const [id, ch] of Object.entries(next)) set([id], ch);
    setShowSplit(false);
  };

  return (
    <details className="group rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="font-[family-name:var(--font-display)] text-lg font-bold">{cls.label}</span>
        <span className="text-ink-muted">→</span>
        <span className="font-semibold">{describe(main, cls.label)}</span>
        {others ? <Badge tone="warn">{others} different</Badge> : null}
        {flagged ? <Badge tone="bad">{flagged} below pass mark</Badge> : null}
        <span className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          {cls.students.length} students
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>

      <div className="border-t border-line">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 sm:px-6">
          <span className="text-sm font-bold">Whole class:</span>
          <span className="block w-56">
            <Select aria-label={`Where all of ${cls.label} goes`} value="" onChange={(e) => e.target.value && set(ids, e.target.value)} className="h-10 text-sm">
              <option value="">Choose for everyone…</option>
              <DestinationOptions destinations={destinations} fromLabel={cls.label} />
            </Select>
          </span>
          {splitOptions.length > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setShowSplit((v) => !v)}>
              <Shuffle className="size-4" aria-hidden /> Split evenly
            </Button>
          ) : null}
        </div>

        {showSplit ? (
          <div className="mx-5 mb-3 space-y-3 rounded-[var(--radius-control)] bg-surface-sunk p-4 sm:mx-6">
            <p className="text-sm font-bold">Split {cls.label} between:</p>
            <div className="flex flex-wrap gap-3">
              {splitOptions.map((d) => (
                <label key={d.armId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand)]"
                    checked={splitArms.includes(d.armId)}
                    onChange={(e) => setSplitArms((a) => (e.target.checked ? [...a, d.armId] : a.filter((x) => x !== d.armId)))}
                  />
                  {d.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name={`by-${cls.armId}`} checked={splitBy === "result"} onChange={() => setSplitBy("result")} className="accent-[var(--brand)]" />
                Mix by results (each class gets strong and weaker students)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name={`by-${cls.armId}`} checked={splitBy === "name"} onChange={() => setSplitBy("name")} className="accent-[var(--brand)]" />
                By name (A to Z)
              </label>
            </div>
            <Button size="sm" onClick={split} disabled={splitArms.length < 2}>
              Split
            </Button>
          </div>
        ) : null}

        {picked.size > 0 ? (
          <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-brand-wash p-3 sm:mx-6">
            <span className="text-sm font-bold">{picked.size} ticked:</span>
            <span className="block w-56">
              <Select aria-label="Where ticked students go" value={bulk} onChange={(e) => setBulk(e.target.value)} className="h-10 text-sm">
                <option value="">Choose…</option>
                <DestinationOptions destinations={destinations} fromLabel={cls.label} />
              </Select>
            </span>
            <Button
              size="sm"
              disabled={!bulk}
              onClick={() => {
                set([...picked], bulk);
                setPicked(new Set());
                setBulk("");
              }}
            >
              Apply
            </Button>
          </div>
        ) : null}

        <ul className="divide-y divide-line border-t border-line">
          {cls.students.map((s) => {
            const below = s.average !== null && s.average < passMark;
            return (
              <li key={s.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 sm:px-6", picked.has(s.id) && "bg-brand-wash")}>
                <input
                  type="checkbox"
                  aria-label={`Tick ${s.name}`}
                  checked={picked.has(s.id)}
                  onChange={() =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (n.has(s.id)) n.delete(s.id);
                      else n.add(s.id);
                      return n;
                    })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="block text-xs text-ink-faint">
                    {s.admissionNo}
                    {s.average !== null ? (
                      <>
                        {" · "}
                        <span className={below ? "font-bold text-bad" : ""}>
                          Average {s.average}
                          {below ? ", below pass mark" : ""}
                        </span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="block w-full sm:w-60">
                  <Select aria-label={`Where ${s.name} goes`} value={choices[s.id]} onChange={(e) => set([s.id], e.target.value)} className="h-10 text-sm">
                    <DestinationOptions destinations={destinations} fromLabel={cls.label} />
                  </Select>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

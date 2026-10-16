"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import {
  STAFF_FIELDS,
  STUDENT_FIELDS,
  classLookup,
  findHeaderRow,
  guessMapping,
  prepareStaff,
  prepareStudents,
  type ArmOption,
  type Cell,
  type Grid,
  type Mapping,
  type NameOrder,
} from "@kmf/core";
import { Badge, Button, Card, CardHeader, Select, buttonClasses, cx } from "@kmf/ui";
import type { ActionState } from "@/lib/actions";

type Kind = "students" | "staff";
type Result = ActionState & { created?: number; updated?: number; skipped?: number; guardians?: number };

const MAX_BYTES = 5 * 1024 * 1024;

const TEMPLATES: Record<Kind, string[][]> = {
  students: [
    ["Admission number", "Surname", "First name", "Middle name", "Gender", "Date of birth", "Class", "Parent or guardian", "Parent's phone", "Parent's email"],
    ["BFA/2026/001", "Okafor", "Chidi", "Emeka", "Male", "03/04/2014", "JSS 1A", "Mr Okafor", "08031234567", ""],
  ],
  staff: [
    ["Title", "Surname", "First name", "Email", "Phone", "Position"],
    ["Mrs", "Ishaku", "Grace", "grace@example.com", "08031234567", "Mathematics teacher"],
  ],
};

function downloadTemplate(kind: Kind) {
  const csv = TEMPLATES[kind].map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${kind}-import-template.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function readFile(file: File): Promise<Grid> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) throw new Error("This is an old Excel file (.xls). In Excel, choose File, Save As, and pick Excel Workbook (.xlsx) or CSV, then upload that.");
  if (file.size > MAX_BYTES) throw new Error("That file is larger than 5 MB. Remove extra sheets or columns, or split it into smaller files.");
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolve, reject) =>
      Papa.parse<Cell[]>(file, {
        skipEmptyLines: false,
        complete: (r) => resolve(r.data),
        error: () => reject(new Error("That CSV file couldn't be read. Open it in Excel, save it again, and retry.")),
      }),
    );
  }
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/web-worker");
    try {
      return (await readSheet(file)) as Grid;
    } catch {
      throw new Error("That Excel file couldn't be read. Make sure the student list is on the first sheet, save it again, and retry.");
    }
  }
  throw new Error("Upload an Excel (.xlsx) or CSV file.");
}

export function ImportWizard({
  kind,
  arms = [],
  onImport,
}: {
  kind: Kind;
  arms?: Array<ArmOption & { label: string }>;
  onImport: (rows: unknown, updateExisting: boolean) => Promise<Result>;
}) {
  const fields = kind === "students" ? STUDENT_FIELDS : STAFF_FIELDS;
  const noun = kind === "students" ? "students" : "staff";
  const [step, setStep] = useState<"upload" | "match" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [grid, setGrid] = useState<Grid>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [order, setOrder] = useState<NameOrder>("surname_first");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [importing, startImport] = useTransition();

  const lookup = useMemo(() => classLookup(arms), [arms]);
  const headers = grid[headerRow] ?? [];

  const prepared = useMemo(() => {
    if (step === "upload" || grid.length === 0) return null;
    return kind === "students" ? prepareStudents(grid, headerRow, mapping, order, lookup) : prepareStaff(grid, headerRow, mapping, order);
  }, [step, grid, headerRow, mapping, order, lookup, kind]);

  const usesFullName = mapping.full_name !== null && mapping.full_name !== undefined && (mapping.first_name == null || mapping.last_name == null);
  const missingRequired = fields.filter((f) => f.required && (mapping[f.key] === null || mapping[f.key] === undefined));
  const hasName = (mapping.first_name != null && mapping.last_name != null) || mapping.full_name != null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReadError(null);
    setReading(true);
    try {
      const data = (await readFile(file)).filter((r) => Array.isArray(r));
      if (data.length < 2) throw new Error("That file looks empty. Make sure the list is on the first sheet.");
      const hr = findHeaderRow(data, fields);
      setGrid(data);
      setHeaderRow(hr);
      setMapping(guessMapping(data[hr] ?? [], fields));
      setFileName(file.name);
      setStep("match");
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "That file couldn't be read.");
    } finally {
      setReading(false);
    }
  }

  function doImport() {
    if (!prepared || prepared.rows.length === 0) return;
    // Row numbers are only for showing problems; they aren't saved.
    const rows = prepared.rows.map((r) => {
      const copy: Record<string, unknown> = { ...r };
      delete copy.sourceRow;
      return copy;
    });
    startImport(async () => {
      try {
        const r = await onImport(rows, updateExisting);
        setResult(r);
        if (r.ok) setStep("done");
      } catch {
        setResult({ error: "The import didn't reach the server. Check your connection and try again. Nothing was saved." });
      }
    });
  }

  /* ------------------------------------------------------------- Upload */
  if (step === "upload") {
    return (
      <Card>
        <CardHeader title={`Import ${noun} from Excel`} description="Use your school's existing list. You'll match its columns to the portal before anything is saved." />
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <label
            className={cx(
              "flex cursor-pointer flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-brand-line bg-brand-wash px-6 py-10 text-center transition-colors hover:border-brand",
              reading && "pointer-events-none opacity-70",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files[0]);
            }}
          >
            {reading ? <LoaderCircle className="size-8 animate-spin text-brand-text" aria-hidden /> : <FileSpreadsheet className="size-8 text-brand-text" aria-hidden />}
            <span className="font-bold text-ink">{reading ? "Reading the file" : "Choose an Excel or CSV file"}</span>
            <span className="text-sm text-ink-muted">or drag it here. Excel (.xlsx) or CSV, up to 5 MB.</span>
            <input type="file" accept=".xlsx,.csv,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {readError ? (
            <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {readError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
            <span>Starting from paper? Fill in the blank template, then upload it.</span>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(kind)}>
              <Download className="size-4" aria-hidden /> Blank template
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  /* --------------------------------------------------------------- Done */
  if (step === "done" && result) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
            <CircleCheck className="size-7" aria-hidden />
          </span>
          <h2 className="text-2xl">Import finished</h2>
          <ul className="space-y-1 text-ink-muted">
            <li>
              <span className="font-bold text-ink">{result.created ?? 0}</span> {noun} added
            </li>
            {result.updated ? (
              <li>
                <span className="font-bold text-ink">{result.updated}</span> updated
              </li>
            ) : null}
            {result.skipped ? (
              <li>
                <span className="font-bold text-ink">{result.skipped}</span> already in the portal, left unchanged
              </li>
            ) : null}
            {result.guardians ? (
              <li>
                <span className="font-bold text-ink">{result.guardians}</span> parents added
              </li>
            ) : null}
            {prepared && prepared.problems.length > 0 ? (
              <li>
                <span className="font-bold text-ink">{prepared.problems.length}</span> {prepared.problems.length === 1 ? "row with problems was" : "rows with problems were"} not imported
              </li>
            ) : null}
          </ul>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href={`/${kind}`} className={buttonClasses("solid")}>
              See all {noun}
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setResult(null);
                setGrid([]);
              }}
            >
              Import another file
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  /* -------------------------------------------------------------- Match */
  const columnLabel = (i: number) => {
    const h = String(headers[i] ?? "").trim();
    return h ? h : `Column ${String.fromCharCode(65 + (i % 26))}`;
  };
  const columnCount = Math.max(...grid.slice(0, 50).map((r) => r.length), 0);
  const ready = prepared?.rows.length ?? 0;
  const problems = prepared?.problems ?? [];
  const canImport = ready > 0 && missingRequired.length === 0 && hasName && !importing;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Match your columns"
          description={`From ${fileName}. We've matched what we could. Check each one, then review below.`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
              <ArrowLeft className="size-4" aria-hidden /> Choose a different file
            </Button>
          }
        />
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold">Column headings are on row</span>
            <span className="w-24">
              <Select
                className="h-10"
                value={headerRow}
                onChange={(e) => {
                  const hr = Number(e.target.value);
                  setHeaderRow(hr);
                  setMapping(guessMapping(grid[hr] ?? [], fields));
                }}
              >
                {grid.slice(0, 10).map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </span>
          </label>

          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="space-y-1">
                <span className="flex items-center gap-2 text-sm font-bold">
                  {f.label}
                  {f.required ? <Badge tone="brand">Required</Badge> : null}
                </span>
                <Select
                  className="h-10"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                  aria-invalid={(f.required && mapping[f.key] == null) || undefined}
                >
                  <option value="">Not in this file</option>
                  {Array.from({ length: columnCount }, (_, i) => (
                    <option key={i} value={i}>
                      {columnLabel(i)}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>

          {usesFullName ? (
            <fieldset className="flex flex-wrap items-center gap-4 rounded-[var(--radius-control)] bg-surface-sunk px-4 py-3 text-sm">
              <legend className="sr-only">Full name order</legend>
              <span className="font-bold">Names in the file are written</span>
              {(
                [
                  ["surname_first", "Surname first (Okafor Chidi)"],
                  ["first_name_first", "First name first (Chidi Okafor)"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="order" checked={order === value} onChange={() => setOrder(value)} className="accent-[var(--brand)]" />
                  {label}
                </label>
              ))}
            </fieldset>
          ) : null}

          {kind === "students" ? (
            <fieldset className="flex flex-wrap items-center gap-4 rounded-[var(--radius-control)] bg-surface-sunk px-4 py-3 text-sm">
              <legend className="sr-only">Students already in the portal</legend>
              <span className="font-bold">If an admission number is already in the portal</span>
              <label className="flex items-center gap-2">
                <input type="radio" name="existing" checked={!updateExisting} onChange={() => setUpdateExisting(false)} className="accent-[var(--brand)]" />
                Leave that student unchanged
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="existing" checked={updateExisting} onChange={() => setUpdateExisting(true)} className="accent-[var(--brand)]" />
                Update their details from this file
              </label>
            </fieldset>
          ) : null}

          {missingRequired.length > 0 || !hasName ? (
            <p role="alert" className="rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
              {[...missingRequired.map((f) => f.label), ...(hasName ? [] : ["a name column (full name, or surname and first name)"])].join(", ")}{" "}
              {missingRequired.length + (hasName ? 0 : 1) === 1 ? "is" : "are"} needed. Choose which column holds {missingRequired.length + (hasName ? 0 : 1) === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Review"
          description={`${ready} ${noun} ready to import${problems.length ? `, ${problems.length} ${problems.length === 1 ? "row needs" : "rows need"} fixing` : ""}${prepared?.skippedBlank ? `, ${prepared.skippedBlank} blank ${prepared.skippedBlank === 1 ? "row" : "rows"} ignored` : ""}.`}
          action={
            <Button onClick={doImport} disabled={!canImport}>
              {importing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {importing ? "Importing" : `Import ${ready} ${noun}`}
            </Button>
          }
        />
        {result?.error ? (
          <p role="alert" className="mx-5 mt-4 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm font-semibold text-bad sm:mx-6">
            {result.error}
          </p>
        ) : null}

        {problems.length > 0 ? (
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <p className="mb-2 text-sm font-bold text-bad">
              These rows won&apos;t be imported. Fix them in your file and import it again; rows already imported are left alone.
            </p>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {problems.slice(0, 200).map((p) => (
                <li key={p.row} className="flex gap-3">
                  <span className="w-16 shrink-0 font-bold tabular-nums">Row {p.row}</span>
                  <span className="text-ink-muted">{p.messages.join(" ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {ready > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-surface-sunk text-xs text-ink-muted">
                <tr>
                  <th className="px-6 py-2.5 font-bold">Row</th>
                  {kind === "students" ? <th className="px-3 py-2.5 font-bold">Admission no.</th> : <th className="px-3 py-2.5 font-bold">Title</th>}
                  <th className="px-3 py-2.5 font-bold">Surname</th>
                  <th className="px-3 py-2.5 font-bold">First name</th>
                  {kind === "students" ? (
                    <>
                      <th className="px-3 py-2.5 font-bold">Gender</th>
                      <th className="px-3 py-2.5 font-bold">Class</th>
                      <th className="px-6 py-2.5 font-bold">Parent</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 font-bold">Email</th>
                      <th className="px-6 py-2.5 font-bold">Position</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prepared!.rows.slice(0, 8).map((r) => (
                  <tr key={r.sourceRow}>
                    <td className="px-6 py-2.5 text-ink-faint tabular-nums">{r.sourceRow}</td>
                    {"admission_no" in r ? (
                      <>
                        <td className="px-3 py-2.5 tabular-nums">{r.admission_no}</td>
                        <td className="px-3 py-2.5 font-bold">{r.last_name}</td>
                        <td className="px-3 py-2.5">{[r.first_name, r.middle_name].filter(Boolean).join(" ")}</td>
                        <td className="px-3 py-2.5 capitalize">{r.gender ?? "-"}</td>
                        <td className="px-3 py-2.5">{arms.find((a) => a.id === r.class_arm_id)?.label ?? "-"}</td>
                        <td className="px-6 py-2.5 text-ink-muted">{[r.guardian_name, r.guardian_phone].filter(Boolean).join(", ") || "-"}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5">{r.title ?? "-"}</td>
                        <td className="px-3 py-2.5 font-bold">{r.last_name}</td>
                        <td className="px-3 py-2.5">{r.first_name}</td>
                        <td className="px-3 py-2.5 text-ink-muted">{r.email ?? "-"}</td>
                        <td className="px-6 py-2.5 text-ink-muted">{r.position ?? "-"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {ready > 8 ? <p className="px-6 py-3 text-sm text-ink-muted">and {ready - 8} more.</p> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

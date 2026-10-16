/**
 * Turning a school's own spreadsheet into clean student and staff records.
 *
 * Schools keep lists in every format imaginable: a title row above the
 * headers, "Adm No" or "Reg. Number", full names surname-first, genders as
 * "M"/"Boy", dates as 03/04/2015 or Excel serial numbers, classes written
 * "JSS1A", "JSS 1 A" or "Jss 1a". Everything here is pure and tested.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type Grid = Cell[][];

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  /** Header spellings that mean this field, compared after normalising. */
  synonyms: string[];
};

export const STUDENT_FIELDS: FieldDef[] = [
  { key: "admission_no", label: "Admission number", required: true, synonyms: ["admission number", "admission no", "adm no", "admno", "adm number", "reg no", "reg number", "registration number", "student id", "student number", "id number", "admission"] },
  { key: "full_name", label: "Full name", synonyms: ["full name", "name", "student name", "names", "name of student", "pupil name", "students name"] },
  { key: "last_name", label: "Surname", synonyms: ["surname", "last name", "family name", "lastname"] },
  { key: "first_name", label: "First name", synonyms: ["first name", "firstname", "given name", "forename"] },
  { key: "middle_name", label: "Middle name", synonyms: ["middle name", "other name", "other names", "middlename", "othername"] },
  { key: "gender", label: "Gender", synonyms: ["gender", "sex"] },
  { key: "date_of_birth", label: "Date of birth", synonyms: ["date of birth", "dob", "birth date", "birthday", "d o b"] },
  { key: "class", label: "Class", synonyms: ["class", "class arm", "current class", "class name", "form", "grade", "level", "arm"] },
  { key: "guardian_name", label: "Parent or guardian", synonyms: ["parent name", "guardian name", "parent", "guardian", "parent guardian", "name of parent", "fathers name", "mothers name", "parent guardian name"] },
  { key: "guardian_phone", label: "Parent's phone", synonyms: ["parent phone", "guardian phone", "phone", "phone number", "phone no", "parent phone number", "parent phone no", "parents phone", "parents phone no", "guardian phone no", "gsm", "gsm no", "mobile", "mobile no", "telephone", "tel", "tel no", "contact", "contact no", "contact number"] },
  { key: "guardian_email", label: "Parent's email", synonyms: ["parent email", "guardian email", "email", "email address"] },
];

export const STAFF_FIELDS: FieldDef[] = [
  { key: "full_name", label: "Full name", synonyms: ["full name", "name", "staff name", "names", "name of staff", "teacher name"] },
  { key: "title", label: "Title", synonyms: ["title", "salutation"] },
  { key: "last_name", label: "Surname", synonyms: ["surname", "last name", "family name", "lastname"] },
  { key: "first_name", label: "First name", synonyms: ["first name", "firstname", "given name"] },
  { key: "email", label: "Email", synonyms: ["email", "email address", "e mail"] },
  { key: "phone", label: "Phone", synonyms: ["phone", "phone number", "phone no", "gsm", "gsm no", "mobile", "mobile no", "telephone", "tel", "tel no", "contact", "contact no", "contact number"] },
  { key: "position", label: "Position", synonyms: ["position", "role", "designation", "job title", "subject", "department", "post"] },
];

/** "Adm. No." -> "adm no" */
export function normaliseHeader(value: Cell): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Finds the header row among the first rows, skipping title rows above it. */
export function findHeaderRow(grid: Grid, fields: FieldDef[], scan = 10): number {
  let best = 0;
  let bestHits = -1;
  for (let i = 0; i < Math.min(scan, grid.length); i++) {
    const hits = (grid[i] ?? []).filter((c) => {
      const h = normaliseHeader(c);
      return h && fields.some((f) => f.synonyms.includes(h));
    }).length;
    if (hits > bestHits) {
      best = i;
      bestHits = hits;
    }
  }
  return best;
}

/** Field key -> column index, guessed from the header row. */
export type Mapping = Record<string, number | null>;

export function guessMapping(headers: Cell[], fields: FieldDef[]): Mapping {
  const normalised = headers.map(normaliseHeader);
  const taken = new Set<number>();
  const mapping: Mapping = {};
  for (const field of fields) {
    // Earlier synonyms are stronger matches.
    let found: number | null = null;
    for (const syn of field.synonyms) {
      const idx = normalised.findIndex((h, i) => h === syn && !taken.has(i));
      if (idx !== -1) {
        found = idx;
        break;
      }
    }
    mapping[field.key] = found;
    if (found !== null) taken.add(found);
  }
  // A single "Name" column is a full name, not a first name.
  if (mapping.full_name !== null && mapping.first_name === null && mapping.last_name === null) return mapping;
  if (mapping.first_name !== null && mapping.last_name !== null) mapping.full_name = null;
  return mapping;
}

/* ------------------------------------------------------------- Normalisers */

export function cleanText(value: Cell): string | null {
  if (value === null || value === undefined) return null;
  const s = (value instanceof Date ? value.toISOString().slice(0, 10) : String(value)).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/** "ADEBAYO" -> "Adebayo", "mary-jane" -> "Mary-Jane"; leaves "McDonald" style mixed case alone. */
export function nameCase(value: string): string {
  if (value !== value.toUpperCase() && value !== value.toLowerCase()) return value;
  return value.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export type NameOrder = "surname_first" | "first_name_first";

/** Splits a full name. "Okafor, Chidi Emeka" always means surname first. */
export function splitFullName(full: string, order: NameOrder): { first: string; middle: string | null; last: string } | null {
  const text = full.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.includes(",")) {
    const [last, rest = ""] = text.split(",", 2).map((s) => s.trim());
    const parts = rest.split(" ").filter(Boolean);
    if (!last || parts.length === 0) return null;
    return { last: nameCase(last), first: nameCase(parts[0]!), middle: parts.length > 1 ? nameCase(parts.slice(1).join(" ")) : null };
  }
  const parts = text.split(" ");
  if (parts.length < 2) return null;
  if (order === "surname_first") {
    return { last: nameCase(parts[0]!), first: nameCase(parts[1]!), middle: parts.length > 2 ? nameCase(parts.slice(2).join(" ")) : null };
  }
  return { first: nameCase(parts[0]!), last: nameCase(parts[parts.length - 1]!), middle: parts.length > 2 ? nameCase(parts.slice(1, -1).join(" ")) : null };
}

export function parseGender(value: Cell): "male" | "female" | null | "invalid" {
  if (cleanText(value) === null) return null;
  const s = normaliseHeader(value);
  if (["m", "male", "boy", "b", "man"].includes(s)) return "male";
  if (["f", "female", "girl", "g", "woman"].includes(s)) return "female";
  return "invalid";
}

/**
 * Dates as Nigerian schools write them: 03/04/2015 means 3 April (day first),
 * 2015-04-03, 3-Apr-2015, Excel serial numbers and real Date cells.
 */
export function parseDate(value: Cell): string | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "invalid" as const;
    if (y < 1900 || y > 2100) return "invalid" as const;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "invalid" : iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30).
    if (value < 1 || value > 80000) return "invalid";
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = String(value).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    let y = +m[3]!;
    if (y < 100) y += y > 50 ? 1900 : 2000;
    return iso(y, +m[2]!, +m[1]!);
  }
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  m = /^(\d{1,2})[\s-]*([a-z]+)[\s,-]*(\d{4})$/i.exec(s);
  if (m) {
    const mi = months.indexOf(m[2]!.slice(0, 3).toLowerCase());
    if (mi !== -1) return iso(+m[3]!, mi + 1, +m[1]!);
  }
  return "invalid";
}

/** Nigerian numbers: keeps digits and a leading +; 0803 123 4567 stays as written but cleaned. */
export function parsePhone(value: Cell): string | null | "invalid" {
  const raw = cleanText(typeof value === "number" ? String(Math.round(value)) : value);
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "");
  // Excel drops the leading zero from 08031234567.
  if (/^[789]\d{9}$/.test(s)) s = `0${s}`;
  if (!/^\+?\d{7,15}$/.test(s)) return "invalid";
  return s;
}

export function parseEmail(value: Cell): string | null | "invalid" {
  const s = cleanText(value)?.toLowerCase() ?? null;
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : "invalid";
}

/* ---------------------------------------------------------------- Classes */

export type ArmOption = { id: string; levelName: string; armName: string; armsInLevel: number };

const classKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Builds a lookup from every way a class might be written to its arm id. */
export function classLookup(arms: ArmOption[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of arms) {
    map.set(classKey(`${a.levelName}${a.armName}`), a.id);
    // A class with a single arm can be written without the arm: "Primary 4".
    if (a.armsInLevel === 1) map.set(classKey(a.levelName), a.id);
  }
  // Common shorthand: "JS1A" for "JSS 1A", "SSS2B" / "S.S 2B" for "SS 2B".
  for (const [key, id] of [...map]) {
    if (key.startsWith("jss")) map.set(`js${key.slice(3)}`, id);
    if (key.startsWith("ss")) map.set(`sss${key.slice(2)}`, id);
    if (key.startsWith("primary")) map.set(`pry${key.slice(7)}`, id);
    if (key.startsWith("primary")) map.set(`p${key.slice(7)}`, id);
    if (key.startsWith("primary")) map.set(`basic${key.slice(7)}`, id);
  }
  return map;
}

export function matchClass(value: Cell, lookup: Map<string, string>): string | null | "invalid" {
  const s = cleanText(value);
  if (!s) return null;
  return lookup.get(classKey(s)) ?? "invalid";
}

/* ----------------------------------------------------------- Row building */

export type StudentImportRow = {
  admission_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: "male" | "female" | null;
  date_of_birth: string | null;
  class_arm_id: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
};

export type StaffImportRow = {
  title: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
};

export type RowProblem = { row: number; messages: string[] };

export type PreparedImport<T> = { rows: Array<T & { sourceRow: number }>; problems: RowProblem[]; skippedBlank: number };

const at = (row: Cell[], mapping: Mapping, key: string): Cell => {
  const idx = mapping[key];
  return idx === null || idx === undefined ? null : row[idx];
};

function nameParts(row: Cell[], mapping: Mapping, order: NameOrder, problems: string[]) {
  const first = cleanText(at(row, mapping, "first_name"));
  const last = cleanText(at(row, mapping, "last_name"));
  if (first && last) {
    const middle = cleanText(at(row, mapping, "middle_name"));
    return { first: nameCase(first), last: nameCase(last), middle: middle ? nameCase(middle) : null };
  }
  const full = cleanText(at(row, mapping, "full_name"));
  if (full) {
    const split = splitFullName(full, order);
    if (split) return split;
    problems.push(`"${full}" needs at least a first name and a surname.`);
    return null;
  }
  problems.push("Name is missing.");
  return null;
}

const isBlank = (row: Cell[]) => row.every((c) => cleanText(c) === null);

export function prepareStudents(grid: Grid, headerRow: number, mapping: Mapping, order: NameOrder, classes: Map<string, string>): PreparedImport<StudentImportRow> {
  const rows: PreparedImport<StudentImportRow>["rows"] = [];
  const problems: RowProblem[] = [];
  const seen = new Map<string, number>();
  let skippedBlank = 0;

  grid.slice(headerRow + 1).forEach((row, i) => {
    const sourceRow = headerRow + i + 2; // spreadsheet row number as people see it
    if (isBlank(row)) {
      skippedBlank++;
      return;
    }
    const messages: string[] = [];

    const admission = cleanText(typeof at(row, mapping, "admission_no") === "number" ? String(at(row, mapping, "admission_no")) : at(row, mapping, "admission_no"));
    if (!admission) messages.push("Admission number is missing.");
    const key = admission?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ?? "";
    if (admission && seen.has(key)) messages.push(`Admission number ${admission} also appears on row ${seen.get(key)}.`);
    if (admission) seen.set(key, sourceRow);

    const name = nameParts(row, mapping, order, messages);

    const gender = parseGender(at(row, mapping, "gender"));
    if (gender === "invalid") messages.push(`Gender "${cleanText(at(row, mapping, "gender"))}" isn't recognised. Use Male or Female.`);

    const dob = parseDate(at(row, mapping, "date_of_birth"));
    if (dob === "invalid") messages.push(`Date of birth "${cleanText(at(row, mapping, "date_of_birth"))}" isn't a valid date. Use day/month/year.`);

    const cls = matchClass(at(row, mapping, "class"), classes);
    if (cls === "invalid") messages.push(`Class "${cleanText(at(row, mapping, "class"))}" doesn't match any class in the portal.`);

    const phone = parsePhone(at(row, mapping, "guardian_phone"));
    if (phone === "invalid") messages.push(`Phone "${cleanText(at(row, mapping, "guardian_phone"))}" isn't a valid phone number.`);
    const email = parseEmail(at(row, mapping, "guardian_email"));
    if (email === "invalid") messages.push(`Email "${cleanText(at(row, mapping, "guardian_email"))}" isn't a valid email address.`);

    if (messages.length > 0 || !name || !admission) {
      problems.push({ row: sourceRow, messages });
      return;
    }
    const guardianName = cleanText(at(row, mapping, "guardian_name"));
    rows.push({
      sourceRow,
      admission_no: admission,
      first_name: name.first,
      middle_name: name.middle,
      last_name: name.last,
      gender: gender as "male" | "female" | null,
      date_of_birth: dob as string | null,
      class_arm_id: cls as string | null,
      guardian_name: guardianName ? nameCase(guardianName) : null,
      guardian_phone: phone as string | null,
      guardian_email: email as string | null,
    });
  });

  return { rows, problems, skippedBlank };
}

const TITLES = ["mr", "mrs", "miss", "ms", "dr", "prof", "rev", "pastor", "mallam", "malam", "alhaji", "hajiya", "barr", "engr", "chief"];

export function prepareStaff(grid: Grid, headerRow: number, mapping: Mapping, order: NameOrder): PreparedImport<StaffImportRow> {
  const rows: PreparedImport<StaffImportRow>["rows"] = [];
  const problems: RowProblem[] = [];
  const seenEmails = new Map<string, number>();
  let skippedBlank = 0;

  grid.slice(headerRow + 1).forEach((row, i) => {
    const sourceRow = headerRow + i + 2;
    if (isBlank(row)) {
      skippedBlank++;
      return;
    }
    const messages: string[] = [];

    // Titles written inside the name: "Mrs. Grace Ishaku".
    let title = cleanText(at(row, mapping, "title"));
    const fullRaw = cleanText(at(row, mapping, "full_name"));
    let fullName = fullRaw;
    if (fullRaw) {
      const firstWord = fullRaw.split(" ")[0]!.replace(/\.$/, "").toLowerCase();
      if (TITLES.includes(firstWord)) {
        title ??= fullRaw.split(" ")[0]!.replace(/\.$/, "");
        fullName = fullRaw.split(" ").slice(1).join(" ");
      }
    }
    const patched = [...row];
    if (mapping.full_name !== null && mapping.full_name !== undefined) patched[mapping.full_name] = fullName;
    const name = nameParts(patched, mapping, order, messages);

    const email = parseEmail(at(row, mapping, "email"));
    if (email === "invalid") messages.push(`Email "${cleanText(at(row, mapping, "email"))}" isn't a valid email address.`);
    if (typeof email === "string") {
      if (seenEmails.has(email)) messages.push(`Email ${email} also appears on row ${seenEmails.get(email)}.`);
      seenEmails.set(email, sourceRow);
    }
    const phone = parsePhone(at(row, mapping, "phone"));
    if (phone === "invalid") messages.push(`Phone "${cleanText(at(row, mapping, "phone"))}" isn't a valid phone number.`);

    if (messages.length > 0 || !name) {
      problems.push({ row: sourceRow, messages });
      return;
    }
    rows.push({
      sourceRow,
      title: title ? nameCase(title.replace(/\.$/, "")) : null,
      first_name: name.first,
      last_name: name.last,
      email: email as string | null,
      phone: phone as string | null,
      position: cleanText(at(row, mapping, "position")),
    });
  });

  return { rows, problems, skippedBlank };
}

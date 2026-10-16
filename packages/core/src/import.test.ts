import { describe, expect, it } from "vitest";
import {
  STAFF_FIELDS,
  STUDENT_FIELDS,
  classLookup,
  findHeaderRow,
  guessMapping,
  matchClass,
  nameCase,
  parseDate,
  parseGender,
  parsePhone,
  prepareStaff,
  prepareStudents,
  splitFullName,
  type Grid,
} from "./import";

const ARMS = classLookup([
  { id: "jss1a", levelName: "JSS 1", armName: "A", armsInLevel: 2 },
  { id: "jss1b", levelName: "JSS 1", armName: "B", armsInLevel: 2 },
  { id: "p4", levelName: "Primary 4", armName: "A", armsInLevel: 1 },
  { id: "ss2a", levelName: "SS 2", armName: "A", armsInLevel: 1 },
]);

describe("reading a school's own spreadsheet", () => {
  const grid: Grid = [
    ["BRIGHTFIELD ACADEMY, JALINGO", null, null],
    ["Student list, 2026/2027", null, null],
    ["S/N", "Adm. No.", "Name of Student", "Sex", "D.O.B", "Class", "Parent Name", "Phone"],
    [1, "BFA/001", "OKAFOR Chidi Emeka", "M", "03/04/2014", "JSS1A", "Mr Okafor", 8031234567],
    [2, "BFA/002", "Bello, Amina", "Girl", 41730, "jss 1 b", null, null],
    [null, null, null, null, null, null, null, null],
    [3, "BFA/003", "Danjuma Musa", "X", "31/02/2014", "JSS 9Z", null, "123"],
    [4, "bfa-001", "Repeat Person", "M", null, "Primary 4", null, null],
  ];

  it("finds the header row below title rows", () => {
    expect(findHeaderRow(grid, STUDENT_FIELDS)).toBe(2);
  });

  it("matches column names in their many spellings", () => {
    const m = guessMapping(grid[2]!, STUDENT_FIELDS);
    expect(m.admission_no).toBe(1);
    expect(m.full_name).toBe(2);
    expect(m.gender).toBe(3);
    expect(m.date_of_birth).toBe(4);
    expect(m.class).toBe(5);
    expect(m.guardian_name).toBe(6);
    expect(m.guardian_phone).toBe(7);
  });

  it("recognises common phone headings", () => {
    for (const h of ["PHONE NO", "GSM No.", "Tel. No", "Contact Number", "Parent's Phone No"]) {
      expect(guessMapping(["Adm No", "Name", h], STUDENT_FIELDS).guardian_phone).toBe(2);
    }
  });

  it("cleans good rows and explains every problem", () => {
    const m = guessMapping(grid[2]!, STUDENT_FIELDS);
    const result = prepareStudents(grid, 2, m, "surname_first", ARMS);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      admission_no: "BFA/001",
      last_name: "Okafor",
      first_name: "Chidi",
      middle_name: "Emeka",
      gender: "male",
      date_of_birth: "2014-04-03",
      class_arm_id: "jss1a",
      guardian_name: "Mr Okafor",
      guardian_phone: "08031234567",
      sourceRow: 4,
    });
    expect(result.rows[1]).toMatchObject({ last_name: "Bello", first_name: "Amina", gender: "female", class_arm_id: "jss1b", date_of_birth: "2014-04-01" });

    expect(result.skippedBlank).toBe(1);
    expect(result.problems.map((p) => p.row)).toEqual([7, 8]);
    const bad = result.problems[0]!.messages.join(" ");
    expect(bad).toMatch(/Gender "X"/);
    expect(bad).toMatch(/31\/02\/2014/);
    expect(bad).toMatch(/Class "JSS 9Z"/);
    expect(bad).toMatch(/Phone "123"/);
    expect(result.problems[1]!.messages.join(" ")).toMatch(/also appears on row 4/);
  });
});

describe("names", () => {
  it("splits full names in either order", () => {
    expect(splitFullName("OKAFOR Chidi Emeka", "surname_first")).toEqual({ last: "Okafor", first: "Chidi", middle: "Emeka" });
    expect(splitFullName("Chidi Emeka Okafor", "first_name_first")).toEqual({ first: "Chidi", middle: "Emeka", last: "Okafor" });
    expect(splitFullName("Okafor, Chidi", "first_name_first")).toEqual({ last: "Okafor", first: "Chidi", middle: null });
    expect(splitFullName("Chidi", "surname_first")).toBeNull();
  });

  it("fixes all-caps and all-lowercase names, leaves mixed case alone", () => {
    expect(nameCase("ADEBAYO")).toBe("Adebayo");
    expect(nameCase("mary-jane o'neil")).toBe("Mary-Jane O'Neil");
    expect(nameCase("McDonald")).toBe("McDonald");
  });
});

describe("values", () => {
  it("reads dates day-first, as Nigerian schools write them", () => {
    expect(parseDate("03/04/2015")).toBe("2015-04-03");
    expect(parseDate("3-Apr-2015")).toBe("2015-04-03");
    expect(parseDate("2015-04-03")).toBe("2015-04-03");
    expect(parseDate(42097)).toBe("2015-04-03");
    expect(parseDate("31/02/2015")).toBe("invalid");
    expect(parseDate("")).toBeNull();
  });

  it("reads genders", () => {
    expect(parseGender("M")).toBe("male");
    expect(parseGender("Female")).toBe("female");
    expect(parseGender("boy")).toBe("male");
    expect(parseGender("?")).toBe("invalid");
    expect(parseGender(null)).toBeNull();
  });

  it("restores the leading zero Excel drops from phone numbers", () => {
    expect(parsePhone(8031234567)).toBe("08031234567");
    expect(parsePhone("+234 803 123 4567")).toBe("+2348031234567");
    expect(parsePhone("0803-123-4567")).toBe("08031234567");
    expect(parsePhone("12")).toBe("invalid");
  });

  it("matches classes however they are written", () => {
    for (const written of ["JSS 1A", "JSS1A", "jss 1 a", "JS1A", "J.S.S 1A"]) expect(matchClass(written, ARMS)).toBe("jss1a");
    expect(matchClass("Primary 4", ARMS)).toBe("p4");
    expect(matchClass("Pry 4", ARMS)).toBe("p4");
    expect(matchClass("SSS 2", ARMS)).toBe("ss2a");
    expect(matchClass("JSS 1", ARMS)).toBe("invalid"); // two arms, so the arm is needed
    expect(matchClass("", ARMS)).toBeNull();
  });
});

describe("staff", () => {
  it("takes titles out of names and checks emails", () => {
    const grid: Grid = [
      ["Name", "Email", "Phone", "Designation"],
      ["Mrs. Grace Ishaku", "GRACE@school.ng", "08030000000", "Vice Principal"],
      ["Samuel Adamu", "grace@school.ng", null, "Teacher"],
      ["Bad", "not-an-email", null, null],
    ];
    const m = guessMapping(grid[0]!, STAFF_FIELDS);
    const result = prepareStaff(grid, 0, m, "first_name_first");
    expect(result.rows[0]).toMatchObject({ title: "Mrs", first_name: "Grace", last_name: "Ishaku", email: "grace@school.ng", position: "Vice Principal" });
    expect(result.problems.map((p) => p.row)).toEqual([3, 4]);
    expect(result.problems[0]!.messages.join(" ")).toMatch(/also appears on row 2/);
  });
});

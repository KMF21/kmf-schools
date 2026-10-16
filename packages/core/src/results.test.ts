import { describe, expect, it } from "vitest";
import { BASIC_SCALE } from "./curriculum";
import { computeClassResults, cumulative, ordinal, rankWithTies, scoreProblem, subjectTotal } from "./results";

const C = [
  { id: "ca1", name: "CA 1", maxScore: 20 },
  { id: "ca2", name: "CA 2", maxScore: 20 },
  { id: "exam", name: "Exam", maxScore: 60 },
];

describe("subject totals", () => {
  it("adds the entered scores", () => {
    expect(subjectTotal({ ca1: 15, ca2: 12.5, exam: 44 }, C)).toBe(71.5);
  });
  it("is empty until something is entered, and ignores unknown components", () => {
    expect(subjectTotal({}, C)).toBeNull();
    expect(subjectTotal({ removed: 10 }, C)).toBeNull();
    expect(subjectTotal({ exam: 0 }, C)).toBe(0);
  });
});

describe("positions", () => {
  it("shares positions for equal scores and skips the next", () => {
    expect(rankWithTies([80, 90, 80, null, 70])).toEqual([2, 1, 2, null, 4]);
  });
  it("writes positions the Nigerian way", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st"]);
  });
});

describe("score checks", () => {
  it("refuses scores above the maximum or below zero", () => {
    expect(scoreProblem(21, C[0]!)).toMatch(/out of 20/);
    expect(scoreProblem(-1, C[0]!)).not.toBeNull();
    expect(scoreProblem(19.5, C[0]!)).toBeNull();
    expect(scoreProblem(10.123, C[0]!)).not.toBeNull();
  });
});

describe("class results", () => {
  const r = computeClassResults({
    studentIds: ["ada", "bayo", "chidi"],
    subjectIds: ["eng", "math", "bio"],
    components: C,
    bands: BASIC_SCALE,
    scores: {
      ada: { eng: { ca1: 18, ca2: 17, exam: 50 }, math: { ca1: 15, ca2: 15, exam: 40 } },
      bayo: { eng: { ca1: 10, ca2: 10, exam: 30 }, math: { ca1: 15, ca2: 15, exam: 40 } },
      chidi: { eng: { ca1: 5 }, math: { ca1: 20, ca2: 20, exam: 60 }, bio: { ca1: 12, ca2: 12, exam: 36 } },
    },
  });

  it("totals, grades and ranks each subject", () => {
    const ada = r.students[0]!;
    expect(ada.subjects[0]).toMatchObject({ total: 85, grade: "A", position: 1, complete: true, highest: 85, lowest: 5 });
    expect(r.students[1]!.subjects[1]).toMatchObject({ total: 70, position: 2 }); // tied with ada
    expect(r.students[2]!.subjects[0]).toMatchObject({ total: 5, complete: false, grade: "F" });
  });

  it("averages only the subjects a student has scores in", () => {
    expect(r.students[0]).toMatchObject({ subjectCount: 2, total: 155, average: 77.5 });
    expect(r.students[2]).toMatchObject({ subjectCount: 3, total: 165, average: 55 });
    expect(r.students.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("gives the class average", () => {
    expect(r.classAverage).toBe(64.17);
    expect(r.classSize).toBe(3);
  });
});

describe("third term", () => {
  it("averages the terms that have results", () => {
    expect(cumulative([60, 70, 80])).toEqual({ average: 70, termsCounted: 3 });
    expect(cumulative([null, 70, 80])).toEqual({ average: 75, termsCounted: 2 });
    expect(cumulative([null, null, null]).average).toBeNull();
  });
});

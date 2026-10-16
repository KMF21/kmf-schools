import { isRole, type Role, type School } from "@kmf/core";

/** Fictional school used in demo mode and in sales demos. Mirrors supabase/seed.sql. */
export const DEMO_SCHOOL: School = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "brightfield",
  name: "Brightfield Academy",
  shortName: "Brightfield",
  motto: "Light, learning, character",
  address: "12 Hospital Road, Jalingo, Taraba State",
  phone: "+234 800 000 0000",
  email: "info@brightfield.example",
  logoUrl: null,
  brandColor: "#1a8754",
  status: "active",
};

export const DEMO_ROLE_COOKIE = "kmf_demo_role";

export const DEMO_PEOPLE: Record<Role, { name: string; email: string }> = {
  owner: { name: "Dr Hauwa Bello", email: "proprietor@brightfield.example" },
  admin: { name: "Mrs Grace Ishaku", email: "admin@brightfield.example" },
  teacher: { name: "Mr Samuel Adamu", email: "s.adamu@brightfield.example" },
  bursar: { name: "Mr Ibrahim Yakubu", email: "bursar@brightfield.example" },
  parent: { name: "Mrs Ruth Danladi", email: "" },
  student: { name: "Joshua Danladi", email: "" },
};

export function demoRole(value: string | undefined): Role | null {
  return isRole(value) ? value : null;
}

type DemoLevel = { name: string; arms: Array<{ name: string; students: number }>; subjects: string[] };
type DemoSection = { id: string; name: string; kind: string; assessmentStyle: "score" | "rating"; levels: DemoLevel[] };

const PRIMARY_SUBJECTS = ["English Studies", "Mathematics", "Basic Science and Technology", "Social and Citizenship Studies", "Christian Religious Studies", "Cultural and Creative Arts", "Computer Studies"];
const JSS_SUBJECTS = ["English Studies", "Mathematics", "Basic Science", "Basic Technology", "Social Studies", "Civic Education", "Business Studies", "Computer Studies"];
const SSS_SUBJECTS = ["English Language", "Mathematics", "Civic Education", "Biology", "Chemistry", "Physics", "Economics", "Government"];

export const DEMO_STRUCTURE: DemoSection[] = [
  {
    id: "s-nursery",
    name: "Nursery",
    kind: "nursery",
    assessmentStyle: "rating",
    levels: [
      { name: "Nursery 1", arms: [{ name: "A", students: 18 }], subjects: ["Language and Literacy", "Numeracy", "Social Habits", "Creative Arts"] },
      { name: "Nursery 2", arms: [{ name: "A", students: 21 }], subjects: ["Language and Literacy", "Numeracy", "Social Habits", "Creative Arts"] },
    ],
  },
  {
    id: "s-primary",
    name: "Primary",
    kind: "primary",
    assessmentStyle: "score",
    levels: [1, 2, 3, 4, 5, 6].map((n) => ({
      name: `Primary ${n}`,
      arms: [{ name: "A", students: [24, 26, 22, 25, 23, 20][n - 1]! }],
      subjects: PRIMARY_SUBJECTS,
    })),
  },
  {
    id: "s-jss",
    name: "Junior Secondary",
    kind: "junior_secondary",
    assessmentStyle: "score",
    levels: [1, 2, 3].map((n) => ({
      name: `JSS ${n}`,
      arms: [
        { name: "A", students: [28, 27, 25][n - 1]! },
        { name: "B", students: [26, 24, 23][n - 1]! },
      ],
      subjects: JSS_SUBJECTS,
    })),
  },
  {
    id: "s-sss",
    name: "Senior Secondary",
    kind: "senior_secondary",
    assessmentStyle: "score",
    levels: [1, 2, 3].map((n) => ({
      name: `SS ${n}`,
      arms: [
        { name: "A", students: [22, 20, 18][n - 1]! },
        { name: "B", students: [19, 17, 16][n - 1]! },
      ],
      subjects: SSS_SUBJECTS,
    })),
  },
];

// Alternating male and female first names.
const FIRST = ["Joshua", "Amina", "Daniel", "Hadiza", "Emmanuel", "Blessing", "Musa", "Faith", "Ibrahim", "Esther", "Yusuf", "Mercy", "Caleb", "Zainab", "David", "Rahila", "Samuel", "Precious", "Abdullahi", "Deborah", "Victor", "Hauwa", "Peter", "Naomi"];
const LAST = ["Danladi", "Bello", "Ishaku", "Adamu", "Yakubu", "Garba", "Audu", "Tanko", "Bitrus", "Usman", "Maikano", "Philemon"];

export type DemoStudent = { id: string; name: string; admissionNo: string; className: string; gender: "female" | "male"; status: "active" };

export const DEMO_STUDENTS: DemoStudent[] = (() => {
  const classes = DEMO_STRUCTURE.flatMap((s) => s.levels.flatMap((l) => l.arms.map((a) => (l.arms.length > 1 ? `${l.name}${a.name}` : l.name))));
  return Array.from({ length: 36 }, (_, i) => {
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 7) % LAST.length]!;
    return {
      id: `demo-student-${i + 1}`,
      name: `${first} ${last}`,
      admissionNo: `BFA/2026/${String(i + 1).padStart(3, "0")}`,
      className: classes[(i * 7) % classes.length]!,
      gender: (i % FIRST.length) % 2 === 1 ? "female" : "male",
      status: "active",
    };
  });
})();

export const DEMO_STAFF_COUNT = 34;

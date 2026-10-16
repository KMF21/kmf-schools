import { cache } from "react";
import type { ArmOption, School } from "@kmf/core";
import { IS_DEMO } from "./env";
import { DEMO_STAFF_COUNT, DEMO_STRUCTURE, DEMO_STUDENTS } from "./demo";
import { getEditableStructure } from "./structure";
import { supabaseForRequest } from "./supabase";

export type StaffRow = { id: string; title: string | null; firstName: string; lastName: string; email: string | null; phone: string | null; position: string | null; isActive: boolean };

export type Guardian = { id: string; fullName: string; phone: string | null; email: string | null; relationship: string | null };

export type StudentDetail = {
  id: string;
  admissionNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: "male" | "female" | null;
  dateOfBirth: string | null;
  classArmId: string | null;
  status: "active" | "graduated" | "withdrawn" | "suspended";
  guardians: Guardian[];
};

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

/** Every class arm, labelled as people write it ("JSS 1A", or "Primary 4" when a class has one arm). */
export const getArmOptions = cache(async (school: School): Promise<Array<ArmOption & { label: string }>> => {
  const { sections } = await getEditableStructure(school);
  return sections
    .filter((s) => s.isEnabled)
    .flatMap((s) =>
      s.levels.flatMap((l) =>
        l.arms.map((a) => ({
          id: a.id,
          levelName: l.name,
          armName: a.name,
          armsInLevel: l.arms.length,
          label: l.arms.length > 1 ? `${l.name}${a.name}` : l.name,
        })),
      ),
    );
});

const DEMO_STAFF: StaffRow[] = [
  ["Dr", "Hauwa", "Bello", "Proprietor"],
  ["Mrs", "Grace", "Ishaku", "School administrator"],
  ["Mr", "Samuel", "Adamu", "Mathematics teacher"],
  ["Mrs", "Rahila", "Danjuma", "English teacher"],
  ["Mr", "Ibrahim", "Yakubu", "Bursar"],
  ["Miss", "Faith", "Audu", "Nursery teacher"],
  ["Mr", "Peter", "Garba", "Basic Science teacher"],
  ["Mallam", "Usman", "Tanko", "Islamic Studies teacher"],
].map(([title, first, last, position], i) => ({
  id: `demo-staff-${i + 1}`,
  title: title!,
  firstName: first!,
  lastName: last!,
  email: `${first!.toLowerCase()}.${last!.toLowerCase()}@brightfield.example`,
  phone: `0803000${String(1000 + i)}`,
  position: position!,
  isActive: true,
}));

export async function getStaffList(school: School): Promise<{ staff: StaffRow[]; total: number }> {
  if (IS_DEMO) return { staff: DEMO_STAFF, total: DEMO_STAFF_COUNT };
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase
    .from("staff")
    .select("id, title, first_name, last_name, email, phone, position, is_active")
    .eq("school_id", school.id)
    .order("last_name")
    .limit(1000);
  if (error) fail("staff", error);
  const staff = (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    firstName: s.first_name,
    lastName: s.last_name,
    email: s.email,
    phone: s.phone,
    position: s.position,
    isActive: s.is_active,
  }));
  return { staff, total: staff.length };
}

export async function getStaffMember(school: School, id: string): Promise<StaffRow | null> {
  if (IS_DEMO) return DEMO_STAFF.find((s) => s.id === id) ?? null;
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase
    .from("staff")
    .select("id, title, first_name, last_name, email, phone, position, is_active")
    .eq("school_id", school.id)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("staff member", error);
  if (!data) return null;
  return { id: data.id, title: data.title, firstName: data.first_name, lastName: data.last_name, email: data.email, phone: data.phone, position: data.position, isActive: data.is_active };
}

export async function getStudent(school: School, id: string): Promise<StudentDetail | null> {
  if (IS_DEMO) {
    const s = DEMO_STUDENTS.find((d) => d.id === id);
    if (!s) return null;
    const [first, ...rest] = s.name.split(" ");
    const armId = (() => {
      for (const sec of DEMO_STRUCTURE)
        for (const [i, l] of sec.levels.entries())
          for (const a of l.arms) if ((l.arms.length > 1 ? `${l.name}${a.name}` : l.name) === s.className) return `${sec.id}-${i}-${a.name}`;
      return null;
    })();
    return {
      id: s.id,
      admissionNo: s.admissionNo,
      firstName: first!,
      middleName: null,
      lastName: rest.join(" "),
      gender: s.gender,
      dateOfBirth: null,
      classArmId: armId,
      status: "active",
      guardians: [{ id: "demo-guardian", fullName: `Mr ${rest.join(" ")}`, phone: "08030000000", email: null, relationship: "Father" }],
    };
  }

  const supabase = await supabaseForRequest();
  const [student, links] = await Promise.all([
    supabase
      .from("students")
      .select("id, admission_no, first_name, middle_name, last_name, gender, date_of_birth, class_arm_id, status")
      .eq("school_id", school.id)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("student_guardians").select("relationship, guardians(id, full_name, phone, email)").eq("school_id", school.id).eq("student_id", id),
  ]);
  if (student.error) fail("student", student.error);
  if (links.error) fail("parents", links.error);
  if (!student.data) return null;
  const s = student.data;
  return {
    id: s.id,
    admissionNo: s.admission_no,
    firstName: s.first_name,
    middleName: s.middle_name,
    lastName: s.last_name,
    gender: s.gender,
    dateOfBirth: s.date_of_birth,
    classArmId: s.class_arm_id,
    status: s.status,
    guardians: (links.data ?? []).flatMap((l) => {
      const g = l.guardians as unknown as { id: string; full_name: string; phone: string | null; email: string | null } | null;
      return g ? [{ id: g.id, fullName: g.full_name, phone: g.phone, email: g.email, relationship: l.relationship }] : [];
    }),
  };
}

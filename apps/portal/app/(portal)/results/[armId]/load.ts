import { notFound } from "next/navigation";
import { getClassInfo, getMyStaffId, accessTo, resolveTerm, getTerms } from "@/lib/results";
import { requireViewer } from "@/lib/session";

/** Shared by every page of a class's results: the class, term and what the viewer may do. */
export async function loadClass(armId: string, termParam: string | undefined, roles: Array<"owner" | "admin" | "teacher" | "parent" | "student"> = ["owner", "admin", "teacher"]) {
  const { school, viewer } = await requireViewer(roles);
  if (!/^[0-9a-f-]{36}$/i.test(armId) && !armId.startsWith("s-")) notFound();
  const [cls, term, terms, staffId] = await Promise.all([getClassInfo(school, armId), resolveTerm(school, termParam), getTerms(school), getMyStaffId(school, viewer)]);
  if (!cls || !term) notFound();
  const access = accessTo(cls, viewer, staffId);
  return { school, viewer, cls, term, terms, access };
}

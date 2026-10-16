import type { Metadata } from "next";
import { MANAGER_ROLES } from "@kmf/core";
import { IS_DEMO } from "@/lib/env";
import { DEMO_STUDENTS } from "@/lib/demo";
import { getLoginCounts, getPortalAddress } from "@/lib/logins";
import { requireViewer } from "@/lib/session";
import type { Credential } from "./actions";
import { LoginsManager } from "./logins-manager";

export const metadata: Metadata = { title: "Logins" };

export default async function LoginsPage() {
  const { school } = await requireViewer(MANAGER_ROLES);
  const [counts, portalAddress] = await Promise.all([getLoginCounts(school), getPortalAddress(school)]);

  // Demo mode: sample slips so schools can see what they'll print. Not real accounts.
  const sample: Credential[] | null = IS_DEMO
    ? DEMO_STUDENTS.slice(0, 6).map((s, i) => ({ name: s.name, detail: s.className, login: s.admissionNo, password: ["k7mpq2xd", "r4tbn8ws", "h3vjc9ea", "p6xgm2kz", "w8dqf5nt", "b2ycr7hu"][i]! }))
    : null;

  return <LoginsManager school={school} counts={counts} portalAddress={portalAddress} sample={sample} />;
}

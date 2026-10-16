import type { ReactNode } from "react";
import { ROLE_LABELS, type Role } from "@kmf/core";
import { PortalShell, type NavItem } from "@/components/portal-shell";
import { getCurrentTerm } from "@/lib/data";
import { IS_DEMO } from "@/lib/env";
import { requireViewer } from "@/lib/session";

const NAV: Array<NavItem & { roles: readonly Role[] }> = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["owner", "admin", "teacher", "bursar", "parent", "student"] },
  { href: "/students", label: "Students", icon: "students", roles: ["owner", "admin", "teacher", "bursar"] },
  { href: "/staff", label: "Staff", icon: "staff", roles: ["owner", "admin"] },
  { href: "/logins", label: "Logins", icon: "logins", roles: ["owner", "admin"] },
  { href: "/classes", label: "Classes and subjects", icon: "classes", roles: ["owner", "admin", "teacher"] },
  { href: "/announcements", label: "Announcements", icon: "announcements", roles: ["owner", "admin", "teacher", "bursar", "parent", "student"] },
  { href: "/settings", label: "School settings", icon: "settings", roles: ["owner", "admin"] },
];

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { school, viewer } = await requireViewer();
  const term = await getCurrentTerm(school);
  const nav = NAV.filter((n) => n.roles.some((r) => viewer.roles.includes(r))).map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <PortalShell
      school={school}
      viewer={{ name: viewer.name, roleLabel: viewer.isPlatformAdmin ? "KMF admin" : ROLE_LABELS[viewer.role] }}
      nav={nav}
      termLabel={term ? `${term.name}, ${term.session}` : null}
      isDemo={IS_DEMO}
    >
      {children}
    </PortalShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MANAGER_ROLES } from "@kmf/core";
import { buttonClasses } from "@kmf/ui";
import { ImportWizard } from "@/components/import-wizard";
import { IS_DEMO } from "@/lib/env";
import { getArmOptions } from "@/lib/people";
import { requireViewer } from "@/lib/session";
import { importStudents } from "../actions";

export const metadata: Metadata = { title: "Import students" };

export default async function ImportStudentsPage() {
  const { school } = await requireViewer(MANAGER_ROLES);
  const arms = await getArmOptions(school);
  return (
    <div className="space-y-4">
      <Link href="/students" className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All students
      </Link>
      {IS_DEMO ? (
        <p className="rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft px-5 py-3 text-sm font-semibold text-warn">
          This is the demo school. You can try matching a file, but the import itself won&apos;t be saved.
        </p>
      ) : null}
      <ImportWizard kind="students" arms={arms} onImport={importStudents} />
    </div>
  );
}

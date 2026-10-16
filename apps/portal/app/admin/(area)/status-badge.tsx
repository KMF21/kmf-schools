import { Badge } from "@kmf/ui";
import type { SchoolStatus } from "@/lib/platform";

const LOOK: Record<SchoolStatus, { tone: "ok" | "warn" | "bad"; label: string }> = {
  active: { tone: "ok", label: "Live" },
  setup: { tone: "warn", label: "Setting up" },
  suspended: { tone: "bad", label: "Suspended" },
};

export function StatusBadge({ status }: { status: SchoolStatus }) {
  const look = LOOK[status];
  return <Badge tone={look.tone}>{look.label}</Badge>;
}

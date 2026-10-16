"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@kmf/ui";

/** Switches the term shown, keeping the rest of the address. */
export function TermPicker({ terms, current }: { terms: Array<{ id: string; label: string }>; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (terms.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm font-bold">
      <span className="sr-only sm:not-sr-only">Term</span>
      <span className="block w-56">
        <Select
          value={current}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("term", e.target.value);
            router.push(`${pathname}?${next.toString()}`);
          }}
          className="h-10 text-sm"
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </span>
    </label>
  );
}

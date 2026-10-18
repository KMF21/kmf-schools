"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { findSchools, type FoundSchool } from "./find-schools";

/** "Find your school": type part of the name, tap the school to open its portal. */
export function SchoolFinder({ rootDomain, onPlatformDomain }: { rootDomain: string; onPlatformDomain: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundSchool[] | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const found = await findSchools(q);
        if (ticket === latest.current) setResults(found);
      } catch {
        if (ticket === latest.current) setResults([]);
      } finally {
        if (ticket === latest.current) setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const href = (slug: string) => (onPlatformDomain ? `https://${slug}.${rootDomain}/login` : `/s/${slug}`);
  const short = query.trim().length < 3;

  return (
    <div className="mx-auto w-full max-w-xl text-left">
      <label htmlFor="find-school" className="mb-2 block text-center text-sm font-semibold text-white/85">
        Parent, student or staff? Find your school
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto size-5 text-neutral-500" aria-hidden />
        <input
          id="find-school"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your school's name"
          autoComplete="off"
          className="h-13 w-full rounded-full border-0 bg-white pr-12 pl-12 text-base text-neutral-900 shadow-[var(--shadow-float)] placeholder:text-neutral-500 focus:ring-4 focus:ring-white/40 focus:outline-none"
          aria-describedby="find-school-results"
        />
        {busy ? <LoaderCircle className="absolute inset-y-0 right-4 my-auto size-5 animate-spin text-neutral-500" aria-hidden /> : null}
      </div>
      <div id="find-school-results" aria-live="polite">
        {!short && results ? (
          results.length ? (
            <ul className="mt-2 overflow-hidden rounded-[1.25rem] bg-white text-neutral-900 shadow-[var(--shadow-float)]">
              {results.map((s) => (
                <li key={s.slug} className="border-b border-neutral-100 last:border-0">
                  <a href={href(s.slug)} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                    {s.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logoUrl} alt="" className="size-10 shrink-0 rounded-[0.75rem] object-contain" />
                    ) : (
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[0.75rem] text-sm font-bold text-white" style={{ background: s.brandColor }}>
                        {s.name.charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{s.name}</span>
                      {s.address ? <span className="block truncate text-sm text-neutral-500">{s.address}</span> : null}
                    </span>
                    <ArrowRight className="size-5 shrink-0 text-neutral-400" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : !busy ? (
            <p className="mt-2 rounded-[1.25rem] bg-white/15 px-4 py-3 text-center text-sm">No school found with that name. Check the spelling, or ask your school for its portal address.</p>
          ) : null
        ) : null}
      </div>
    </div>
  );
}

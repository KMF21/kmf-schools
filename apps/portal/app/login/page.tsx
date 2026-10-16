import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, BookOpenCheck, Megaphone } from "lucide-react";
import { ROLE_LABELS, type Role } from "@kmf/core";
import { Card } from "@kmf/ui";
import { SchoolMark } from "@/components/school-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEMO_PEOPLE } from "@/lib/demo";
import { IS_DEMO } from "@/lib/env";
import { getViewer } from "@/lib/session";
import { requireSchool } from "@/lib/tenant";
import { signInAsDemo } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_ROLES: Role[] = ["admin", "teacher", "parent", "student"];

export default async function LoginPage() {
  const school = await requireSchool();
  if (await getViewer(school)) redirect("/dashboard");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* School panel */}
      <section className="relative overflow-hidden bg-brand px-6 pt-8 pb-10 text-brand-on sm:px-10 lg:flex lg:min-h-dvh lg:flex-col lg:px-14 lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1.2px)", backgroundSize: "20px 20px" }}
        />
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-32 size-[26rem] rounded-full border-[3.5rem] border-white/8" />

        <div className="relative flex items-center gap-3">
          <SchoolMark school={school} inverted size={52} />
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-display)] text-lg font-bold">{school.name}</p>
            {school.address ? <p className="truncate text-sm text-white/75">{school.address}</p> : null}
          </div>
        </div>

        <div className="relative mt-10 max-w-xl lg:mt-auto">
          <h1 className="text-[2rem] leading-[1.12] text-white sm:text-[2.6rem] lg:text-[3.1rem]">
            {school.motto ?? "Welcome to your school portal"}
          </h1>
          <ul className="mt-8 hidden gap-3 sm:grid">
            {[
              { icon: BookOpenCheck, text: "Check results and download report cards" },
              { icon: Megaphone, text: "See school news and announcements" },
              { icon: BadgeCheck, text: "One parent account for all your children" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[0.9375rem] text-white/90">
                <span className="grid size-9 place-items-center rounded-full bg-white/14">
                  <Icon className="size-[1.0625rem]" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 hidden text-xs text-white/60 lg:block lg:mt-16">Powered by KMF Schools</p>
      </section>

      {/* Sign-in form */}
      <section className="relative flex items-start justify-center px-4 py-8 sm:px-8 lg:items-center lg:py-12">
        <ThemeToggle className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-ink" />
        <div className="w-full max-w-md">
          <Card className="-mt-14 p-6 sm:p-8 lg:mt-0">
            <h2 className="text-2xl">Sign in</h2>
            <p className="mt-1 mb-6 text-sm text-ink-muted">Use the details the school gave you.</p>
            <LoginForm />
          </Card>

          {IS_DEMO ? (
            <Card className="mt-5 p-5">
              <h2 className="text-base">Explore the demo</h2>
              <p className="mt-1 text-sm text-ink-muted">This is sample data. Pick a person to see the portal as they would.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {DEMO_ROLES.map((role) => (
                  <form key={role} action={signInAsDemo}>
                    <input type="hidden" name="role" value={role} />
                    <button
                      type="submit"
                      className="w-full rounded-[var(--radius-control)] border border-line bg-surface-sunk px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-brand-wash"
                    >
                      <span className="block text-sm font-bold text-ink">{ROLE_LABELS[role]}</span>
                      <span className="block truncate text-xs text-ink-muted">{DEMO_PEOPLE[role].name}</span>
                    </button>
                  </form>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}

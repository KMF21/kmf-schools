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
import { getTenant, requireSchool } from "@/lib/tenant";
import { signInAsDemo } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_ROLES: Role[] = ["admin", "teacher", "parent", "student"];
const DEMO_SHORT: Partial<Record<Role, string>> = { admin: "Admin" };

const DOTS = { backgroundImage: "radial-gradient(currentColor 1px, transparent 1.2px)", backgroundSize: "20px 20px" };

/*
 * Layout goal: everything fits on the first screen, from a 360×740 phone to a
 * 1280×720 laptop. Scrolling is still allowed, because a phone keyboard covers
 * half the screen and some people use larger text; nothing is cut off then.
 */
export default async function LoginPage() {
  const school = await requireSchool();
  if (await getViewer(school)) redirect("/dashboard");
  const tenant = await getTenant();
  const chosenByPath = tenant.kind === "school" && tenant.chosenByPath;

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* School panel: a short band on phones and tablets, a full panel on laptops */}
      <section className="relative overflow-hidden bg-brand text-brand-on lg:flex lg:min-h-dvh lg:flex-col lg:px-14 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.1]" style={DOTS} />
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-32 hidden size-[26rem] rounded-full border-[3.5rem] border-white/8 lg:block" />

        <div className="relative flex items-center gap-3 px-4 py-4 sm:px-8 lg:p-0">
          <SchoolMark school={school} inverted size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-display)] text-[1.0625rem] font-bold lg:text-lg">{school.name}</p>
            {school.address ? <p className="truncate text-xs text-white/75 lg:text-sm">{school.address}</p> : null}
          </div>
          <ThemeToggle className="grid size-10 shrink-0 place-items-center rounded-full text-white/85 hover:bg-white/15 hover:text-white lg:hidden" />
        </div>

        <div className="relative mt-auto hidden max-w-xl lg:block">
          <h1 className="text-[2.6rem] leading-[1.12] text-white xl:text-[3.1rem]">{school.motto ?? "Welcome to your school portal"}</h1>
          <ul className="mt-8 grid gap-3">
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
        <p className="relative mt-12 hidden text-xs text-white/60 lg:block">Powered by KMF Schools</p>
      </section>

      {/* Sign-in */}
      <section className="relative flex flex-1 flex-col items-center px-4 pt-5 pb-6 sm:px-8 sm:pt-10 lg:justify-center lg:py-8">
        <ThemeToggle className="absolute top-4 right-4 hidden size-10 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-ink lg:grid" />
        <div className="w-full max-w-md">
          <Card className="p-5 sm:p-7">
            <h1 className="text-[1.375rem] lg:text-2xl">Sign in</h1>
            <p className="mt-0.5 mb-4 text-sm text-ink-muted">Use the details the school gave you.</p>
            <LoginForm />

            {IS_DEMO ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-sm font-bold text-ink">
                  Explore the demo as <span className="font-normal text-ink-muted">(sample data)</span>
                </p>
                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  {DEMO_ROLES.map((role) => (
                    <form key={role} action={signInAsDemo}>
                      <input type="hidden" name="role" value={role} />
                      <button
                        type="submit"
                        title={`${ROLE_LABELS[role]}: ${DEMO_PEOPLE[role].name}`}
                        className="h-10 w-full rounded-full border border-line bg-surface-sunk px-2 text-[0.8125rem] font-bold text-ink transition-colors hover:border-brand hover:bg-brand-wash hover:text-brand-text"
                      >
                        {DEMO_SHORT[role] ?? ROLE_LABELS[role]}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {chosenByPath ? (
            <p className="mt-4 text-center text-sm text-ink-muted">
              Not your school?{" "}
              <a href="/leave-school" className="font-bold text-brand-text underline-offset-4 hover:underline">
                Back to KMF Schools
              </a>
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

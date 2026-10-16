import { redirect } from "next/navigation";
import { ArrowUpRight, MapPinOff } from "lucide-react";
import { Eyebrow, buttonClasses } from "@kmf/ui";
import { IS_DEMO, ROOT_DOMAIN } from "@/lib/env";
import { getViewer } from "@/lib/session";
import { getTenant } from "@/lib/tenant";

const KMF_WHATSAPP = "https://wa.me/2349110137795";

export default async function Home({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const tenant = await getTenant();

  if (tenant.kind === "school") {
    redirect((await getViewer(tenant.school)) ? "/dashboard" : "/login");
  }

  if (tenant.kind === "unknown") {
    return (
      <main className="grid min-h-dvh place-items-center px-4 py-16">
        <div className="max-w-lg text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-soft text-brand-text">
            <MapPinOff className="size-7" aria-hidden />
          </span>
          <h1 className="mt-6 text-3xl">This address isn&apos;t connected to a school yet</h1>
          <p className="mt-3 text-ink-muted">
            <span className="font-bold text-ink">{tenant.hostname}</span> points to KMF Schools, but no school has been set up on it. If this is your
            school&apos;s address, contact KMF support to finish connecting it.
          </p>
          <a href={KMF_WHATSAPP} className={buttonClasses("solid", "lg", "mt-8")}>
            Contact KMF support
          </a>
        </div>
      </main>
    );
  }

  // On the real platform domain the demo school has its own subdomain; elsewhere
  // (Vercel links, localhost) it opens by path.
  const onPlatformDomain = tenant.hostname === ROOT_DOMAIN || tenant.hostname === `www.${ROOT_DOMAIN}`;
  const demoUrl = onPlatformDomain ? `https://brightfield.${ROOT_DOMAIN}` : "/s/brightfield";
  const schoolNotFound = (await searchParams).school === "not-found";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-brand text-brand-on">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.1]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1.2px)", backgroundSize: "22px 22px" }}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between rounded-full bg-white px-5 py-3 text-ink shadow-[var(--shadow-float)]">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold">KMF Schools</span>
          <a href={KMF_WHATSAPP} className={buttonClasses("solid", "sm")}>Talk to us</a>
        </header>

        <section className="my-auto py-16 text-center">
          <Eyebrow className="bg-white/15 text-white">For Nigerian schools</Eyebrow>
          <h1 className="mx-auto mt-6 max-w-3xl text-[2.4rem] leading-[1.1] text-white sm:text-[3.4rem]">
            Results, records and a website your school is proud of
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/85">
            One portal for proprietors, teachers, parents and students. Built by KMF Enterprise in Jalingo, for schools across Nigeria.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={demoUrl} className={buttonClasses("solid", "lg", "bg-white text-brand hover:bg-white/90 shadow-none")}>
              See the demo school <ArrowUpRight className="size-5" aria-hidden />
            </a>
            <a href="https://www.kmfenterprise.ng/" className={buttonClasses("outline", "lg", "border-white/45 bg-transparent text-white hover:bg-white/10 hover:border-white")}>
              About KMF Enterprise
            </a>
          </div>
          {schoolNotFound ? (
            <p role="alert" className="mx-auto mt-6 max-w-md rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold">
              That school link doesn&apos;t match any school. Check the spelling, or contact KMF support.
            </p>
          ) : null}
          {IS_DEMO ? <p className="mt-6 text-sm text-white/70">Running in demo mode with sample data.</p> : null}
        </section>
      </div>
    </main>
  );
}

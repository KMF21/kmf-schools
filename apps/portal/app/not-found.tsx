import Link from "next/link";
import { Eyebrow, buttonClasses } from "@kmf/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="grid max-w-4xl items-center gap-10 md:grid-cols-2">
        <p aria-hidden className="text-center font-[family-name:var(--font-display)] text-[7rem] leading-none font-bold text-brand sm:text-[9rem]">
          404
        </p>
        <div>
          <Eyebrow>Page not found</Eyebrow>
          <h1 className="mt-4 text-3xl sm:text-4xl">We can&apos;t find that page</h1>
          <p className="mt-3 text-ink-muted">The link may be mistyped, or the page may have moved. Go back to your dashboard and try from there.</p>
          <Link href="/" className={buttonClasses("solid", "lg", "mt-7")}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

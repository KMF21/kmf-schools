import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card } from "@kmf/ui";
import { IS_DEMO } from "@/lib/env";
import { getPlatformAdmin, onPlatformAddress } from "@/lib/platform";
import { signInAdminDemo } from "../actions";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: { absolute: "KMF admin sign in" }, robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (!(await onPlatformAddress())) redirect("/");
  if (await getPlatformAdmin()) redirect("/admin");

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-brand px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.1] text-white"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1.2px)", backgroundSize: "22px 22px" }}
      />
      <div className="relative w-full max-w-md">
        <p className="mb-5 text-center font-[family-name:var(--font-display)] text-xl font-bold text-white">KMF Schools</p>
        <Card className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-[0.875rem] bg-brand-soft text-brand-text">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl">KMF admin</h1>
          <p className="mt-1 mb-5 text-sm text-ink-muted">For KMF Enterprise staff who set up and support schools.</p>
          <AdminLoginForm />
          {IS_DEMO ? (
            <form action={signInAdminDemo} className="mt-5 border-t border-line pt-4">
              <button
                type="submit"
                className="h-11 w-full rounded-full border border-line bg-surface-sunk text-sm font-bold text-ink hover:border-brand hover:bg-brand-wash hover:text-brand-text"
              >
                Explore the demo as KMF admin
              </button>
            </form>
          ) : null}
        </Card>
        <p className="mt-4 text-center text-sm text-white/80">
          School staff, parents and students: sign in on your school&apos;s portal.
        </p>
      </div>
    </main>
  );
}

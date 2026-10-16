"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@kmf/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-2xl">This page didn&apos;t load</h1>
        <p className="mt-3 text-ink-muted">
          Usually this is a weak network connection. Check your data or Wi-Fi, then try again. If it keeps happening, share this code with KMF support:{" "}
          <span className="font-bold text-ink">{error.digest ?? "no code"}</span>
        </p>
        <Button size="lg" className="mt-7" onClick={reset}>
          <RotateCcw className="size-5" aria-hidden /> Try again
        </Button>
      </div>
    </main>
  );
}

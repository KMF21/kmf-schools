import "@fontsource/ubuntu/400.css";
import "@fontsource/ubuntu/500.css";
import "@fontsource/ubuntu/700.css";
import "@fontsource-variable/nunito-sans";
import "./globals.css";

import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { brandCssVars, brandPalette } from "@kmf/core";
import { getTenant } from "@/lib/tenant";

/** Applies the saved light/dark choice before the first paint, so pages never flash. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("kmf-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  if (tenant.kind === "school") {
    return {
      title: { default: `${tenant.school.name} portal`, template: `%s | ${tenant.school.name}` },
      description: `Results, announcements and records for ${tenant.school.name}.`,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: { default: "KMF Schools", template: "%s | KMF Schools" },
    description: "School websites and management portals for Nigerian schools, by KMF Enterprise.",
  };
}

export async function generateViewport(): Promise<Viewport> {
  const tenant = await getTenant();
  const color = brandPalette(tenant.kind === "school" ? tenant.school.brandColor : null).solid;
  return { themeColor: color, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tenant = await getTenant();
  const brand = brandCssVars(tenant.kind === "school" ? tenant.school.brandColor : null);

  return (
    <html lang="en-NG" style={brand as CSSProperties} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

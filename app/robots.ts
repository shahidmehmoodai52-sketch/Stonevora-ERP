import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The authenticated app and its data are behind auth/RLS regardless,
        // but there's no reason for crawlers to spend budget on tenant screens.
        disallow: ["/products", "/settings", "/onboarding", "/select-tenant"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

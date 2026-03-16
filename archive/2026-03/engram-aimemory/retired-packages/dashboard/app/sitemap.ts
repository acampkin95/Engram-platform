import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

/**
 * Only the login page is publicly accessible.
 * All dashboard routes are behind auth and should not be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${APP_URL}/dashboard/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}

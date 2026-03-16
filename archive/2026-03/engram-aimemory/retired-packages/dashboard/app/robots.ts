import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // The dashboard is a private application — disallow all crawling
        disallow: "/",
      },
    ],
    host: APP_URL,
  };
}

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

/**
 * Real robots.txt (v2 prompt's SEO fixes — flagged missing/broken by
 * the original audit). Disallows everything behind auth (dashboard,
 * driver portal, auth callback routes) — none of it should be crawled
 * or indexed, and none of it is useful to a search engine anyway.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/driver", "/auth", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

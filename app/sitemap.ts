import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

/**
 * Real sitemap.xml (v2 prompt's SEO fixes). Only the genuinely public,
 * indexable pages — nothing behind auth, same boundary robots.ts draws.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/ifta-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}

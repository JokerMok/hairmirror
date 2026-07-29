import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_UPDATED_AT } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), lastModified: SITE_UPDATED_AT, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/pricing"), lastModified: SITE_UPDATED_AT, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/faq"), lastModified: SITE_UPDATED_AT, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/privacy"), lastModified: SITE_UPDATED_AT, changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/terms"), lastModified: SITE_UPDATED_AT, changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/refunds"), lastModified: SITE_UPDATED_AT, changeFrequency: "monthly", priority: 0.4 },
  ];
}

import { MetadataRoute } from "next";
import { BLOG_POSTS } from "./blog/posts";

const BASE_URL = "https://grocerymanager.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date("2026-06-15"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogEntries,
    {
      url: `${BASE_URL}/help`,
      lastModified: new Date("2026-06-24"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date("2026-06-24"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date("2026-06-24"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}

import { PageHeader } from "@/app/components/page-header";
import { BookOpen } from "@/app/components/icons";
import { BLOG_POSTS } from "./posts";

export const metadata = {
  title: "Blog — GroceryManager",
  description:
    "Practical guides on reducing food waste, meal planning, and tracking your grocery spending.",
};

export default function BlogIndexPage() {
  return (
    <main className="page-narrow">
      <PageHeader
        accent="brand"
        icon={BookOpen}
        eyebrow="Kitchen guides"
        title="Blog"
        subtitle="Practical tips on meal planning, cutting food waste, and keeping your kitchen running smoothly."
      />

      <ul className="mt-8 space-y-4">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug}>
            <a href={`/blog/${post.slug}`} className="card-link block p-5">
              <p className="eyebrow">{post.readMinutes} min read</p>
              <h2 className="mt-1.5 section-title text-ink-900">{post.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{post.description}</p>
              <p className="mt-3 text-sm font-medium text-brand-600">Read article →</p>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-xs text-ink-400">
        <a href="/help" className="link">
          Help & FAQ
        </a>{" "}
        ·{" "}
        <a href="/privacy" className="link">
          Privacy
        </a>
      </p>
    </main>
  );
}

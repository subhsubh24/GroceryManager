import { notFound } from "next/navigation";
import { getPost, BLOG_POSTS } from "../posts";
import { Leaf } from "@/app/components/icons";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — GroceryManager`,
    description: post.description,
    keywords: post.keywords.join(", "),
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <main className="page-narrow">
      {/* Back */}
      <a href="/blog" className="nav-link inline-flex items-center gap-1 text-sm">
        ← Blog
      </a>

      {/* Article header */}
      <article className="mt-6">
        <header>
          <p className="eyebrow">{post.readMinutes} min read · {post.publishedAt}</p>
          <h1 className="page-title mt-3">{post.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-500">{post.description}</p>
          <hr className="mt-8 border-line" />
        </header>

        {/* Sections */}
        <div className="mt-8 space-y-8">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="section-title text-ink-900">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink-700">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 panel-brand">
          <span className="tile-brand mb-3 inline-flex h-9 w-9 items-center justify-center">
            <Leaf className="h-5 w-5" strokeWidth={2} />
          </span>
          <h2 className="text-xl font-semibold tracking-[-0.01em]">{post.ctaHeading}</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-white/90">{post.ctaBody}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/signup"
              className="btn inline-flex bg-white px-4 py-2.5 text-sm text-brand-solid-hover hover:bg-white/90"
            >
              Get started free →
            </a>
            <a
              href="/blog"
              className="btn inline-flex border border-white/30 px-4 py-2.5 text-sm text-white hover:bg-white/10"
            >
              More guides
            </a>
          </div>
        </div>

        <footer className="mt-8 text-xs text-ink-400">
          <a href="/privacy" className="link">Privacy</a>
          {" · "}
          <a href="/terms" className="link">Terms</a>
          {" · "}
          <a href="/help" className="link">Help</a>
        </footer>
      </article>
    </main>
  );
}

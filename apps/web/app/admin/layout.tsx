import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Owner-only admin area. Set ADMIN_EMAIL in Vercel environment variables to the owner's
// account email. All other sessions are redirected to sign-in.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const session = await auth();
  const userEmail = (session?.user as { email?: string } | undefined)?.email;

  if (!adminEmail) {
    console.error("[admin] ADMIN_EMAIL env var is not set — admin area is inaccessible");
    redirect("/signin");
  }

  if (!userEmail || userEmail.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect("/signin");
  }

  return (
    <div className="page-narrow">
      <nav className="mb-6 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm font-medium text-ink-600 hover:text-ink-900">
            ← Home
          </a>
          <span className="text-ink-300">/</span>
          <span className="text-sm font-medium text-ink-900">Admin</span>
        </div>
        <div className="mt-3 flex gap-4">
          <a href="/admin/waitlist" className="text-sm text-ink-600 hover:text-ink-900">Waitlist</a>
          <a href="/admin/content" className="text-sm text-ink-600 hover:text-ink-900">Content</a>
          <a href="/admin/growth" className="text-sm text-ink-600 hover:text-ink-900">Growth</a>
        </div>
      </nav>
      {children}
    </div>
  );
}

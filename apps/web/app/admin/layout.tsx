import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Owner-only admin area. Set ADMIN_EMAIL in Vercel environment variables to the owner's
// account email. All other sessions are redirected to sign-in.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const session = await auth();
  const userEmail = (session?.user as { email?: string } | undefined)?.email;

  if (!adminEmail || !userEmail || userEmail.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect("/signin");
  }

  return (
    <div className="page-narrow">
      <nav className="mb-6 flex items-center gap-3 border-b border-line pb-4">
        <a href="/" className="text-sm font-medium text-ink-600 hover:text-ink-900">
          ← Home
        </a>
        <span className="text-ink-300">/</span>
        <span className="text-sm font-medium text-ink-900">Admin</span>
      </nav>
      {children}
    </div>
  );
}

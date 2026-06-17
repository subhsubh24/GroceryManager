import { PageHeader } from "@/app/components/page-header";
import { FeatureCard } from "@/app/components/feature-card";
import { sectionsByGroup } from "@/app/lib/sections";

/**
 * "All tools" — the full feature index (the long tail behind the focused home, per progressive
 * disclosure). Static: it renders the shared catalog grouped Cook → Shop → Track → You, with a calm
 * uniform card grid per group. No data reads here — just navigation.
 */
export default function ToolsPage() {
  const groups = sectionsByGroup();

  return (
    <main className="page">
      <PageHeader
        emoji="🧰"
        eyebrow="All tools"
        title="All tools"
        subtitle="Everything GroceryManager can do, organized."
        back={{ href: "/", label: "Home" }}
      />

      <div className="mt-10 space-y-12">
        {groups.map(({ group, items }) => (
          <section key={group}>
            <p className="eyebrow">{group}</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s, i) => (
                <FeatureCard key={s.key} s={s} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

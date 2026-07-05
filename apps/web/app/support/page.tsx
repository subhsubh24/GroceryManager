import { redirect } from "next/navigation";

/**
 * `/support` is the Support URL published in the App Store / Google Play listings. It's a stable
 * alias that redirects to the in-app Help & FAQ (which carries the FAQ + support email), so a
 * reviewer or user who follows the store's support link always lands on a real page — never a 404
 * (a 404 on a claimed support URL is a store-acceptance rejection risk).
 */
export default function SupportPage() {
  redirect("/help");
}

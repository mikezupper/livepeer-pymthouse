import { redirect } from "next/navigation";

/**
 * Usage dashboard is platform-wide at /billing or per-app at /apps/[id]/usage.
 * Keep old deep links working.
 */
export default function AppBillingRedirectPage() {
  redirect("/billing");
}

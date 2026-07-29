// Advisors get the same social feed as investors — view posts and post into it.
// Reuses the exact user feed page so there is a single source of truth; the
// feed loads for whoever is authenticated (here, the advisor's own account).
export { default, dynamic } from "@/app/user/feed/page";

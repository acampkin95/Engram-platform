import type { Metadata } from "next";
import SearchAnalyticsPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Search Analytics",
  description:
    "Search query performance, latency metrics, and pattern analysis for ENGRAM semantic search operations.",
};

export default function SearchAnalyticsPage() {
  return <SearchAnalyticsPageClient />;
}

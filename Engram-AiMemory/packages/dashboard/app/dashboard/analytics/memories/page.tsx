import type { Metadata } from "next";
import MemoriesAnalyticsPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Memory Analytics",
  description:
    "Memory growth trends, tier distribution charts, and importance score analytics for the ENGRAM memory system.",
};

export default function MemoriesAnalyticsPage() {
  return <MemoriesAnalyticsPageClient />;
}

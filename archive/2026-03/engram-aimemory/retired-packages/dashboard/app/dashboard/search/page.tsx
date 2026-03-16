import type { Metadata } from "next";
import SearchPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Semantic vector search across all ENGRAM memory tiers. Find relevant memories by meaning, not just keywords.",
};

export default function SearchPage() {
  return <SearchPageClient />;
}

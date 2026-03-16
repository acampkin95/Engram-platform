import type { Metadata } from "next";
import GraphPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Memory Graph",
  description:
    "Visual graph of the 3-tier memory architecture. Explore how memories flow and promote between Project, General, and Global tiers.",
};

export default function GraphPage() {
  return <GraphPageClient />;
}

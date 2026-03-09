import type { Metadata } from "next";
import KnowledgeGraphPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Entity Graph",
  description:
    "Knowledge graph entity explorer. Visualise relationships between entities extracted from stored memories.",
};

export default function KnowledgeGraphPage() {
  return <KnowledgeGraphPageClient />;
}

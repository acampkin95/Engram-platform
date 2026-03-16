import type { Metadata } from "next";
import ModelsPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "AI Models",
  description: "Embedding model configuration and management for ENGRAM's vector search pipeline.",
};

export default function ModelsPage() {
  return <ModelsPageClient />;
}

import type { Metadata } from "next";
import SystemHealthPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "System Health",
  description:
    "Infrastructure monitoring for ENGRAM services — Weaviate vector database, Redis cache, and API health status.",
};

export default function SystemHealthPage() {
  return <SystemHealthPageClient />;
}

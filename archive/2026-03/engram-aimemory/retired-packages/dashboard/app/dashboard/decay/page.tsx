import type { Metadata } from "next";
import DecayPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Memory Decay",
  description:
    "Visualise memory importance decay over time and configure decay parameters for each tier in ENGRAM.",
};

export default function DecayPage() {
  return <DecayPageClient />;
}

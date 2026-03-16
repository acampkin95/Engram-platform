import type { Metadata } from "next";
import SettingsPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Dashboard configuration, API connection settings, and preferences for the ENGRAM memory system.",
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}

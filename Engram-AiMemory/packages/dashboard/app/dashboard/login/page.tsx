import type { Metadata } from "next";
import LoginPageClient from "./_PageClient";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to the ENGRAM dashboard to manage your AI memory system.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return <LoginPageClient />;
}

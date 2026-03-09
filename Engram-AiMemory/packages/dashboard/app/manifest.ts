import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ENGRAM — Multi-Layer AI Memory System",
    short_name: "ENGRAM",
    description:
      "Persistent AI memory system with 5-tier cognitive architecture, semantic search, and knowledge graph.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#03020A",
    theme_color: "#F2A93B",
    lang: "en",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

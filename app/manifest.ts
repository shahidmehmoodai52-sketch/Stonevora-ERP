import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stonevora — ERP for Marble, Granite, Stone & Tile Businesses",
    short_name: "Stonevora",
    description:
      "Multi-tenant ERP for marble, granite, natural stone and tile businesses.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

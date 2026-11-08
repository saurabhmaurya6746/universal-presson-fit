import { useEffect } from "react";
import { brandConfig } from "@/config/branding";

interface SEOProps {
  title: string;
  description?: string;
}

export function SEO({ title, description }: SEOProps) {
  useEffect(() => {
    const isStudioPage = title.toLowerCase().includes("aura nails") || title.toLowerCase().includes("studio");
    const fullTitle =
      title.includes(brandConfig.brandName) || isStudioPage
        ? title
        : `${title} | ${brandConfig.brandName}`;
    document.title = fullTitle;

    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", description);
    }
  }, [title, description]);

  return null;
}

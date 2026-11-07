import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { GalleryModal } from "@/components/gallery/GalleryModal";
import { SEO } from "@/components/common/SEO";
import { gallery, galleryCategories } from "@/data/gallery";
import type { GalleryItem } from "@/types";

export function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);

  const displayedItems =
    selectedCategory === "All"
      ? gallery
      : gallery.filter((x) => x.category === selectedCategory);

  return (
    <>
      <SEO
        title="Nail Gallery"
        description="Explore Aura Nails extensions, press-ons, nail art, bridal, minimal, and statement designs."
      />

      <PageIntro eyebrow="The portfolio" title="Made to Be Admired">
        Explore nail stories shaped by soft color, fine detail, and a little bit of
        magic.
      </PageIntro>

      <section className="section-shell py-16">
        {/* Category Filters */}
        <div
          className="flex gap-2 overflow-x-auto pb-4"
          role="tablist"
          aria-label="Gallery categories"
        >
          {galleryCategories.map((category) => (
            <Button
              key={category}
              size="sm"
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              role="tab"
              aria-selected={selectedCategory === category}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Gallery Masonry Columns */}
        <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {displayedItems.map((item, index) => (
            <GalleryCard
              key={`${item.name}-${index}`}
              item={item}
              index={index}
              onSelect={setActiveItem}
            />
          ))}
        </div>
      </section>

      {/* Lightbox Dialog */}
      <GalleryModal
        item={activeItem}
        onClose={() => setActiveItem(null)}
      />
    </>
  );
}

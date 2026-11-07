import { Expand } from "lucide-react";
import type { GalleryItem } from "@/types";
import { cn } from "@/utils/cn";

export interface GalleryCardProps {
  item: GalleryItem;
  index: number;
  onSelect: (item: GalleryItem) => void;
}

export function GalleryCard({ item, index, onSelect }: GalleryCardProps) {
  const isSquare = index % 3 === 1;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group relative mb-5 block w-full break-inside-avoid cursor-pointer overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <img
        src={item.image}
        alt={item.name}
        loading="lazy"
        className={cn(
          "w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]",
          isSquare ? "aspect-square" : "aspect-[4/5]"
        )}
      />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-primary/80 to-transparent p-6 pt-20 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <span>
          <b className="block font-display text-2xl">{item.name}</b>
          <small className="text-primary-foreground/80">{item.category}</small>
        </span>
        <Expand className="size-5" />
      </span>
    </button>
  );
}

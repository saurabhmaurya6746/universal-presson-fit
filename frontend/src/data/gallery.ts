import type { GalleryItem } from "@/types";
import ivoryNails from "@/assets/images/nails-ivory.jpg";
import blushNails from "@/assets/images/nails-blush.jpg";
import mintNails from "@/assets/images/nails-mint.jpg";
import bridalNails from "@/assets/images/nails-bridal.jpg";
import heroNails from "@/assets/images/hero-nails.jpg";

export const galleryCategories = [
  "All",
  "Extensions",
  "Press-On",
  "Nail Art",
  "Bridal",
  "Minimal",
  "Statement",
] as const;

export type GalleryCategory = (typeof galleryCategories)[number];

export const gallery: GalleryItem[] = [
  {
    id: "ivory-line",
    name: "Ivory Line",
    category: "Minimal",
    image: ivoryNails,
    description: "A timeless French finish traced in fine gold.",
  },
  {
    id: "pearl-aura",
    name: "Pearl Aura",
    category: "Press-On",
    image: blushNails,
    description: "Blush chrome press-ons finished with pearls and crystals.",
  },
  {
    id: "garden-whisper",
    name: "Garden Whisper",
    category: "Nail Art",
    image: mintNails,
    description: "Soft mint tones and hand-painted botanical details.",
  },
  {
    id: "bridal-glow",
    name: "Bridal Glow",
    category: "Bridal",
    image: bridalNails,
    description: "Delicate pearls and sheer blush for luminous occasions.",
  },
  {
    id: "lavender-light",
    name: "Lavender Light",
    category: "Extensions",
    image: heroNails,
    description: "Iridescent almond extensions with an ethereal finish.",
  },
  {
    id: "modern-french",
    name: "Modern French",
    category: "Minimal",
    image: ivoryNails,
    description: "A refined modern classic for every day.",
  },
  {
    id: "crystal-bloom",
    name: "Crystal Bloom",
    category: "Statement",
    image: blushNails,
    description: "Jewelry-inspired details designed to be noticed.",
  },
  {
    id: "mint-botanica",
    name: "Mint Botanica",
    category: "Press-On",
    image: mintNails,
    description: "A fresh handmade set inspired by quiet gardens.",
  },
];

import type { ServiceItem } from "@/types";
import ivoryNails from "@/assets/images/nails-ivory.jpg";
import blushNails from "@/assets/images/nails-blush.jpg";
import mintNails from "@/assets/images/nails-mint.jpg";
import bridalNails from "@/assets/images/nails-bridal.jpg";
import heroNails from "@/assets/images/hero-nails.jpg";

export const services: ServiceItem[] = [
  {
    id: "extensions",
    title: "Nail Extensions",
    category: "Extensions",
    description: "Elegant, durable nail extensions customized to your preferred shape, length and style.",
    image: ivoryNails,
    priceNote: "Price on consultation",
    durationNote: "Duration varies",
  },
  {
    id: "press-ons",
    title: "Custom Press-On Nails",
    category: "Press-On",
    description: "Handmade press-on nail sets designed specifically for your aesthetic and occasion.",
    image: blushNails,
    priceNote: "Price on consultation",
    durationNote: "Duration varies",
  },
  {
    id: "nail-art",
    title: "Custom Nail Art",
    category: "Nail Art",
    description: "Personalized nail art ranging from minimal elegance to detailed statement designs.",
    image: mintNails,
    priceNote: "Price on consultation",
    durationNote: "Duration varies",
  },
  {
    id: "bridal",
    title: "Bridal / Event Nails",
    category: "Bridal",
    description: "Specially curated nail sets for weddings, parties, celebrations and important occasions.",
    image: bridalNails,
    priceNote: "Price on consultation",
    durationNote: "Duration varies",
  },
  {
    id: "custom-sets",
    title: "Custom Sets",
    category: "Statement",
    description: "Tell us your vision and we create a unique nail set around your style.",
    image: heroNails,
    priceNote: "Price on consultation",
    durationNote: "Duration varies",
  },
];

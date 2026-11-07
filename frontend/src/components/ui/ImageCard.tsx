import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ImageCardProps {
  image: string;
  title: string;
  description: string;
  to?: "/services" | "/gallery" | string;
}

export function ImageCard({
  image,
  title,
  description,
  to = "/services",
}: ImageCardProps) {
  return (
    <article className="group overflow-hidden bg-card shadow-soft">
      <div className="aspect-[4/5] overflow-hidden">
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
        />
      </div>
      <div className="p-6">
        <h3 className="font-display text-3xl font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <Button asChild variant="link" className="mt-4">
          <Link to={to}>
            View {to === "/gallery" ? "Collection" : "Service"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

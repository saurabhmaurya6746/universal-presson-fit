import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import type { GalleryItem } from "@/types";

export interface GalleryModalProps {
  item: GalleryItem | null;
  onClose: () => void;
}

export function GalleryModal({ item, onClose }: GalleryModalProps) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden border-none p-0 sm:max-w-4xl">
        <div className="grid md:grid-cols-[1.3fr_.7fr]">
          {item && (
            <>
              <div className="max-h-[50vh] overflow-hidden md:max-h-[80vh]">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="self-center p-8">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-lavender-deep">
                  {item.category}
                </p>
                <DialogTitle className="mt-3 font-display text-4xl">
                  {item.name}
                </DialogTitle>
                <DialogDescription className="mt-4 leading-7 text-muted-foreground">
                  {item.description}
                </DialogDescription>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

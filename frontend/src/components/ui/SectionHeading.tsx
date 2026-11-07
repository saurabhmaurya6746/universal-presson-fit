import { cn } from "@/utils/cn";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  text?: string;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  centered = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
        className
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-lavender-deep">
          {eyebrow}
        </p>
      )}
      <h2 className="text-4xl font-semibold leading-tight sm:text-6xl">
        {title}
      </h2>
      {text && (
        <p className="mt-5 leading-7 text-muted-foreground">{text}</p>
      )}
    </div>
  );
}

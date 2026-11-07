import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface PageIntroProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  className?: string;
}

export function PageIntro({ eyebrow, title, children, className }: PageIntroProps) {
  return (
    <section className={cn("bg-lavender/35 py-20 sm:py-28", className)}>
      <div className="section-shell max-w-4xl text-center reveal">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-lavender-deep">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-5xl font-semibold leading-[.95] sm:text-7xl">
          {title}
        </h1>
        <div className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
          {children}
        </div>
      </div>
    </section>
  );
}

import { Check, X, Coins, Sparkles, SunMedium, Hand } from "lucide-react";

export function PhotoGuidance() {
  const fourEssentials = [
    {
      icon: Hand,
      title: "Haath ko seedha aur flat rakhein",
      desc: "Keep hand flat on a flat surface with fingers naturally straight and parallel.",
    },
    {
      icon: Sparkles,
      title: "Sabhi nails camera mein visible hon",
      desc: "Ensure all fingernails face directly up at the overhead camera with slight space between fingers.",
    },
    {
      icon: SunMedium,
      title: "Photo well-lit ho",
      desc: "Use even, bright indoor lighting without dark shadows or blinding reflective flash glare.",
    },
    {
      icon: Coins,
      title: "₹10 coin ko haath ke paas flat rakhein (Nails cover na hon)",
      desc: "Place a standard ₹10 coin flat beside your hand on the exact same surface. Never place it on top of fingers or nails.",
    },
  ];

  const dos = [
    "Overhead camera angle (90° straight down)",
    "Clean background with high contrast",
    "Both hand and complete ₹10 coin in frame",
    "Bare natural nails for precise width detection",
  ];

  const donts = [
    "Angled, tilted, or perspective camera shots",
    "Bent, curled, or rolled fingers",
    "Fingers overlapping or touching each other",
    "Coin missing, covered, or resting on uneven surface",
  ];

  return (
    <aside className="bg-card p-6 sm:p-7 shadow-soft rounded-2xl border border-border/70">
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
        Photo Instructions
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Accurate millimeter measurement requires a clean, calibrated overhead photo.
      </p>

      {/* 4 Essential Guidelines */}
      <div className="mt-5 space-y-3">
        {fourEssentials.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-xl bg-lavender/25 p-3.5 border border-lavender-deep/20"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-lavender-deep/20 text-lavender-deep">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-5 border-t border-border/60 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-2">
            Do's
          </p>
          <ul className="space-y-2 text-xs">
            {dos.map((item) => (
              <li key={item} className="flex items-start gap-2 text-muted-foreground">
                <Check className="size-3.5 shrink-0 text-emerald-600 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-2">
            Don'ts
          </p>
          <ul className="space-y-2 text-xs">
            {donts.map((item) => (
              <li key={item} className="flex items-start gap-2 text-muted-foreground">
                <X className="size-3.5 shrink-0 text-destructive mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

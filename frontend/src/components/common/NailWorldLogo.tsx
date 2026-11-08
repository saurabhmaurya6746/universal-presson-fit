import React from "react";
import horizontalSvg from "@/assets/logo/nail-world-horizontal.svg";
import iconSvg from "@/assets/logo/nail-world-icon.svg";
import badgeSvg from "@/assets/logo/nail-world-badge.svg";

interface NailWorldLogoProps {
  /**
   * 'horizontal': Full logo with icon + typography + subtitle
   * 'icon': Compact round emblem with orbital ring & almond nail (ideal for avatars & mobile navbar)
   * 'badge': Circular luxury atelier seal
   */
  variant?: "horizontal" | "icon" | "badge";
  /**
   * Tailwind size class or custom className
   */
  className?: string;
  /**
   * Explicit height in pixels for precise SVG scaling
   */
  height?: number | string;
  /**
   * Explicit width in pixels for precise SVG scaling
   */
  width?: number | string;
  /**
   * Accessible alt / aria label
   */
  alt?: string;
}

export const NailWorldLogo: React.FC<NailWorldLogoProps> = ({
  variant = "horizontal",
  className = "",
  height,
  width,
  alt = "Nail World Luxury Atelier",
}) => {
  const getSrc = () => {
    switch (variant) {
      case "icon":
        return iconSvg;
      case "badge":
        return badgeSvg;
      case "horizontal":
      default:
        return horizontalSvg;
    }
  };

  return (
    <img
      src={getSrc()}
      alt={alt}
      className={`select-none object-contain transition-transform duration-200 ${className}`}
      style={{
        height: height ?? (variant === "horizontal" ? "42px" : "40px"),
        width: width ?? "auto",
      }}
      loading="eager"
    />
  );
};

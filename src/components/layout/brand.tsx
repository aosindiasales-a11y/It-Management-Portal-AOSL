import Image from "next/image";

import { cn } from "@/lib/utils";

const LOGO_ASPECT = 628 / 138;

interface BrandProps {
  className?: string;
  /** "dark" for navy surfaces (sidebar, topbar); "default" for light backgrounds (login card). */
  variant?: "default" | "dark";
  size?: "sm" | "md" | "lg";
}

const SIZES: Record<NonNullable<BrandProps["size"]>, number> = { sm: 22, md: 28, lg: 44 };

export function Brand({ className, variant = "default", size = "md" }: BrandProps) {
  const height = SIZES[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/brand/aosl-logo.png"
        alt="Aviation Overseas Supply Logistics"
        width={Math.round(height * LOGO_ASPECT)}
        height={height}
        style={{ height, width: "auto" }}
        priority
      />
      <div className={cn("hidden h-6 w-px shrink-0 sm:block", variant === "dark" ? "bg-white/20" : "bg-border")} />
      <span
        className={cn(
          "hidden text-sm font-semibold tracking-tight sm:block",
          variant === "dark" ? "text-white" : "text-foreground"
        )}
      >
        IT Manager Portal
      </span>
    </div>
  );
}

import logoSombre from "@/assets/mon-logo-sombre.png";
import logoClair from "@/assets/mon-logo-clair.png";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  const { theme } = useApp();
  const src = theme === "dark" ? logoSombre : logoClair;

  return (
    <img
      src={src}
      alt="DabbyMarket"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain rounded-xl", className)}
      style={{ width: size, height: size }}
    />
  );
}

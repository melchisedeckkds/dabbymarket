import { cn } from "@/lib/utils";

export function Pepite({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id="pepGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff6c9" />
          <stop offset="45%" stopColor="#f2d675" />
          <stop offset="100%" stopColor="#8a6410" />
        </radialGradient>
      </defs>
      <path
        d="M6 4c3-1 8-1 12 1 2 1 3 3 2 5-1 3 1 4 1 6 0 3-4 4-8 4-5 0-9-1-10-4-1-2 1-3 1-6 0-3 1-5 2-6z"
        fill="url(#pepGrad)"
        stroke="#5c4406"
        strokeWidth="0.6"
      />
      <path d="M9 8c2-1 5-1 7 0" stroke="#fff2b8" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

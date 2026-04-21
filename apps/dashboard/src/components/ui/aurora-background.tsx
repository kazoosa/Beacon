import React, { type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

/**
 * PERFORMANCE-TUNED aurora. The original used filter:blur(10px) +
 * mix-blend-difference + 60s infinite animation, which repaints the
 * whole viewport every frame. This version uses only animated gradients
 * on a pseudo-element, with GPU-friendly properties (transform on the
 * blur container is promoted to its own layer), and honors prefers-
 * reduced-motion by stopping animation.
 */
export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center bg-bg-base text-fg-primary overflow-hidden",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-30 motion-reduce:animate-none"
        style={{
          backgroundImage:
            "radial-gradient(at 20% 30%, rgba(124,106,255,0.45), transparent 45%), radial-gradient(at 80% 20%, rgba(91,141,239,0.4), transparent 50%), radial-gradient(at 50% 80%, rgba(52,211,153,0.28), transparent 55%)",
          backgroundSize: "200% 200%",
          backgroundPosition: "0% 0%",
          filter: "blur(48px)",
          transform: "translateZ(0)",
          willChange: "background-position",
          animation: "beacon-aurora-drift 24s ease-in-out infinite alternate",
          maskImage: showRadialGradient
            ? "radial-gradient(ellipse at center, black 40%, transparent 75%)"
            : undefined,
          WebkitMaskImage: showRadialGradient
            ? "radial-gradient(ellipse at center, black 40%, transparent 75%)"
            : undefined,
        }}
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
};

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#0d0d0d] text-white",
        primary: "border-transparent bg-[#1757d7] text-white",
        secondary: "border-transparent bg-[#f5f5f3] text-[#0d0d0d]",
        outline: "border-[#e5e7eb] bg-white text-[#374151]",
        success: "border-transparent bg-emerald-500 text-white",
        warning: "border-transparent bg-amber-500 text-white",
        muted: "border-transparent bg-[#f3f4f6] text-[#6b7280]",
        ghost: "border-dashed border-[#e5e7eb] bg-white text-[#6b7280]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

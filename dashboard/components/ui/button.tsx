import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-[13px]",
  {
      variants: {
        variant: {
          default: "bg-primary text-white hover:bg-black/90 ring-offset-black",
          secondary:
            "bg-accent text-white hover:bg-accent-soft ring-offset-black",
          ghost:
            "bg-transparent text-foreground hover:bg-white/5 hover:text-foreground",
          outline:
            "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 ring-offset-white",
        },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-lg px-3",
        lg: "h-10 rounded-2xl px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

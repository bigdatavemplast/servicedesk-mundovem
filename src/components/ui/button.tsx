import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const minimalButton =
  "border-0 bg-transparent font-medium text-muted-foreground shadow-none hover:bg-transparent hover:text-muted-foreground dark:bg-transparent dark:hover:bg-transparent [&_svg]:transition-colors group-hover:[&_svg]:text-[#9C1917] dark:group-hover:[&_svg]:text-[#E07A75]";

const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: minimalButton,
        destructive: "border-0 bg-transparent font-medium text-muted-foreground shadow-none hover:bg-transparent hover:text-[#9C1917] dark:bg-transparent dark:hover:bg-transparent dark:hover:text-[#E07A75] [&_svg]:transition-colors",
        outline: minimalButton,
        secondary: minimalButton,
        ghost: minimalButton,
        link: "text-muted-foreground underline-offset-4 hover:text-[#9C1917] hover:underline dark:hover:text-[#E07A75]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

import { Button, ButtonProps } from "@/shared/ui/button";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

export interface ButtonWithIconProps extends ButtonProps {
  children: React.ReactNode;
}

export const ButtonWithIcon = React.forwardRef<HTMLButtonElement, ButtonWithIconProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "relative text-sm font-medium rounded-full h-12 p-1 ps-6 pe-14 group transition-all duration-500 hover:ps-14 hover:pe-6 overflow-hidden cursor-pointer",
          className
        )}
        {...props}
      >
        <span className="relative z-10 transition-all duration-500">
          {children}
        </span>
        <div className="absolute right-1 w-10 h-10 bg-background text-foreground rounded-full flex items-center justify-center transition-all duration-500 group-hover:right-[calc(100%-44px)] group-hover:rotate-45">
          <ArrowUpRight size={16} />
        </div>
      </Button>
    );
  }
);

ButtonWithIcon.displayName = "ButtonWithIcon";

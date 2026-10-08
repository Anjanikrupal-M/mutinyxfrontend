import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Higher-contrast track + visible border so the switch doesn't blend into dark surfaces.
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-border transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Give the thumb a subtle outline so it's visible even when bg colors are close.
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-1 ring-border transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-primary-foreground data-[state=checked]:ring-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

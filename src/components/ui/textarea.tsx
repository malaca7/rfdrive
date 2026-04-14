import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(22_100%_55%/0.3)] focus-visible:border-[hsl(22_100%_55%/0.5)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

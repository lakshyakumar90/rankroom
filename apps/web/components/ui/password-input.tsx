"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = React.ComponentProps<"input">;

function PasswordInput({ className, disabled, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const inputType = isVisible ? "text" : "password";

  return (
    <div className="relative">
      <Input
        type={inputType}
        className={cn("pr-11", className)}
        disabled={disabled}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 size-9 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
        onClick={() => setIsVisible((current) => !current)}
        disabled={disabled}
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
      >
        {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  );
}

export { PasswordInput };

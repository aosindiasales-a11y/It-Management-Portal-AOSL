"use client";

import { cn } from "@/lib/utils";

interface Rule {
  label: string;
  test: (value: string) => boolean;
}

const RULES: Rule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "One number", test: (v) => /[0-9]/.test(v) },
  { label: "One special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const LEVELS = [
  { label: "Very weak", className: "bg-destructive" },
  { label: "Weak", className: "bg-destructive" },
  { label: "Fair", className: "bg-warning" },
  { label: "Good", className: "bg-warning" },
  { label: "Strong", className: "bg-success" },
];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const passed = RULES.filter((rule) => rule.test(password)).length;
  const level = password.length === 0 ? null : (LEVELS[Math.min(passed, LEVELS.length - 1)] ?? LEVELS[0]!);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {RULES.map((rule, i) => (
          <div
            key={rule.label}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-secondary transition-colors",
              level && i < passed && level.className
            )}
          />
        ))}
      </div>
      {level && <p className="text-xs text-muted-foreground">Strength: {level.label}</p>}
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        {RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className={cn("flex items-center gap-1.5", ok && "text-success")}>
              <span className={cn("h-1 w-1 rounded-full bg-muted-foreground", ok && "bg-success")} />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

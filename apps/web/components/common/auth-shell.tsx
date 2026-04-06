import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function AuthShell({
  badge,
  title,
  description,
  hero,
  form,
  reverse = false,
}: {
  badge: string;
  title: string;
  description: string;
  hero: ReactNode;
  form: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:py-10">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,var(--color-primary),transparent_55%)] opacity-20" />
      <div className="absolute left-0 top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 size-80 rounded-full bg-accent/35 blur-3xl" />

      <div
        className={`mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 ${
          reverse ? "lg:grid-cols-[0.95fr_1.05fr]" : "lg:grid-cols-[1.05fr_0.95fr]"
        }`}
      >
        <section className={`surface-panel overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-12 ${reverse ? "lg:order-2" : ""}`}>
          <div className="flex h-full flex-col justify-between gap-10">
            <div className="flex flex-col gap-5">
              <Badge variant="secondary" className="w-fit rounded-full px-4 py-1">
                {badge}
              </Badge>
              <div className="flex flex-col gap-3">
                <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  {title}
                </h1>
                <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {description}
                </p>
              </div>
            </div>
            {hero}
          </div>
        </section>

        <div className={reverse ? "lg:order-1" : ""}>{form}</div>
      </div>
    </div>
  );
}

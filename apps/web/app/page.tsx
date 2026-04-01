"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Code2, Sparkles, Trophy, Users, ShieldCheck, Gamepad2, LineChart, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getDefaultRouteForRole } from "@/lib/route-access";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FADE_UP_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } },
} as const;

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30">
      {/* Navbar */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm py-3" : "bg-transparent py-5"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2 font-bold tracking-tight text-xl">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Code2 className="size-5" />
            </div>
            RankRoom
          </div>
          <div className="flex items-center gap-4">
            {!isLoading ? (
              user ? (
                <Button asChild size="sm" className="rounded-full px-5 shadow-sm">
                  <Link href={getDefaultRouteForRole(user.role)}>
                    Dashboard
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm" className="hidden sm:flex rounded-full">
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm" className="rounded-full px-5 shadow-sm">
                    <Link href="/register">Get Started</Link>
                  </Button>
                </div>
              )
            ) : (
              <div className="h-9 w-24 animate-pulse rounded-full bg-muted/50" />
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="relative overflow-hidden pt-36 lg:pt-48 pb-20 lg:pb-32">
          {/* Background effects */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_50%)]" />
          <div className="absolute -top-40 left-1/2 z-0 hidden h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px] lg:block" />

          <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
            <motion.div
              initial="hidden"
              animate="show"
              viewport={{ once: true }}
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.15,
                  },
                },
              }}
              className="text-center"
            >
              <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="mb-6 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur-sm">
                  <Sparkles className="size-4" />
                  The Next Generation of Academic Management
                </span>
              </motion.div>
              
              <motion.h1
                variants={FADE_UP_ANIMATION_VARIANTS}
                className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl"
              >
                Gamify learning, <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                  accelerate growth
                </span>
              </motion.h1>
              
              <motion.p
                variants={FADE_UP_ANIMATION_VARIANTS}
                className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl"
              >
                A unified platform integrating daily academic workflows with highly engaging competitive programming events, hackathons, and global leaderboards.
              </motion.p>
              
              <motion.div
                variants={FADE_UP_ANIMATION_VARIANTS}
                className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                {!isLoading ? (
                  user ? (
                    <Button asChild size="lg" className="h-12 w-full sm:w-auto rounded-full px-8 text-base shadow-lg shadow-primary/20">
                      <Link href={getDefaultRouteForRole(user.role)}>
                        Go to Dashboard
                        <ArrowRight className="ml-2 size-5" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" className="h-12 w-full sm:w-auto rounded-full px-8 text-base shadow-lg shadow-primary/20">
                        <Link href="/register">Start for free</Link>
                      </Button>
                      <Button asChild variant="outline" size="lg" className="h-12 w-full sm:w-auto rounded-full px-8 text-base border-border">
                        <Link href="/login">Sign in back</Link>
                      </Button>
                    </>
                  )
                ) : (
                  <Button disabled size="lg" className="h-12 w-full sm:w-auto rounded-full px-8 text-base opacity-70">
                    <Loader2 className="mr-2 size-5 animate-spin" /> Fetching session
                  </Button>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features grid */}
        <section className="bg-muted/10 py-24 sm:py-32 border-y border-border/50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-base font-semibold leading-7 text-primary tracking-wide uppercase">Everything you need</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Platform Capabilities</p>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                RankRoom pairs rigorous academic tracking with a native intelligent competitive ecosystem.
              </p>
            </div>
            
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                {[
                  {
                    name: 'Competitive Leaderboards',
                    description: 'Climb the global and class ranks by submitting assignments, winning hackathons, and acing subject contests.',
                    icon: Trophy,
                  },
                  {
                    name: 'Institution-wide Hackathons',
                    description: 'Register for mega-events, build powerful projects, and receive massive experience points and certificates for winning.',
                    icon: Users,
                  },
                  {
                    name: 'Built-in Code Execution',
                    description: 'Solve problems natively in the browser with our judge subsystem supporting C++, Java, Rust, Python, and more.',
                    icon: Gamepad2, 
                  },
                  {
                    name: 'Attendance & Grades',
                    description: 'Stay seamlessly on top of your daily academic expectations via a centralized, beautifully designed tracker.',
                    icon: ShieldCheck,
                  },
                  {
                    name: 'Developer Profile Heatmap',
                    description: 'Directly sync your GitHub, LeetCode, and Codeforces to automatically generate a unified activity heatmap.',
                    icon: LineChart,
                  },
                  {
                    name: 'Automated Analytics',
                    description: 'Teachers and administrators receive insightful, localized metrics to identify top performers and structural delays.',
                    icon: Sparkles,
                  },
                ].map((feature, idx) => (
                  <motion.div 
                    key={feature.name} 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="flex flex-col rounded-2xl border border-border/50 bg-background/50 p-8 shadow-sm backdrop-blur-sm transition-colors hover:bg-muted/30"
                  >
                    <dt className="flex items-center gap-x-3 text-base font-semibold leading-7">
                      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-sm border border-primary/10">
                        <feature.icon className="size-5 text-primary" aria-hidden="true" />
                      </div>
                      {feature.name}
                    </dt>
                    <dd className="mt-4 flex flex-auto flex-col text-sm leading-6 text-muted-foreground">
                      <p className="flex-auto leading-relaxed">{feature.description}</p>
                    </dd>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-10 text-center">
        <div className="flex items-center justify-center gap-2 font-semibold tracking-tight mb-4">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Code2 className="size-3" />
            </div>
            RankRoom
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} RankRoom Platform. Built for academic excellence.
        </p>
      </footer>
    </div>
  );
}

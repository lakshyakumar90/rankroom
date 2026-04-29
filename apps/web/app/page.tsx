"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Code2,
  Database,
  Gamepad2,
  GraduationCap,
  LineChart,
  Loader2,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getDefaultRouteForRole } from "@/lib/route-access";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FADE_UP_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 54, damping: 18 } },
} as const;

const platformStats = [
  { value: "360°", label: "Academic + coding view" },
  { value: "5", label: "Role-aware workspaces" },
  { value: "1", label: "Admin-controlled identity layer" },
  { value: "Live", label: "Signals for attendance, contests, grades" },
];

const capabilityGroups: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  points: string[];
}> = [
  {
    title: "Academic operating system",
    description: "Bring attendance, grades, subjects, sections, and teacher workflows into one clean campus command center.",
    icon: GraduationCap,
    points: ["Section-aware attendance", "Subject result tracking", "Department-level views"],
  },
  {
    title: "Competitive coding layer",
    description: "Run problems, contests, and leaderboards without sending students into a separate disconnected tool.",
    icon: Gamepad2,
    points: ["Native code execution", "Contest registration", "Skill and XP momentum"],
  },
  {
    title: "Student intelligence",
    description: "Turn submissions, attendance, platform syncs, and academic records into useful progress snapshots.",
    icon: LineChart,
    points: ["Developer profiles", "Risk signals", "Performance panels"],
  },
  {
    title: "Admin-governed access",
    description: "No open signup. Admins provision users, roles, and class context so the system stays institution-controlled.",
    icon: LockKeyhole,
    points: ["Role-based routes", "Managed onboarding", "Verified account creation"],
  },
];

const roleCards: Array<{
  title: string;
  label: string;
  icon: LucideIcon;
  description: string;
}> = [
  {
    title: "Students",
    label: "Practice + progress",
    icon: Code2,
    description: "Solve problems, track grades, join contests, review attendance, and build a public developer profile.",
  },
  {
    title: "Teachers",
    label: "Class execution",
    icon: BookOpen,
    description: "Manage class activity, evaluate work, monitor subject performance, and support students before issues pile up.",
  },
  {
    title: "Department heads",
    label: "Cohort visibility",
    icon: Network,
    description: "See department health across sections, hackathons, subjects, performance gaps, and operational movement.",
  },
  {
    title: "Admins",
    label: "Control plane",
    icon: UserCog,
    description: "Create users, assign roles, connect students to sections, and keep the campus identity model clean.",
  },
];

const workflowSteps = [
  {
    title: "Provision the cohort",
    description: "Admins create students, teachers, class coordinators, and department heads with the right section or department context.",
    icon: Users,
  },
  {
    title: "Run daily academics",
    description: "Teachers and coordinators handle attendance, assignments, grades, and class progress from the same dashboard rhythm.",
    icon: CalendarCheck,
  },
  {
    title: "Launch competitions",
    description: "Departments can run contests and hackathons with targeted eligibility, participants, problem sets, and leaderboards.",
    icon: Trophy,
  },
  {
    title: "Act on signals",
    description: "Analytics surfaces high performers, slipping attendance, weak topics, and student momentum before review meetings.",
    icon: Activity,
  },
];

const trustItems = [
  "Public registration removed",
  "Admin and super-admin user creation",
  "Role-aware routing and backend authorization",
  "Section, department, and subject assignments",
  "Deactivation controls for managed accounts",
  "Single profile synced from verified identity",
];

export default function RootPage() {
  const { user, isLoading } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground antialiased selection:bg-primary/30">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "border-b border-border bg-background/85 py-3 shadow-sm backdrop-blur-xl"
            : "bg-transparent py-5"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Code2 className="size-5" />
            </div>
            RankRoom
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">Platform</a>
            <a href="#roles" className="transition-colors hover:text-foreground">Roles</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
            <a href="#security" className="transition-colors hover:text-foreground">Access</a>
          </nav>
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
                    <Link href="/login">Access RankRoom</Link>
                  </Button>
                </div>
              )
            ) : (
              <div className="h-9 w-24 animate-pulse rounded-full bg-muted/50" />
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pb-20 pt-32 sm:pt-40 lg:pb-28 lg:pt-44">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,var(--color-primary),transparent_34%),radial-gradient(circle_at_80%_20%,var(--color-secondary),transparent_30%)] opacity-15" />
          <div className="absolute left-1/2 top-12 -z-10 hidden h-160 w-160 -translate-x-1/2 rounded-full bg-primary/12 blur-[130px] lg:block" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-linear-to-t from-background to-transparent" />

          <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.12 } },
              }}
              className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]"
            >
              <div>
                <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur-sm">
                  <Sparkles className="size-4" />
                  Managed campus learning, coding, and analytics
                </motion.div>

                <motion.h1 variants={FADE_UP_ANIMATION_VARIANTS} className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                  One academic control room for
                  <span className="block bg-linear-to-r from-primary via-foreground to-primary/70 bg-clip-text text-transparent">
                    classrooms that code.
                  </span>
                </motion.h1>

                <motion.p variants={FADE_UP_ANIMATION_VARIANTS} className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  RankRoom connects attendance, grades, assignments, coding practice, contests, hackathons, profiles, and institutional analytics in a single role-aware workspace.
                </motion.p>

                <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                  {!isLoading ? (
                    user ? (
                      <Button asChild size="lg" className="h-12 rounded-full px-8 text-base shadow-lg shadow-primary/20">
                        <Link href={getDefaultRouteForRole(user.role)}>
                          Go to Dashboard
                          <ArrowRight className="ml-2 size-5" />
                        </Link>
                      </Button>
                    ) : (
                      <>
                        <Button asChild size="lg" className="h-12 rounded-full px-8 text-base shadow-lg shadow-primary/20">
                          <Link href="/login">
                            Sign in to RankRoom
                            <ArrowRight className="ml-2 size-5" />
                          </Link>
                        </Button>
                        <div className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
                          Accounts are created by administrators.
                        </div>
                      </>
                    )
                  ) : (
                    <Button disabled size="lg" className="h-12 rounded-full px-8 text-base opacity-70">
                      <Loader2 className="mr-2 size-5 animate-spin" /> Fetching session
                    </Button>
                  )}
                </motion.div>

                <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {platformStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-sm backdrop-blur">
                      <p className="text-2xl font-black tracking-tight">{stat.value}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </motion.div>
              </div>

              <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="relative">
                <div className="absolute -inset-4 rounded-[2rem] bg-primary/10 blur-3xl" />
                <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full bg-destructive/70" />
                      <span className="size-3 rounded-full bg-yellow-500/70" />
                      <span className="size-3 rounded-full bg-emerald-500/70" />
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Live campus pulse</span>
                  </div>
                  <div className="grid gap-4 p-5">
                    <div className="rounded-2xl bg-foreground p-5 text-background">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-background/70">Today&apos;s command view</p>
                          <p className="mt-2 text-3xl font-black">82% active learning signal</p>
                        </div>
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-background/10">
                          <BarChart3 className="size-7" />
                        </div>
                      </div>
                      <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
                        {["Attendance", "Submissions", "Grades"].map((item, index) => (
                          <div key={item} className="rounded-xl bg-background/10 p-3">
                            <p className="text-background/60">{item}</p>
                            <p className="mt-2 text-lg font-bold">{[91, 248, 37][index]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PreviewCard icon={Trophy} title="Contest window" value="3 live" detail="Section + department events" />
                      <PreviewCard icon={Bell} title="Priority alerts" value="12" detail="Low attendance and pending reviews" />
                      <PreviewCard icon={Database} title="Provisioning" value="Admin only" detail="Students and roles are managed" />
                      <PreviewCard icon={Zap} title="Momentum" value="+18%" detail="Skill growth over last cycle" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section id="platform" className="border-y border-border/50 bg-muted/10 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <SectionHeader
              eyebrow="Platform"
              title="A complete learning operations layer"
              description="The landing page now tells the full story: RankRoom is not only a coding tool, and it is not only an academic tracker. It is where both sides work together."
            />

            <div className="mt-14 grid gap-5 lg:grid-cols-4">
              {capabilityGroups.map((feature, index) => (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-70px" }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="group rounded-3xl border border-border bg-background/75 p-6 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary shadow-sm">
                    <feature.icon className="size-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-bold tracking-tight">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  <div className="mt-6 space-y-3">
                    {feature.points.map((point) => (
                      <div key={point} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-primary" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <SectionHeader
                align="left"
                eyebrow="Role-aware by design"
                title="Every stakeholder gets the right workspace"
                description="RankRoom keeps student, teacher, department, and admin workflows distinct while sharing the same source of truth."
              />
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  {roleCards.map((role) => (
                    <div key={role.title} className="rounded-2xl border border-border/70 bg-background p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{role.label}</p>
                          <h3 className="mt-2 text-lg font-bold">{role.title}</h3>
                        </div>
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <role.icon className="size-5" />
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">{role.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="relative overflow-hidden border-y border-border/50 bg-foreground py-24 text-background sm:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.12),transparent_24%)]" />
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-background/60">Operating rhythm</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">From user creation to action-ready analytics.</h2>
              <p className="mt-5 text-lg leading-8 text-background/70">
                The platform follows the real academic loop: onboard the cohort, run the semester, create competitive moments, and use signals to help students faster.
              </p>
            </div>

            <div className="mt-14 grid gap-4 lg:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-70px" }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="relative rounded-3xl border border-background/15 bg-background/8 p-6 backdrop-blur"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-background text-foreground">
                      <step.icon className="size-6" />
                    </div>
                    <span className="text-4xl font-black text-background/20">0{index + 1}</span>
                  </div>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-background/70">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  {trustItems.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background p-4">
                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <p className="text-sm font-medium leading-6">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Access model</p>
                <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">No open signup. No messy identity drift.</h2>
                <p className="mt-5 text-lg leading-8 text-muted-foreground">
                  RankRoom is built for institutions where user identity, roles, sections, and departments need to be deliberate. Admins create accounts, assign users, and keep access clean from day one.
                </p>
                <div className="mt-8 rounded-3xl border border-border bg-muted/30 p-5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="size-6 text-primary" />
                    <p className="font-semibold">Students and staff receive access after admin provisioning.</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    This keeps academic records, coding profiles, attendance, grades, and analytics tied to verified campus accounts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 sm:pb-32 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl shadow-primary/5">
            <div className="grid gap-0 lg:grid-cols-[1fr_0.82fr]">
              <div className="p-8 sm:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Built for momentum</p>
                <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
                  Give every cohort a sharper way to learn, compete, and improve.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                  RankRoom turns daily classroom operations into a living feedback loop, with coding culture built directly into the academic experience.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-12 rounded-full px-8">
                    <Link href={user ? getDefaultRouteForRole(user.role) : "/login"}>
                      {user ? "Open dashboard" : "Sign in"}
                      <ArrowRight className="ml-2 size-5" />
                    </Link>
                  </Button>
                  {!user ? (
                    <div className="flex items-center rounded-full border border-border px-4 text-sm text-muted-foreground">
                      Need an account? Contact your administrator.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-border bg-muted/20 p-8 lg:border-l lg:border-t-0">
                <div className="grid h-full gap-4">
                  <MetricRow label="Academic operations" value="Attendance, grades, sections" icon={BookOpen} />
                  <MetricRow label="Coding culture" value="Problems, contests, hackathons" icon={Code2} />
                  <MetricRow label="Insights" value="Analytics and performance panels" icon={BarChart3} />
                  <MetricRow label="Access" value="Admin-managed provisioning" icon={LockKeyhole} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Code2 className="size-4" />
            </div>
            RankRoom
          </div>
          <p>© {new Date().getFullYear()} RankRoom Platform. Built for managed academic excellence.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-lg font-black">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-background p-5">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}


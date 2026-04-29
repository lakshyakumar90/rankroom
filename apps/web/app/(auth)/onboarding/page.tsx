export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">RankRoom onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Complete your academic identity</h1>
          <p className="mt-3 text-muted-foreground">
            Add your profile details, public handle, coding platform usernames, skills, projects, and achievements so RankRoom can connect academic workflows with coding engagement.
          </p>
          <a
            href="/profile/edit"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Open profile setup
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Profile", "Name, handle, bio, phone, resume, and visibility."],
            ["2", "Coding", "GitHub, LeetCode, CodeChef, Codeforces, and heatmap sync."],
            ["3", "Portfolio", "Skills, projects, certificates, and achievements."],
          ].map(([step, title, body]) => (
            <section key={step} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{step}</div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

import Groq from "groq-sdk";
import { z } from "zod";
import type { CoachAdvice, SkillGraphResponse } from "@repo/types";

const coachPayloadSchema = z.object({
  warning: z.string().min(1).max(240),
  motivation: z.string().min(1).max(240),
  tasks: z.array(z.string().min(1).max(180)).min(3).max(3),
});

export interface CoachGenerationContext {
  userId: string;
  skills: SkillGraphResponse["skills"];
  summary: SkillGraphResponse["summary"];
  currentStreak: number;
  lastActiveDate: string | null;
  recentContestRank: number | null;
}

function parseCoachPayload(raw: string) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return coachPayloadSchema.parse(JSON.parse(cleaned));
}

function buildFallbackAdvice(context: CoachGenerationContext) {
  const weakest = context.summary.weakestSkills[0];
  const strongest = context.summary.strongestSkills[0];
  const warning =
    context.currentStreak === 0
      ? "You have lost your streak, so momentum needs to be rebuilt today."
      : weakest
      ? `${weakest.label} is your current weak spot, so avoid ignoring it this week.`
      : "Your data is still sparse, so consistency matters more than volume right now.";

  const motivation = strongest
    ? `${strongest.label} is becoming a real strength, so keep compounding it while you fix weaker areas.`
    : "You already have enough signal to build from, and one focused session today will move the trend.";

  const tasks = [
    weakest ? `Solve 2 ${weakest.label.toLowerCase()} problems today.` : "Solve 2 tagged problems today.",
    "Review one recently missed pattern and write short notes for it.",
    context.currentStreak > 0 ? "Protect your streak with at least one accepted submission today." : "Restart your streak with one accepted submission today.",
  ];

  return { warning, motivation, tasks, source: "fallback" };
}

export async function generateCoachAdvice(
  context: CoachGenerationContext
): Promise<Pick<CoachAdvice, "warning" | "motivation" | "tasks" | "source">> {
  const apiKey = process.env["GROQ_API_KEY"];
  const model = process.env["GROQ_MODEL"] ?? "llama-3.3-70b-versatile";
  const timeoutMs = Number(process.env["GROQ_TIMEOUT_MS"] ?? 15000);

  if (!apiKey) {
    return buildFallbackAdvice(context);
  }

  const groq = new Groq({ apiKey });
  const strongest = context.summary.strongestSkills.map((skill) => `${skill.label} ${skill.score.toFixed(1)}`).join(", ");
  const weakest = context.summary.weakestSkills.map((skill) => `${skill.label} ${skill.score.toFixed(1)}`).join(", ");

  const request = groq.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "You are a strict but motivating coding mentor. Return valid JSON only with keys warning, motivation, tasks. tasks must contain exactly 3 short actionable strings.",
      },
      {
        role: "user",
        content: JSON.stringify({
          strongestSkills: strongest || "No dominant skill yet",
          weakestSkills: weakest || "No weak skill identified yet",
          activityScore: context.summary.activityScore,
          consistencyScore: context.summary.consistencyScore,
          currentStreak: context.currentStreak,
          lastActiveDate: context.lastActiveDate,
          recentContestRank: context.recentContestRank,
        }),
      },
    ],
  });

  try {
    const response = (await Promise.race([
      request,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Groq request timed out")), timeoutMs);
      }),
    ])) as Awaited<typeof request>;

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return buildFallbackAdvice(context);
    }

    const parsed = parseCoachPayload(content);
    return {
      warning: parsed.warning,
      motivation: parsed.motivation,
      tasks: parsed.tasks,
      source: `groq:${model}`,
    };
  } catch {
    return buildFallbackAdvice(context);
  }
}

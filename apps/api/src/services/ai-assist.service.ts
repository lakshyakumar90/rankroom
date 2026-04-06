import { logger } from "../lib/logger";

export interface AiAssistRequest {
  problemTitle: string;
  problemDescription: string;
  code: string;
  language: string;
  errorContext?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AiAssistResult {
  optimalApproach?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  dryRun?: string;
  explanation?: string;
  issues?: string;
  solutionCode?: string;
}

export interface AiAssistResponse {
  result: AiAssistResult;
  modelUsed: string;
  fallbackUsed: boolean;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_MS = Number(process.env["OPENROUTER_TIMEOUT_MS"] ?? 25000); // 25s timeout for free models
const OPENROUTER_MAX_ATTEMPTS = Number(process.env["OPENROUTER_MAX_ATTEMPTS"] ?? 2);

function getModelCandidates(): string[] {
  const primary = process.env["OPENROUTER_MODEL"]?.trim();
  const fallbackRaw = process.env["OPENROUTER_FALLBACK_MODELS"] ?? "";
  const fallback = fallbackRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // Restore reliable free defaults for maximum uptime
  const defaults = [
    "z-ai/glm-4.5-air:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "minimax/minimax-m2.5:free",
    "qwen/qwen3-coder-480b-a35b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "stepfun/step-3.5-flash:free",
    "google/gemma-3-27b-it:free"
  ];

  const merged = [primary, ...fallback, ...defaults].filter((item): item is string => !!item);
  return [...new Set(merged)];
}

function createPrompt(input: AiAssistRequest) {
  const systemPrompt = `You are an expert competitive programming mentor.
Return JSON only with keys:
optimalApproach, timeComplexity, spaceComplexity, dryRun, explanation, issues, solutionCode.
- Keep complexity in Big-O form.
- Keep explanation concise and practical.
- If there are no issues, set issues to an empty string.
- In solutionCode, provide a full, production-grade, and clean solution in the specified language (${input.language}). No placeholders.`;

  const history = (input.messages ?? [])
    .slice(-6)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content.slice(0, 800)}`)
    .join("\n\n");

  const userPrompt = `Problem: ${input.problemTitle}
Description: ${input.problemDescription.slice(0, 3000)}
Language: ${input.language}
${input.errorContext ? `Runtime/Compile context: ${input.errorContext.slice(0, 1500)}` : ""}

Code:
\`\`\`${input.language}
${input.code.slice(0, 5000)}
\`\`\`

${history ? `Recent conversation:\n${history}\n\n` : ""}
Provide analysis in strict JSON.`;

  return {
    systemPrompt,
    userPrompt,
  };
}

async function callOpenRouter(model: string, payload: ReturnType<typeof createPrompt>, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env["OPENROUTER_REFERER"] ?? "https://rankroom.app",
        "X-Title": "RankRoom AI Assistant",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2, // Low temperature for consistent JSON
        max_tokens: 1600,
        messages: [
          { role: "system", content: payload.systemPrompt },
          { role: "user", content: payload.userPrompt },
        ],
        // Note: Avoiding response_format: { type: "json_object" } as some free models error out on it.
        // We rely on the system prompt and the parseAiResult logic.
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // 429 and 5xx are retriable
      const retriable = response.status === 429 || response.status >= 500;
      return { ok: false as const, retriable, status: response.status, errorText };
    }

    const json = (await response.json()) as any;
    const choice = json.choices?.[0];
    const content = choice?.message?.content?.trim();
    
    if (!content) {
      const refusal = choice?.message?.refusal;
      const errorMsg = json.error?.message || refusal || "Empty AI response";
      return { ok: false as const, retriable: true, status: 502, errorText: errorMsg };
    }

    return { ok: true as const, content };
  } catch (err: any) {
    const isTimeout = err.name === "AbortError";
    return { ok: false as const, retriable: true, status: isTimeout ? 408 : 500, errorText: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function parseAiResult(content: string): AiAssistResult {
  // Clean up markdown block if present (some models wrap JSON)
  const cleanContent = content.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  
  try {
    const parsed = JSON.parse(cleanContent) as AiAssistResult;
    return {
      optimalApproach: parsed.optimalApproach ?? "",
      timeComplexity: parsed.timeComplexity ?? "Unknown",
      spaceComplexity: parsed.spaceComplexity ?? "Unknown",
      dryRun: parsed.dryRun ?? "",
      explanation: parsed.explanation ?? "",
      issues: parsed.issues ?? "",
      solutionCode: parsed.solutionCode ?? "",
    };
  } catch {
    // If it's not valid JSON, return the content as the explanation
    return {
      optimalApproach: "",
      timeComplexity: "Unknown",
      spaceComplexity: "Unknown",
      dryRun: "",
      explanation: content,
      issues: "",
      solutionCode: "",
    };
  }
}

export async function getAiAssist(input: AiAssistRequest): Promise<AiAssistResponse> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const models = getModelCandidates();
  const payload = createPrompt(input);

  let lastError: string | null = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex]!;

    for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt += 1) {
      const result = await callOpenRouter(model, payload, apiKey);

      if (result.ok) {
        return {
          result: parseAiResult(result.content),
          modelUsed: model,
          fallbackUsed: modelIndex > 0,
        };
      }

      lastError = result.errorText;
      logger.warn(
        {
          model,
          attempt,
          status: result.status,
          retriable: result.retriable,
          errorText: result.errorText.slice(0, 300),
        },
        "OpenRouter request failed"
      );

      if (!result.retriable) break;
    }
  }

  throw new Error(`All configured OpenRouter models failed. Last error: ${lastError?.slice(0, 100)}`);
}

export async function generateHint(input: {
  problemTitle: string;
  problemDescription: string;
  code: string;
  language: string;
  hintLevel?: 1 | 2 | 3;
}): Promise<string> {
  const hintLevel = input.hintLevel ?? 1;
  const levelInstructions: Record<1 | 2 | 3, string> = {
    1: "Give only a directional hint in one sentence. Do not provide code.",
    2: "Explain the approach in 2-3 concise sentences. Do not provide code.",
    3: "Provide a structured strategy with pseudocode-level guidance, but no complete implementation.",
  };

  const response = await getAiAssist({
    problemTitle: input.problemTitle,
    problemDescription: input.problemDescription,
    code: input.code,
    language: input.language,
    errorContext: `Hint level ${hintLevel}. ${levelInstructions[hintLevel]}`,
  });

  return (
    response.result.explanation ||
    response.result.optimalApproach ||
    response.result.issues ||
    "No hint available right now."
  );
}

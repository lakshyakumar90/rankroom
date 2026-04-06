const RATE_PER_SECOND = Math.max(1, Number.parseInt(process.env["JUDGE0_RATE_LIMIT_PER_SEC"] ?? "25", 10));
const BURST = Math.max(RATE_PER_SECOND, Number.parseInt(process.env["JUDGE0_RATE_LIMIT_BURST"] ?? "50", 10));

let tokens = BURST;
let lastRefill = Date.now();

function refillTokens() {
  const now = Date.now();
  const elapsed = now - lastRefill;
  if (elapsed <= 0) return;

  const refill = (elapsed / 1000) * RATE_PER_SECOND;
  tokens = Math.min(BURST, tokens + refill);
  lastRefill = now;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function acquireJudge0Token() {
  while (true) {
    refillTokens();

    if (tokens >= 1) {
      tokens -= 1;
      return;
    }

    const waitMs = Math.max(20, Math.ceil((1 - tokens) * (1000 / RATE_PER_SECOND)));
    await sleep(waitMs);
  }
}

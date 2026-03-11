import pino from "pino";

const wantPretty = process.env["NODE_ENV"] !== "production";

// #region agent log
fetch('http://127.0.0.1:7244/ingest/1f3315a9-f16e-4f25-9887-ba3e032e7cca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H2',location:'apps/api/src/lib/logger.ts:7',message:'Initializing pino logger',data:{nodeEnv:process.env["NODE_ENV"] ?? null,wantPretty},timestamp:Date.now()})}).catch(()=>{});
// #endregion

export const logger = pino({
  level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
  transport:
    wantPretty
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
});

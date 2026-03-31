import pino from "pino";

const wantPretty = process.env["NODE_ENV"] !== "production";

export const logger = pino({
  level: process.env["NODE_ENV"] === "production" ? "info" : "info",
  transport:
    wantPretty
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname,req,res,responseTime",
          },
        }
      : undefined,
});

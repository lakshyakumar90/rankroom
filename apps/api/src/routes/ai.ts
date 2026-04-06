import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { getAiAssist } from "../services/ai-assist.service";
import { logger } from "../lib/logger";

const router: ExpressRouter = Router();

const aiAssistSchema = z.object({
  problemTitle: z.string().min(1).max(300),
  problemDescription: z.string().min(1).max(20000),
  code: z.string().min(1).max(20000),
  language: z.string().min(1).max(50),
  errorContext: z.string().max(3000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .max(20)
    .optional(),
});

router.post("/assist", authenticate, validate(aiAssistSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof aiAssistSchema>;
    const response = await getAiAssist(body);

    logger.info(
      {
        userId: req.user?.id,
        language: body.language,
        modelUsed: response.modelUsed,
        fallbackUsed: response.fallbackUsed,
      },
      "AI assist completed"
    );

    res.json({
      success: true,
      data: {
        ...response.result,
        modelUsed: response.modelUsed,
        fallbackUsed: response.fallbackUsed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI assist failed";
    if (message.includes("OPENROUTER_API_KEY")) {
      next(new AppError("AI service is not configured", 503));
      return;
    }
    next(new AppError("AI assist is temporarily unavailable", 502));
  }
});

export default router;

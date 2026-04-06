import { Router, type Router as ExpressRouter } from "express";
import { getJudge0LanguageMap } from "../lib/judge0-languages";

const router: ExpressRouter = Router();

router.get("/", async (req, res, next) => {
  try {
    const refresh = req.query.refresh === "true";
    const data = await getJudge0LanguageMap(refresh);

    res.json({
      success: true,
      data: {
        source: data.source,
        fetchedAt: data.fetchedAt,
        languageIds: data.map,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

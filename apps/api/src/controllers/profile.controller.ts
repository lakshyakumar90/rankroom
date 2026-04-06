import type { NextFunction, Request, Response } from "express";
import * as studentProfileService from "../services/student-profile.service";
import { syncStudentProfileByUserId } from "../jobs/platformSync.job";

export async function getProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.getStudentProfile(req.user, req.params.userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateOwnProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.updateOwnStudentProfile(req.user!, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function uploadResumeController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "Resume file is required" });
      return;
    }
    const data = await studentProfileService.uploadResume(req.user!.id, req.file);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatarController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "Avatar file is required" });
      return;
    }
    const data = await studentProfileService.uploadAvatar(req.user!.id, req.file);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteAvatarController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.deleteAvatar(req.user!.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteResumeController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.deleteResume(req.user!.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function addSkillController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.addSkill(req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateSkillController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.updateSkill(req.user!.id, req.params.skillId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteSkillController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.removeSkill(req.user!.id, req.params.skillId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function addProjectController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.addProject(req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateProjectController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.updateProject(req.user!.id, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteProjectController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.deleteProject(req.user!.id, req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function addAchievementController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.addAchievement(req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateAchievementController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.updateAchievement(req.user!.id, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteAchievementController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await studentProfileService.deleteAchievement(req.user!.id, req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function syncProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const platform =
      typeof req.body?.platform === "string" ? req.body.platform : "all";
    const data = await syncStudentProfileByUserId(req.user!.id, platform);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function profileHeatmapController(req: Request, res: Response, next: NextFunction) {
  try {
    const year = typeof req.query.year === "string" ? parseInt(req.query.year, 10) : undefined;
    const data = await studentProfileService.getHeatmap(req.params.userId, Number.isNaN(year) ? undefined : year);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

import { Router, type Router as ExpressRouter } from "express";
import { prisma, Prisma } from "@repo/database";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { validate } from "../middleware/validate";
import { z } from "zod";
import {
  approveCertificate,
  rejectCertificate,
  submitExternalCertificate,
} from "../services/certificate.service";

const router: ExpressRouter = Router();

const submitExternalSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(500).optional(),
  externalUrl: z.string().url().optional(),
  proofFile: z.string().optional(),
  xpBonus: z.number().int().min(0).max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(5),
});

// GET /api/certificates/mine
router.get("/mine", authenticate, async (req, res, next) => {
  try {
    const certificates = await prisma.certificate.findMany({
      where: { studentId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: certificates });
  } catch (err) {
    next(err);
  }
});

// GET /api/certificates/pending - CC/Admin view for pending approvals
router.get("/pending", authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "CLASS_COORDINATOR", "DEPARTMENT_HEAD"].includes(user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    let where: Prisma.CertificateWhereInput = { status: "PENDING", type: "EXTERNAL" };

    if (user.role === "CLASS_COORDINATOR" && user.scope.sectionIds.length > 0) {
      where = {
        ...where,
        student: {
          enrollments: { some: { sectionId: { in: user.scope.sectionIds } } },
        },
      };
    } else if (user.role === "DEPARTMENT_HEAD" && user.scope.departmentIds.length > 0) {
      where = {
        ...where,
        student: {
          enrollments: {
            some: {
              section: { departmentId: { in: user.scope.departmentIds } },
            },
          },
        },
      };
    }

    const certificates = await prisma.certificate.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, avatar: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: certificates });
  } catch (err) {
    next(err);
  }
});

// GET /api/certificates/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const cert = await prisma.certificate.findUnique({
      where: { id: req.params.id },
      include: {
        student: { select: { id: true, name: true, avatar: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!cert) throw new AppError("Certificate not found", 404);

    const user = req.user!;
    const isOwner = cert.studentId === user.id;
    const isStaff = ["ADMIN", "SUPER_ADMIN", "CLASS_COORDINATOR", "DEPARTMENT_HEAD"].includes(user.role);

    if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

    res.json({ success: true, data: cert });
  } catch (err) {
    next(err);
  }
});

// POST /api/certificates/external - student submits external certificate
router.post("/external", authenticate, validate(submitExternalSchema), async (req, res, next) => {
  try {
    if (req.user!.role !== "STUDENT") {
      throw new AppError("Only students can submit external certificates", 403);
    }

    const cert = await submitExternalCertificate(req.user!.id, req.body);
    res.status(201).json({ success: true, data: cert });
  } catch (err) {
    next(err);
  }
});

// POST /api/certificates/:id/approve - CC/Admin approves
router.post("/:id/approve", authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "CLASS_COORDINATOR", "DEPARTMENT_HEAD"].includes(user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    await approveCertificate(req.params.id, user.id);
    res.json({ success: true, message: "Certificate approved and XP awarded" });
  } catch (err) {
    next(err);
  }
});

// POST /api/certificates/:id/reject - CC/Admin rejects
router.post("/:id/reject", authenticate, validate(rejectSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "CLASS_COORDINATOR", "DEPARTMENT_HEAD"].includes(user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    await rejectCertificate(req.params.id, user.id, req.body.reason);
    res.json({ success: true, message: "Certificate rejected" });
  } catch (err) {
    next(err);
  }
});

// GET /api/certificates/verify/:code - public endpoint to verify a certificate
router.get("/verify/:code", async (req, res, next) => {
  try {
    const cert = await prisma.certificate.findUnique({
      where: { verificationCode: req.params.code },
      include: {
        student: { select: { id: true, name: true } },
      },
    });

    if (!cert || cert.status !== "APPROVED") {
      throw new AppError("Certificate not found or not verified", 404);
    }

    res.json({
      success: true,
      data: {
        title: cert.title,
        type: cert.type,
        issuedAt: cert.issuedAt,
        student: cert.student,
        status: cert.status,
        verificationCode: cert.verificationCode,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

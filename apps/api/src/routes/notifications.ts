import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { notificationSendSchema, paginationSchema } from "@repo/validators";
import {
  listOwnNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  sendNotificationsController,
  unreadNotificationCountController,
} from "../controllers/notification.controller";

const router: ExpressRouter = Router();
router.use(authenticate);

router.post(["/", "/send"], validate(notificationSendSchema), sendNotificationsController);
router.get("/", validate(paginationSchema, "query"), listOwnNotificationsController);
router.put("/:id/read", markNotificationReadController);
router.patch("/:id/read", markNotificationReadController);
router.put("/read-all", markAllNotificationsReadController);
router.patch("/read-all", markAllNotificationsReadController);
router.get("/unread-count", unreadNotificationCountController);

export default router;

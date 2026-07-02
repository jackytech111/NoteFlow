import { Router } from "express";
import * as tagController from "./tagsController";
import { authenticateToken, validateRequest } from "../../../shared/middleware";
import {
  createTagSchema,
  updateTagSchema,
  validateTagsSchema,
} from "./validation";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Tags CRUD Operations
router.post("/", validateRequest(createTagSchema), tagController.createTag);
router.get("/", tagController.getTags);
router.post(
  "/validate",
  validateRequest(validateTagsSchema),
  tagController.validateTags,
);
router.get("/:tagId", tagController.getTagById);
router.put(
  "/:tagId",
  validateRequest(updateTagSchema),
  tagController.updateTag,
);
router.delete("/:tagId", tagController.deleteTag);

export default router;

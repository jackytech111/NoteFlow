import { Router } from "express";
import * as noteController from "./noteController";
import { validateRequest, authenticateToken } from "../../../shared/middleware";
import {
  createNoteSchema,
  getNotesByUserSchema,
  updateNoteSchema,
} from "./validation";

const router = Router();

//All routes require authentication
router.use(authenticateToken);

//Notes CRUD Operations
router.post("/", validateRequest(createNoteSchema), noteController.createNote);
router.get(
  "/tag/:tagId",
  validateRequest(getNotesByUserSchema),
  noteController.getNotesByTag,
);
router.get("/", validateRequest(getNotesByUserSchema), noteController.getNotes);
router.get("/:noteId", noteController.getNoteById);
router.put(
  "/:noteId",
  validateRequest(updateNoteSchema),
  noteController.updateNote,
);
router.delete("/:noteId", noteController.deleteNote);
router.post("/:noteId/restore", noteController.restoreNote);

export default router;

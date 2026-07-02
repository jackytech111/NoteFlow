import { createServiceError, sanitizeInput } from "../../../shared/utils";
import {
  CreateNoteRequest,
  Note,
  UpdateNoteRequest,
} from "../../../shared/types";
import prisma from "./db";
import { TagsServiceClient } from "./tagsServiceClient";

export class NotesService {
  private tagsServiceClient: TagsServiceClient;
  constructor() {
    this.tagsServiceClient = new TagsServiceClient();
  }

  async createNote(
    userId: string,
    noteData: CreateNoteRequest,
    authToken?: string,
  ): Promise<Note> {
    const sanitizedTitle = sanitizeInput(noteData.title);
    const sanitizedContent = sanitizeInput(noteData.content);

    if (noteData.tagIds && noteData.tagIds.length > 0) {
      if (!authToken) {
        throw createServiceError(
          "Authorization token is required to validate tags",
          401,
        );
      }

      const validation = await this.tagsServiceClient.validateTags(
        noteData.tagIds,
        authToken,
      );

      if (validation.invalidTagIds.length > 0) {
        throw createServiceError("Invalid tag ids", 400);
      }
    }

    const note = await prisma.note.create({
      data: {
        userId,
        title: sanitizedTitle,
        content: sanitizedContent,
      },
      include: {
        noteTags: true,
      },
    });

    if (noteData.tagIds && noteData.tagIds.length > 0) {
      await this.syncNoteTags(note.id, noteData.tagIds);
      return this.getNoteById(note.id, userId);
    }

    return note as Note;
  }

  async getNoteById(noteId: string, userId: string): Promise<Note> {
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
        isDeleted: false,
      },
      include: {
        noteTags: true,
      },
    });

    if (!note) {
      throw createServiceError("Note not found", 404);
    }

    return note as Note;
  }

  async updateNote(
    userId: string,
    noteId: string,
    noteData: UpdateNoteRequest,
    authToken?: string,
  ): Promise<Note> {
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
        isDeleted: false,
      },
    });

    if (!note) {
      throw createServiceError("Note not found", 404);
    }

    const updateData: any = {};
    if (noteData.title !== undefined) {
      updateData.title = sanitizeInput(noteData.title);
    }
    if (noteData.content !== undefined) {
      updateData.content = sanitizeInput(noteData.content);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.note.update({
        where: {
          id: noteId,
        },
        data: updateData,
      });
    }

    if (noteData.tagIds !== undefined) {
      if (!authToken) {
        throw createServiceError(
          "Authorization token is required to validate tags",
          401,
        );
      }
      const validation = await this.tagsServiceClient.validateTags(
        noteData.tagIds,
        authToken,
      );

      if (validation.invalidTagIds.length > 0) {
        throw createServiceError("Invalid tag ids", 400);
      }

      await this.syncNoteTags(noteId, noteData.tagIds);
    }

    return this.getNoteById(noteId, userId);
  }

  async deleteNote(userId: string, noteId: string): Promise<Note> {
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
        isDeleted: false,
      },
    });

    if (!note) {
      throw createServiceError("Note not found or already deleted", 404);
    }

    const deletedNote = await prisma.note.update({
      where: { id: noteId },
      data: { isDeleted: true },
      include: { noteTags: true },
    });

    return deletedNote as Note;
  }

  async restoreNote(userId: string, noteId: string): Promise<Note> {
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
        isDeleted: true,
      },
    });

    if (!note) {
      throw createServiceError("Note not found or not deleted", 404);
    }

    const restoredNote = await prisma.note.update({
      where: { id: noteId },
      data: { isDeleted: false },
      include: { noteTags: true },
    });

    return restoredNote as Note;
  }

  async getNotesByUser(
    userId: string,
    page: number = 1,
    limit: number = 50,
    search?: string,
  ): Promise<{
    notes: Note[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // build where clause
    const whereClause: any = {
      userId,
      isDeleted: false,
    };

    // add search functionality
    if (search) {
      const sanitizedSearch = sanitizeInput(search);
      whereClause.OR = [
        {
          title: {
            contains: sanitizedSearch,
            mode: "insensitive",
          },
        },
        {
          content: {
            contains: sanitizedSearch,
            mode: "insensitive",
          },
        },
      ];
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where: whereClause,
        include: {
          noteTags: true,
        },
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.note.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notes,
      total,
      page,
      totalPages,
    };
  }

  private async syncNoteTags(noteId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) {
      await prisma.noteTag.deleteMany({
        where: {
          noteId,
        },
      });
      return;
    }

    await prisma.noteTag.deleteMany({
      where: {
        noteId,
        tagId: {
          notIn: tagIds,
        },
      },
    });

    const noteTagData = tagIds.map((tagId) => ({
      noteId,
      tagId,
    }));

    await prisma.noteTag.createMany({
      data: noteTagData,
      skipDuplicates: true,
    });
  }

  async getNotesByTag(
    userId: string,
    tagId: string,
    page: number = 1,
    limit: number = 50,
    authToken?: string,
  ): Promise<{
    notes: Note[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (authToken) {
      await this.tagsServiceClient.validateTags([tagId], authToken);
    }

    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where: {
          userId,
          isDeleted: false,
          noteTags: {
            some: {
              tagId,
            },
          },
        },
        include: {
          noteTags: true,
        },
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.note.count({
        where: {
          userId,
          isDeleted: false,
          noteTags: {
            some: {
              tagId,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notes,
      total,
      page,
      totalPages,
    };
  }
}

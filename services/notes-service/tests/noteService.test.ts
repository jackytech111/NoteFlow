import { ServiceError } from "../../../shared/types";
import { NotesService } from "../src/notesService";
import { resetAllMocks, testNote } from "./setup";

async function expectServiceError(
  asyncFn: () => Promise<any>,
  expectedMessage: string,
  expectedStatusCode: number,
) {
  try {
    await asyncFn();
    fail("Expected function to throw ServiceError");
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.message).toBe(expectedMessage);
    expect(error.statusCode).toBe(expectedStatusCode);
  }
}

describe("NotesService", () => {
  let notesService: NotesService;

  beforeEach(() => {
    resetAllMocks();
    notesService = new NotesService();
  });

  describe("createNote", () => {
    const userId = "test-user-id-123";

    it("should successfully create a note without tags", async () => {
      global.mockPrisma.note.create.mockResolvedValue(testNote);

      const result = await notesService.createNote(userId, {
        title: "Test Note",
        content: "This is a test note",
      });

      expect(global.mockPrisma.note.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: "Test Note",
          content: "This is a test note",
        },
        include: {
          noteTags: true,
        },
      });
      expect(result).toEqual(testNote);
    });

    it("should validate tags before creating a note when tagIds are provided", async () => {
      const validateTagsSpy = jest
        .spyOn((notesService as any).tagsServiceClient, "validateTags")
        .mockResolvedValue({ validTags: [], invalidTagIds: [] });

      global.mockPrisma.note.create.mockResolvedValue(testNote);
      global.mockPrisma.note.findFirst.mockResolvedValue(testNote);

      await notesService.createNote(
        userId,
        {
          title: "Test Note",
          content: "This is a test note",
          tagIds: ["11111111-1111-1111-1111-111111111111"],
        },
        "test-token",
      );

      expect(validateTagsSpy).toHaveBeenCalledWith(
        ["11111111-1111-1111-1111-111111111111"],
        "test-token",
      );
      const noteTagCreateManyMock = global.mockPrisma.noteTag
        .createMany as jest.Mock;
      expect(validateTagsSpy.mock.invocationCallOrder[0]).toBeLessThan(
        noteTagCreateManyMock.mock.invocationCallOrder[0] ||
          Number.MAX_SAFE_INTEGER,
      );
    });

    it("should reject creation when tag validation reports invalid tag IDs", async () => {
      jest
        .spyOn((notesService as any).tagsServiceClient, "validateTags")
        .mockResolvedValue({
          validTags: [],
          invalidTagIds: ["11111111-1111-1111-1111-111111111111"],
        });

      await expectServiceError(
        () =>
          notesService.createNote(
            userId,
            {
              title: "Test Note",
              content: "This is a test note",
              tagIds: ["11111111-1111-1111-1111-111111111111"],
            },
            "test-token",
          ),
        "Invalid tag ids",
        400,
      );

      expect(global.mockPrisma.note.create).not.toHaveBeenCalled();
    });
  });

  describe("getNoteById", () => {
    const noteId = "test-note-id-123";
    const userId = "test-user-id-123";

    it("should successfully retrieve a note", async () => {
      global.mockPrisma.note.findFirst.mockResolvedValue(testNote);

      const result = await notesService.getNoteById(noteId, userId);

      expect(global.mockPrisma.note.findFirst).toHaveBeenCalledWith({
        where: {
          id: noteId,
          userId,
          isDeleted: false,
        },
        include: {
          noteTags: true,
        },
      });
      expect(result).toEqual(testNote);
    });
  });
});

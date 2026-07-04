import { ServiceError } from "../../../shared/types";
import { TagsService } from "../src/tagsService";
import { resetAllMocks, testTag } from "./setup";

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

const VALID_TAG_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_TAG_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "test-user-id-123";

describe("TagsService", () => {
  let tagsService: TagsService;

  beforeEach(() => {
    resetAllMocks();
    tagsService = new TagsService();
  });

  describe("createTag", () => {
    it("tạo tag thành công với tên và màu hợp lệ", async () => {
      global.mockPrisma.tag.create.mockResolvedValue(testTag);

      const result = await tagsService.createTag(USER_ID, {
        name: "Work",
        color: "#FF5733",
      });

      expect(global.mockPrisma.tag.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          name: "Work",
          color: "#FF5733",
        },
      });
      expect(result).toEqual(testTag);
    });

    it("tạo tag thành công không cần màu", async () => {
      global.mockPrisma.tag.create.mockResolvedValue({
        ...testTag,
        color: undefined,
      });

      await tagsService.createTag(USER_ID, { name: "Work" });

      expect(global.mockPrisma.tag.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          name: "Work",
          color: undefined,
        },
      });
    });

    it("ném lỗi 400 khi màu không đúng định dạng hex, không gọi DB", async () => {
      await expectServiceError(
        () =>
          tagsService.createTag(USER_ID, {
            name: "Work",
            color: "notacolor",
          }),
        "Invalid color format, Use hex color format (eg: #FF5733 or #F73)",
        400,
      );

      expect(global.mockPrisma.tag.create).not.toHaveBeenCalled();
    });

    it("ném lỗi 409 khi tên tag đã tồn tại (unique constraint P2002)", async () => {
      global.mockPrisma.tag.create.mockRejectedValue({ code: "P2002" });

      await expectServiceError(
        () => tagsService.createTag(USER_ID, { name: "Work" }),
        "Tag name already exists",
        409,
      );
    });

    it("ném lỗi 500 khi DB lỗi không xác định", async () => {
      global.mockPrisma.tag.create.mockRejectedValue(
        new Error("connection lost"),
      );

      await expectServiceError(
        () => tagsService.createTag(USER_ID, { name: "Work" }),
        "Failed to create tag",
        500,
      );
    });
  });

  describe("getTagById", () => {
    it("ném lỗi 400 khi tagId không phải UUID hợp lệ, không gọi DB", async () => {
      await expectServiceError(
        () => tagsService.getTagById("not-a-uuid", USER_ID),
        "Invalid tag id",
        400,
      );

      expect(global.mockPrisma.tag.findFirst).not.toHaveBeenCalled();
    });

    it("ném lỗi 404 khi tag không tồn tại hoặc không thuộc user", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expectServiceError(
        () => tagsService.getTagById(VALID_TAG_ID, USER_ID),
        "Tag not found",
        404,
      );

      expect(global.mockPrisma.tag.findFirst).toHaveBeenCalledWith({
        where: { id: VALID_TAG_ID, userId: USER_ID },
      });
    });

    it("trả về tag khi tồn tại và đúng userId", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);

      const result = await tagsService.getTagById(VALID_TAG_ID, USER_ID);

      expect(result).toEqual(testTag);
    });
  });

  describe("getTagsByUser", () => {
    it("trả về danh sách tag kèm pagination, không có search", async () => {
      global.mockPrisma.tag.findMany.mockResolvedValue([testTag]);
      global.mockPrisma.tag.count.mockResolvedValue(1);

      const result = await tagsService.getTagsByUser(1, 50, undefined, USER_ID);

      expect(global.mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        skip: 0,
        take: 50,
        orderBy: { name: "asc" },
      });
      expect(result).toEqual({
        tags: [testTag],
        total: 1,
        page: 1,
        totalPages: 1,
      });
    });

    it("áp dụng bộ lọc search khi có truyền vào", async () => {
      global.mockPrisma.tag.findMany.mockResolvedValue([testTag]);
      global.mockPrisma.tag.count.mockResolvedValue(1);

      await tagsService.getTagsByUser(1, 50, "Work", USER_ID);

      expect(global.mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: USER_ID,
            name: { contains: "Work", mode: "insensitive" },
          },
        }),
      );
    });

    it("tính đúng skip theo page và totalPages theo total/limit", async () => {
      global.mockPrisma.tag.findMany.mockResolvedValue([]);
      global.mockPrisma.tag.count.mockResolvedValue(120);

      const result = await tagsService.getTagsByUser(2, 50, undefined, USER_ID);

      expect(global.mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 50 }),
      );
      expect(result.totalPages).toBe(3);
    });
  });

  describe("validateTags", () => {
    it("phân loại đúng: tag hợp lệ vào validTags", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);

      const result = await tagsService.validateTags([VALID_TAG_ID], USER_ID);

      expect(result.validTags).toEqual([testTag]);
      expect(result.invalidTagIds).toEqual([]);
    });

    it("phân loại đúng: id không phải UUID vào invalidTagIds mà không gọi DB", async () => {
      const result = await tagsService.validateTags(["not-a-uuid"], USER_ID);

      expect(result.invalidTagIds).toEqual(["not-a-uuid"]);
      expect(global.mockPrisma.tag.findFirst).not.toHaveBeenCalled();
    });

    it("phân loại đúng: UUID hợp lệ nhưng tag không tồn tại vào invalidTagIds", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(null);

      const result = await tagsService.validateTags([OTHER_TAG_ID], USER_ID);

      expect(result.invalidTagIds).toEqual([OTHER_TAG_ID]);
      expect(result.validTags).toEqual([]);
    });

    it("xử lý đúng khi trộn lẫn nhiều id hợp lệ và không hợp lệ", async () => {
      global.mockPrisma.tag.findFirst
        .mockResolvedValueOnce(testTag)
        .mockResolvedValueOnce(null);

      const result = await tagsService.validateTags(
        [VALID_TAG_ID, OTHER_TAG_ID],
        USER_ID,
      );

      expect(result.validTags).toEqual([testTag]);
      expect(result.invalidTagIds).toEqual([OTHER_TAG_ID]);
    });
  });

  describe("updateTag", () => {
    it("ném lỗi 400 khi tagId không phải UUID hợp lệ", async () => {
      await expectServiceError(
        () => tagsService.updateTag("not-a-uuid", USER_ID, { name: "New" }),
        "Invalid tag id",
        400,
      );

      expect(global.mockPrisma.tag.findFirst).not.toHaveBeenCalled();
    });

    it("ném lỗi 404 khi tag không tồn tại", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expectServiceError(
        () => tagsService.updateTag(VALID_TAG_ID, USER_ID, { name: "New" }),
        "Tag not found",
        404,
      );
    });

    it("trả về tag hiện tại mà không gọi update khi không có field nào thay đổi", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);

      const result = await tagsService.updateTag(VALID_TAG_ID, USER_ID, {});

      expect(result).toEqual(testTag);
      expect(global.mockPrisma.tag.update).not.toHaveBeenCalled();
    });

    it("cập nhật thành công tên và màu hợp lệ", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);
      const updatedTag = { ...testTag, name: "Office", color: "#00FF00" };
      global.mockPrisma.tag.update.mockResolvedValue(updatedTag);

      const result = await tagsService.updateTag(VALID_TAG_ID, USER_ID, {
        name: "Office",
        color: "#00FF00",
      });

      expect(global.mockPrisma.tag.update).toHaveBeenCalledWith({
        where: { id: VALID_TAG_ID },
        data: { name: "Office", color: "#00FF00" },
      });
      expect(result).toEqual(updatedTag);
    });

    it("cho phép xóa màu (set null) khi truyền color rỗng", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);
      global.mockPrisma.tag.update.mockResolvedValue({
        ...testTag,
        color: null,
      });

      await tagsService.updateTag(VALID_TAG_ID, USER_ID, { color: "" });

      expect(global.mockPrisma.tag.update).toHaveBeenCalledWith({
        where: { id: VALID_TAG_ID },
        data: { color: null },
      });
    });

    it("ném lỗi 400 khi màu mới không đúng định dạng hex, không gọi update", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);

      await expectServiceError(
        () =>
          tagsService.updateTag(VALID_TAG_ID, USER_ID, {
            color: "notacolor",
          }),
        "Invalid color format, Use hex color format (eg: #FF5733 or #F73)",
        400,
      );

      expect(global.mockPrisma.tag.update).not.toHaveBeenCalled();
    });

    it("ném lỗi 409 khi tên mới trùng với tag khác (unique constraint P2002)", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);
      global.mockPrisma.tag.update.mockRejectedValue({ code: "P2002" });

      await expectServiceError(
        () =>
          tagsService.updateTag(VALID_TAG_ID, USER_ID, { name: "Personal" }),
        "Tag name already exists",
        409,
      );
    });

    it("ném lỗi 500 khi DB lỗi không xác định lúc update", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);
      global.mockPrisma.tag.update.mockRejectedValue(
        new Error("connection lost"),
      );

      await expectServiceError(
        () =>
          tagsService.updateTag(VALID_TAG_ID, USER_ID, { name: "Personal" }),
        "Failed to update tag",
        500,
      );
    });
  });

  describe("deleteTag", () => {
    it("ném lỗi 400 khi tagId không phải UUID hợp lệ", async () => {
      await expectServiceError(
        () => tagsService.deleteTag("not-a-uuid", USER_ID),
        "Invalid tag id",
        400,
      );

      expect(global.mockPrisma.tag.findFirst).not.toHaveBeenCalled();
    });

    it("ném lỗi 404 khi tag không tồn tại", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expectServiceError(
        () => tagsService.deleteTag(VALID_TAG_ID, USER_ID),
        "Tag not found",
        404,
      );

      expect(global.mockPrisma.tag.delete).not.toHaveBeenCalled();
    });

    it("xóa thành công khi tag tồn tại và thuộc đúng user", async () => {
      global.mockPrisma.tag.findFirst.mockResolvedValue(testTag);
      global.mockPrisma.tag.delete.mockResolvedValue(testTag);

      await expect(
        tagsService.deleteTag(VALID_TAG_ID, USER_ID),
      ).resolves.toBeUndefined();

      expect(global.mockPrisma.tag.delete).toHaveBeenCalledWith({
        where: { id: VALID_TAG_ID },
      });
    });
  });
});

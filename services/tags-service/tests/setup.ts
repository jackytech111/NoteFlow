// Mock environment variables
process.env.NODE_ENV = "test";

// Mock prisma client
const mockPrismaClient = {
  tag: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $disconnect: jest.fn(),
  $connect: jest.fn(),
};

// Mock the database module
jest.mock("../src/db", () => mockPrismaClient);

// mock test utils
global.mockPrisma = mockPrismaClient;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// global data for test
export const testTag = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "test-user-id-123",
  name: "Work",
  color: "#FF5733",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

export const testCreateTagRequest = {
  name: "Work",
  color: "#FF5733",
};

export const testUpdateTagRequest = {
  name: "Office",
  color: "#00FF00",
};

// helper function to reset mocks before each test
export function resetAllMocks() {
  Object.values(mockPrismaClient.tag).forEach((mock) => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
}

declare global {
  var mockPrisma: typeof mockPrismaClient;
}

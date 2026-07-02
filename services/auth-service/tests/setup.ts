import { jest } from "@jest/globals";
import { JWTPayload } from "../../../shared/types";
import type { User, RefreshToken } from "../src/generated/prisma/client";

// Mock environment variables
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-key-for-testing-only";
process.env.JWT_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.BCRYPT_ROUNDS = "4"; // Lower rounds for faster tests
process.env.NODE_ENV = "test";

// Mock prisma client
const mockPrismaClient = {
  user: {
    create: jest.fn<() => Promise<User>>(),
    findUnique: jest.fn<() => Promise<User | null>>(),
    findMany: jest.fn<() => Promise<User[]>>(),
    update: jest.fn<() => Promise<User>>(),
    delete: jest.fn<() => Promise<User>>(),
    count: jest.fn<() => Promise<number>>(),
  },
  refreshToken: {
    create: jest.fn<() => Promise<RefreshToken>>(),
    findUnique: jest.fn<() => Promise<RefreshToken | null>>(),
    findMany: jest.fn<() => Promise<RefreshToken[]>>(),
    deleteMany: jest.fn<() => Promise<{ count: number }>>(),
    update: jest.fn<() => Promise<RefreshToken>>(),
    delete: jest.fn<() => Promise<RefreshToken>>(),
  },
  $disconnect: jest.fn<() => Promise<void>>(),
  $connect: jest.fn<() => Promise<void>>(),
};

// Mock the database module
jest.mock("../src/db", () => mockPrismaClient);

// mock test utils
global.mockPrisma = mockPrismaClient;

// global data for test
export const testUser = {
  id: "test-user-id",
  email: "testuser123@domain.com",
  password: "$2a$04$hashedpasswordhashedpasswordhashedpasswordhashedpassword",
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
};

export const testRefreshToken = {
  id: "test-refresh-token-id",
  userId: testUser.id,
  token: "test-refresh-token",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  createdAt: new Date(),
};

export const testJwtPayload: JWTPayload = {
  userId: "test-user-id",
  email: testUser.email,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 15, // 15 minutes from now
};

// helper function to reset mocks before each test
export function resetAllMocks() {
  Object.values(mockPrismaClient.user).forEach((mock) => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  Object.values(mockPrismaClient.refreshToken).forEach((mock) => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
}

declare global {
  var mockPrisma: typeof mockPrismaClient;
}

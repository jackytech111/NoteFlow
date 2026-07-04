import express from "express";
import { AddressInfo } from "net";
import http from "http";
import jwt from "jsonwebtoken";
import request from "supertest";
import axios from "axios";

// http-proxy-middleware phát hành dưới dạng ESM thuần, Jest (CommonJS) không
// parse được trực tiếp từ node_modules. Mock lại bằng bản giả dùng axios —
// vẫn forward request thật tới service đích (server giả bên dưới), áp dụng
// đúng pathRewrite và header x-user-id/x-user-email, nên vẫn test được đúng
// phần logic của CHÍNH api-gateway (routing + auth), không phụ thuộc vào
// cách triển khai nội bộ của thư viện proxy.
jest.mock("http-proxy-middleware", () => ({
  createProxyMiddleware: (options: any) => {
    return async (req: any, res: any) => {
      try {
        let rewrittenPath = req.url;
        if (options.pathRewrite) {
          for (const [pattern, replacement] of Object.entries(
            options.pathRewrite,
          )) {
            rewrittenPath = rewrittenPath.replace(
              new RegExp(pattern),
              replacement as string,
            );
          }
        }

        const headers: Record<string, any> = { ...req.headers };
        delete headers["content-length"];
        delete headers.host;

        if (req.user) {
          headers["x-user-id"] = req.user.userId;
          headers["x-user-email"] = req.user.email;
        }

        const response = await axios({
          method: req.method,
          url: options.target + rewrittenPath,
          data: req.body,
          headers,
          validateStatus: () => true,
        });

        res.status(response.status).json(response.data);
      } catch (err: any) {
        if (options.on?.error) {
          options.on.error(err, req, res);
        } else if (!res.headersSent) {
          res
            .status(503)
            .json({ success: false, error: "Service unavailable" });
        }
      }
    };
  },
  fixRequestBody: () => {
    // no-op: mock ở trên forward req.body trực tiếp qua axios,
    // không cần re-serialize như thư viện thật.
  },
}));

const JWT_SECRET = "test-secret-for-gateway";
const USER_ID = "user-123";
const USER_EMAIL = "test@example.com";

function signToken(payload: object = { userId: USER_ID, email: USER_EMAIL }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

/**
 * Tạo 1 server Express giả, đóng vai "service đích" (auth/users/notes/tags),
 * lắng nghe trên cổng ngẫu nhiên (port 0), ghi lại mọi request nhận được.
 */
function createFakeService() {
  const receivedRequests: Array<{
    method: string;
    path: string;
    headers: Record<string, any>;
    body: any;
  }> = [];

  const app = express();
  app.use(express.json());
  // Dùng app.use() không kèm path để bắt mọi request — tránh path-to-regexp
  // (Express 5 / v8 không còn chấp nhận wildcard "*" trần như trước).
  app.use((req, res) => {
    receivedRequests.push({
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body,
    });
    res.status(200).json({ success: true, from: req.path });
  });

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://localhost:${port}`,
    server,
    receivedRequests,
  };
}

describe("API Gateway", () => {
  let app: express.Express;
  let authService: ReturnType<typeof createFakeService>;
  let userService: ReturnType<typeof createFakeService>;
  let notesService: ReturnType<typeof createFakeService>;
  let tagsService: ReturnType<typeof createFakeService>;
  let servers: http.Server[];

  beforeAll(async () => {
    // Dựng 4 service giả TRƯỚC, để lấy port thật trước khi gateway đọc process.env
    authService = createFakeService();
    userService = createFakeService();
    notesService = createFakeService();
    tagsService = createFakeService();
    servers = [
      authService.server,
      userService.server,
      notesService.server,
      tagsService.server,
    ];

    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.AUTH_SERVICE_URL = authService.url;
    process.env.USER_SERVICE_URL = userService.url;
    process.env.NOTES_SERVICE_URL = notesService.url;
    process.env.TAGS_SERVICE_URL = tagsService.url;

    // Import động SAU khi env đã set, vì config/services.ts đọc process.env
    // ngay tại thời điểm module được load.
    app = (await import("../src/index")).default;
  });

  afterAll(async () => {
    await Promise.all(
      servers.map(
        (s) => new Promise<void>((resolve) => s.close(() => resolve())),
      ),
    );
  });

  beforeEach(() => {
    // Reset lại mảng request nhận được của từng service giả trước mỗi test,
    // tránh request của test trước cộng dồn sang test sau.
    authService.receivedRequests.length = 0;
    userService.receivedRequests.length = 0;
    notesService.receivedRequests.length = 0;
    tagsService.receivedRequests.length = 0;
  });

  describe("Route mapping", () => {
    it("forward /api/auth/* tới đúng Auth Service, rewrite path đúng", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "a@test.com", password: "123456" });

      expect(res.status).toBe(200);
      expect(authService.receivedRequests).toHaveLength(1);
      expect(authService.receivedRequests[0].path).toBe("/auth/login");
      expect(authService.receivedRequests[0].body).toEqual({
        email: "a@test.com",
        password: "123456",
      });
    });

    it("forward /api/tags/* tới đúng Tags Service (không lẫn sang service khác)", async () => {
      const token = signToken();

      await request(app)
        .get("/api/tags")
        .set("Authorization", `Bearer ${token}`);

      expect(tagsService.receivedRequests).toHaveLength(1);
      expect(tagsService.receivedRequests[0].path).toBe("/tags/");
      expect(authService.receivedRequests).toHaveLength(0);
      expect(notesService.receivedRequests).toHaveLength(0);
    });

    it("forward /api/notes/* tới đúng Notes Service", async () => {
      const token = signToken();

      await request(app)
        .get("/api/notes")
        .set("Authorization", `Bearer ${token}`);

      expect(notesService.receivedRequests).toHaveLength(1);
      expect(notesService.receivedRequests[0].path).toBe("/notes/");
    });

    it("forward /api/users/* tới đúng User Service", async () => {
      const token = signToken();

      await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(userService.receivedRequests).toHaveLength(1);
      expect(userService.receivedRequests[0].path).toBe("/users/profile");
    });
  });

  describe("Public routes (không cần token)", () => {
    it("/health trả về trực tiếp từ gateway, không proxy đi đâu cả", async () => {
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.body.service).toBe("api-gateway");
      expect(authService.receivedRequests).toHaveLength(0);
    });

    it("/api/auth/login không cần token vẫn được forward", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "a@test.com", password: "123456" });

      expect(res.status).not.toBe(401);
    });

    it("/api/auth/register không cần token vẫn được forward", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "a@test.com", password: "123456" });

      expect(res.status).not.toBe(401);
    });
  });

  describe("Auth middleware trên route cần bảo vệ", () => {
    it("chặn 401 khi không có token, KHÔNG forward tới service đích", async () => {
      const res = await request(app).get("/api/tags");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Access token required");
      expect(tagsService.receivedRequests).toHaveLength(0);
    });

    it("chặn 403 khi token không hợp lệ, KHÔNG forward tới service đích", async () => {
      const res = await request(app)
        .get("/api/tags")
        .set("Authorization", "Bearer invalid-token-xyz");

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Invalid or expired token");
      expect(tagsService.receivedRequests).toHaveLength(0);
    });

    it("chặn 403 khi token đã hết hạn", async () => {
      const expiredToken = jwt.sign(
        { userId: USER_ID, email: USER_EMAIL },
        JWT_SECRET,
        { expiresIn: "-10s" },
      );

      const res = await request(app)
        .get("/api/tags")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(403);
    });

    it("cho qua và forward đúng khi token hợp lệ", async () => {
      const token = signToken();

      const res = await request(app)
        .get("/api/tags")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(tagsService.receivedRequests).toHaveLength(1);
    });

    it("gắn đúng x-user-id và x-user-email vào request forward xuống service đích", async () => {
      const token = signToken({
        userId: "user-999",
        email: "special@test.com",
      });

      await request(app)
        .get("/api/tags")
        .set("Authorization", `Bearer ${token}`);

      const forwarded = tagsService.receivedRequests[0];
      expect(forwarded.headers["x-user-id"]).toBe("user-999");
      expect(forwarded.headers["x-user-email"]).toBe("special@test.com");
    });
  });
});

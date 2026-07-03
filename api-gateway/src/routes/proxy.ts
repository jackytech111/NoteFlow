import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { servicesConfig } from "../config/services";

const router = Router();

function createServiceProxy(
  targetUrl: string,
  pathRewrite?: Record<string, string>,
): any {
  const options = {
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: pathRewrite || {},
    timeout: 30000, // 30 seconds
    proxyTimeout: 30000, // 30 seconds
    on: {
      error: (err: any, req: any, res: any) => {
        console.error(`Proxy error: ${err.message}`);
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            error: "Service unavailable. Please try again later.",
            message: "Service unavailable. Please try again later.",
          });
        }
      },
      proxyReq: (proxyReq: any, req: any) => {
        // Log proxy request details
        console.log(
          `Proxying request: ${req.method} ${req.originalUrl} to ${targetUrl}${proxyReq.path}`,
        );

        // Forward user information if available
        if (req.user) {
          proxyReq.setHeader("x-user-id", req.user.userId);
          proxyReq.setHeader("x-user-email", req.user.email);
        }

        // Re-serialize req.body (đã bị express.json() consume) và ghi lại vào proxy request
        fixRequestBody(proxyReq, req);
      },
      proxyRes: (proxyRes: any, req: any) => {
        // log proxy response details
        console.log(
          `Received response from ${targetUrl}: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`,
        );
      },
    },
  };

  return createProxyMiddleware(options);
}

router.use(
  "/api/auth",
  createServiceProxy(servicesConfig.auth.url, {
    "^/": "/auth/", // req.url đã bị Express strip "/api/auth", chỉ còn "/register" -> rewrite thành "/auth/register"
  }),
);

router.use(
  "/api/users",
  createServiceProxy(servicesConfig.users.url, {
    "^/": "/users/",
  }),
);

router.use(
  "/api/notes",
  createServiceProxy(servicesConfig.notes.url, {
    "^/": "/notes/",
  }),
);

router.use(
  "/api/tags",
  createServiceProxy(servicesConfig.tags.url, {
    "^/": "/tags/",
  }),
);

export default router;

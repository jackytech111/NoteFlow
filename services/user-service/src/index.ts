import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import usersRoutes from "./routes";
import { corsOptions, errorHandler } from "../../../shared/middleware";

const app = express();
const PORT = process.env.PORT || 3002;

// setup middlewares
app.use(cors(corsOptions()));
app.use(helmet());

// parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/users", usersRoutes);

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`User services is running on port:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;

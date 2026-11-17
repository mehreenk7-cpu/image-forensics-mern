
import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/authRoutes.js";
import caseRoutes from "./routes/caseRoutes.js";
import evidenceRoutes from "./routes/evidenceRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import correlationRoutes from "./routes/correlationRoutes.js";
import findingRoutes from "./routes/findingRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

const app = express();

// Security middleware
app.use(helmet());


app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);


// Body parsing middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api", evidenceRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/correlations", correlationRoutes);
app.use("/api/findings", findingRoutes);
app.use("/api/reports", reportRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Image Forensics API is running",
  });
});

export default app;

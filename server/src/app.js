
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

// Allowed frontend origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://image-forensics-admin.vercel.app",
];

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api", evidenceRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/correlations", correlationRoutes);
app.use("/api/findings", findingRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Image Forensics API is running",
  });
});

export default app;

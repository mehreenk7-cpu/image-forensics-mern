
import express from "express";
import multer from "multer";
import mongoose from "mongoose";

import LogEvent from "../models/LogEvent.js";
import InvestigationCase from "../models/Case.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { parseLogText } from "../services/logParserService.js";

const router = express.Router();

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = file.originalname.split(".").pop()?.toLowerCase();

    if (extension !== "log" && extension !== "txt") {
      return callback(
        new Error("Only .log and .txt files are allowed.")
      );
    }

    callback(null, true);
  },
});

// Admin check
const isAdmin = (req) =>
  String(req.user.role || "").toLowerCase() === "admin";

// Find case accessible to the logged-in user
const findAccessibleCase = async (caseId, req) => {
  const filter = { _id: caseId };

  if (!isAdmin(req)) {
    filter.createdBy = req.user.userId;
  }

  return InvestigationCase.findOne(filter);
};

// UPLOAD AND ANALYZE LOG FILE
router.post(
  "/cases/:caseId/upload",
  authMiddleware,
  (req, res, next) => {
    upload.single("logFile")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next();
    });
  },
  async (req, res) => {
    try {
      const { caseId } = req.params;

      if (!mongoose.isValidObjectId(caseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid case ID.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a log file using the logFile field.",
        });
      }

      // Admin can access all cases; investigator only their own.
      const investigationCase = await findAccessibleCase(caseId, req);

      if (!investigationCase) {
        return res.status(404).json({
          success: false,
          message: "Case not found or access denied.",
        });
      }

      const logText = req.file.buffer.toString("utf8");
      const parsedEvents = parseLogText(logText);

      if (!parsedEvents || parsedEvents.length === 0) {
        return res.status(400).json({
          success: false,
          message: "The uploaded file contains no log entries.",
        });
      }

      const eventsToSave = parsedEvents.map((event, index) => ({
        ...event,
        caseId: investigationCase._id,
        uploadedBy: req.user.userId,
        source: "Uploaded Log File",
        originalFileName: req.file.originalname,
        lineNumber: index + 1,
      }));

      const savedEvents = await LogEvent.insertMany(eventsToSave);

      const suspiciousCount = savedEvents.filter(
        (event) => event.suspicious
      ).length;

      const criticalCount = savedEvents.filter(
        (event) => event.level === "CRITICAL"
      ).length;

      const errorCount = savedEvents.filter(
        (event) => event.level === "ERROR"
      ).length;

      return res.status(201).json({
        success: true,
        message: "Log file uploaded and analyzed successfully.",
        summary: {
          fileName: req.file.originalname,
          totalEvents: savedEvents.length,
          suspiciousEvents: suspiciousCount,
          criticalEvents: criticalCount,
          errorEvents: errorCount,
        },
        events: savedEvents,
      });
    } catch (error) {
      console.error("Log upload error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to process the log file.",
      });
    }
  }
);

// GET ALL LOG EVENTS FOR A CASE
router.get(
  "/cases/:caseId",
  authMiddleware,
  async (req, res) => {
    try {
      const { caseId } = req.params;

      if (!mongoose.isValidObjectId(caseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid case ID.",
        });
      }

      const investigationCase = await findAccessibleCase(caseId, req);

      if (!investigationCase) {
        return res.status(404).json({
          success: false,
          message: "Case not found or access denied.",
        });
      }

      // Admin sees logs from all uploaders for this case.
      // Investigator sees only logs they uploaded.
      const eventFilter = {
        caseId: investigationCase._id,
      };

      if (!isAdmin(req)) {
        eventFilter.uploadedBy = req.user.userId;
      }

      const events = await LogEvent.find(eventFilter)
        .sort({ lineNumber: 1 })
        .limit(500);

      return res.status(200).json({
        success: true,
        totalEvents: events.length,
        events,
      });
    } catch (error) {
      console.error("Fetch logs error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve log events.",
      });
    }
  }
);

export default router;

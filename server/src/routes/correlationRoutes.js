
import express from "express";
import mongoose from "mongoose";

import Correlation from "../models/Correlation.js";
import InvestigationCase from "../models/Case.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { runCorrelation } from "../services/correlationService.js";

const router = express.Router();

// Check whether logged-in user is Admin
const isAdmin = (req) =>
  String(req.user.role || "").toLowerCase() === "admin";

// Find a case accessible to the logged-in user
const findAccessibleCase = async (caseId, req) => {
  const filter = { _id: caseId };

  if (!isAdmin(req)) {
    filter.createdBy = req.user.userId;
  }

  return InvestigationCase.findOne(filter);
};

// Run correlation analysis for a case
router.post(
  "/cases/:caseId/run",
  authMiddleware,
  async (req, res) => {
    try {
      const { caseId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(caseId)) {
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

      const result = await runCorrelation(
        caseId,
        req.user.userId
      );

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Correlation error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to run correlation analysis.",
      });
    }
  }
);

// Get correlations for a case
router.get(
  "/cases/:caseId",
  authMiddleware,
  async (req, res) => {
    try {
      const { caseId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(caseId)) {
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

      const filter = { caseId };

      // Investigators see only correlations they created.
      // Admin can see all correlations for the selected case.
      if (!isAdmin(req)) {
        filter.createdBy = req.user.userId;
      }

      const correlations = await Correlation.find(filter)
        .populate("evidenceId", "originalName sha256")
        .populate(
          "logEventId",
          "timestamp level message ipAddress suspicious"
        )
        .sort({ confidence: -1 });

      return res.status(200).json({
        success: true,
        total: correlations.length,
        correlations,
      });
    } catch (error) {
      console.error("Fetch correlations error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve correlations.",
      });
    }
  }
);

export default router;

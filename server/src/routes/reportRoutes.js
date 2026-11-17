
import express from "express";
import mongoose from "mongoose";

import authMiddleware from "../middleware/authMiddleware.js";
import { generateInvestigationReport } from "../services/reportService.js";

const router = express.Router();

// Download investigation report as PDF
router.get(
  "/cases/:caseId/pdf",
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

      const pdfBuffer = await generateInvestigationReport(
        caseId,
        req.user.userId
      );

      res.setHeader("Content-Type", "application/pdf");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="investigation-report-${caseId}.pdf"`
      );

      res.setHeader("Content-Length", pdfBuffer.length);

      return res.status(200).send(pdfBuffer);
    } catch (error) {
      console.error("Report generation error:", error);

      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? error.message
          : "Failed to generate investigation report.",
      });
    }
  }
);

export default router;

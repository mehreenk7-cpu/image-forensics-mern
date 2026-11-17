
import express from "express";
import mongoose from "mongoose";

import Finding from "../models/Finding.js";
import InvestigationCase from "../models/Case.js";
import authMiddleware from "../middleware/authMiddleware.js";

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

// CREATE FINDING
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      caseId,
      title,
      description,
      category,
      severity,
      relatedEvidence,
      relatedLogEvents,
    } = req.body;

    if (!caseId || !mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({
        success: false,
        message: "A valid case ID is required.",
      });
    }

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required.",
      });
    }

    const investigationCase = await findAccessibleCase(caseId, req);

    if (!investigationCase) {
      return res.status(404).json({
        success: false,
        message: "Case not found or access denied.",
      });
    }

    const finding = await Finding.create({
      caseId,
      title,
      description,
      category,
      severity,
      relatedEvidence: relatedEvidence || [],
      relatedLogEvents: relatedLogEvents || [],
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Finding created successfully.",
      finding,
    });
  } catch (error) {
    console.error("Create finding error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create finding.",
    });
  }
});

// GET ALL FINDINGS FOR A CASE
router.get("/cases/:caseId", authMiddleware, async (req, res) => {
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

    // Investigators see their own findings.
    // Admin sees all findings for the selected case.
    if (!isAdmin(req)) {
      filter.createdBy = req.user.userId;
    }

    const findings = await Finding.find(filter)
      .populate("relatedEvidence", "originalName sha256")
      .populate("relatedLogEvents", "timestamp level message")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: findings.length,
      findings,
    });
  } catch (error) {
    console.error("Fetch findings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve findings.",
    });
  }
});

// UPDATE FINDING STATUS
router.patch("/:findingId/status", authMiddleware, async (req, res) => {
  try {
    const { findingId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["Open", "Under Review", "Resolved"];

    if (!mongoose.Types.ObjectId.isValid(findingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid finding ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    const filter = { _id: findingId };

    // Investigators can update only their own findings.
    // Admin can update findings created by any user.
    if (!isAdmin(req)) {
      filter.createdBy = req.user.userId;
    }

    const finding = await Finding.findOneAndUpdate(
      filter,
      { status },
      { new: true, runValidators: true }
    );

    if (!finding) {
      return res.status(404).json({
        success: false,
        message: "Finding not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Finding status updated successfully.",
      finding,
    });
  } catch (error) {
    console.error("Update finding error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update finding.",
    });
  }
});

export default router;

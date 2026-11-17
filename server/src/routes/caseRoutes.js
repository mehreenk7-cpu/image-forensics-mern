
import express from "express";
import mongoose from "mongoose";
import InvestigationCase from "../models/Case.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

// Check whether the logged-in user is an admin
const isAdmin = (req) =>
  String(req.user.role || "").toLowerCase() === "admin";

// CREATE CASE
router.post("/", async (req, res) => {
  try {
    const { title, description, priority } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({
        message: "Case title and description are required.",
      });
    }

    if (
      priority !== undefined &&
      !["Low", "Medium", "High", "Critical"].includes(priority)
    ) {
      return res.status(400).json({
        message: "Invalid priority.",
      });
    }

    const caseNumber =
      `CASE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const newCase = await InvestigationCase.create({
      caseNumber,
      title: title.trim(),
      description: description.trim(),
      priority: priority || "Medium",
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      message: "Investigation case created successfully.",
      case: newCase,
    });
  } catch (error) {
    console.error("Create case error:", error.message);

    return res.status(500).json({
      message: "Unable to create investigation case.",
    });
  }
});

// GET CASES
// Admin: all cases
// User: only their own cases
router.get("/", async (req, res) => {
  try {
    const filter = isAdmin(req)
      ? {}
      : { createdBy: req.user.userId };

    const cases = await InvestigationCase.find(filter)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: cases.length,
      cases,
    });
  } catch (error) {
    console.error("Get cases error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve investigation cases.",
    });
  }
});

// UPDATE CASE STATUS (ADMIN ONLY)
router.patch("/:id/status", async (req, res) => {
  try {
    if (String(req.user.role).toLowerCase() !== "admin") {
      return res.status(403).json({
        message: "Only admins can update case status.",
      });
    }

    const { status } = req.body;

    const allowedStatuses = ["Open", "In Progress", "Resolved"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid case status.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid case ID.",
      });
    }

    const updatedCase = await InvestigationCase.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedCase) {
      return res.status(404).json({
        message: "Case not found.",
      });
    }

    return res.status(200).json({
      message: "Case status updated successfully.",
      case: updatedCase,
    });
  } catch (error) {
    console.error("Update case status error:", error.message);

    return res.status(500).json({
      message: "Unable to update case status.",
    });
  }
});

// GET ONE CASE
// Admin: can view any case
// User: can view only their own case
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid case ID.",
      });
    }

    const filter = isAdmin(req)
      ? { _id: req.params.id }
      : {
          _id: req.params.id,
          createdBy: req.user.userId,
        };

    const foundCase = await InvestigationCase.findOne(filter);

    if (!foundCase) {
      return res.status(404).json({
        message: "Case not found.",
      });
    }

    return res.status(200).json({
      case: foundCase,
    });
  } catch (error) {
    console.error("Get case error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve the case.",
    });
  }
});

export default router;

import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import Evidence from "../models/Evidence.js";
import InvestigationCase from "../models/Case.js";
import authMiddleware from "../middleware/authMiddleware.js";
import analyzeImage from "../services/imageAnalysisService.js";

const router = express.Router();

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

// Original and backup directories
const uploadDir = path.resolve(
  currentDir,
  "../../uploads/evidence"
);

const backupDir = path.resolve(
  currentDir,
  "../../uploads/evidence-backups"
);

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
      !allowedTypes.has(file.mimetype) ||
      !allowedExtensions.has(extension)
    ) {
      return callback(
        new Error("Only JPG, PNG and PDF files are allowed.")
      );
    }

    callback(null, true);
  },
});

router.use(authMiddleware);

const isAdmin = (req) =>
  String(req.user.role || "").toLowerCase() === "admin";

const createHash = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

// Check case access
const findAccessibleCase = async (caseId, req) => {
  const filter = { _id: caseId };

  if (!isAdmin(req)) {
    filter.createdBy = req.user.userId;
  }

  return InvestigationCase.findOne(filter);
};

// Check evidence access
const findAccessibleEvidence = async (
  evidenceId,
  caseId,
  req
) => {
  const filter = {
    _id: evidenceId,
    caseId,
  };

  if (!isAdmin(req)) {
    filter.uploadedBy = req.user.userId;
  }

  return Evidence.findOne(filter);
};

// ========================================
// UPLOAD EVIDENCE + AUTOMATIC BACKUP
// ========================================

router.post(
  "/cases/:caseId/evidence",
  (req, res, next) => {
    upload.single("evidence")(req, res, (error) => {
      if (error) {
        const message =
          error instanceof multer.MulterError &&
          error.code === "LIMIT_FILE_SIZE"
            ? "File size must not exceed 10 MB."
            : error.message || "File upload failed.";

        return res.status(400).json({ message });
      }

      next();
    });
  },
  async (req, res) => {
    let savedPath;
    let savedBackupPath;

    try {
      const { caseId } = req.params;

      if (!mongoose.isValidObjectId(caseId)) {
        return res.status(400).json({
          message: "Invalid case ID.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Please select a file using the evidence field.",
        });
      }

      const investigationCase = await findAccessibleCase(
        caseId,
        req
      );

      if (!investigationCase) {
        return res.status(404).json({
          message: "Case not found or access denied.",
        });
      }

      const extension = path.extname(
        req.file.originalname
      ).toLowerCase();

      const storedName = `${crypto.randomUUID()}${extension}`;

      // Different name for backup
      const backupStoredName = `${crypto.randomUUID()}.backup`;

      const sha256 = createHash(req.file.buffer);

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(backupDir, { recursive: true });

      savedPath = path.join(uploadDir, storedName);

      savedBackupPath = path.join(
        backupDir,
        backupStoredName
      );

      // Save original evidence
      await fs.writeFile(savedPath, req.file.buffer, {
        flag: "wx",
        mode: 0o600,
      });

      // Save independent backup copy
      await fs.writeFile(
        savedBackupPath,
        req.file.buffer,
        {
          flag: "wx",
          mode: 0o600,
        }
      );

      // Calculate backup hash independently
      const backupBuffer = await fs.readFile(savedBackupPath);
      const backupSha256 = createHash(backupBuffer);

      if (backupSha256 !== sha256) {
        throw new Error("Backup verification failed.");
      }

      const evidence = await Evidence.create({
        caseId: investigationCase._id,
        originalName: path.basename(req.file.originalname),
        storedName,
        filePath: savedPath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        sha256,

        backupStoredName,
        backupPath: savedBackupPath,
        backupSha256,
        backupCreatedAt: new Date(),

        uploadedBy: req.user.userId,
      });

      return res.status(201).json({
        message: "Evidence uploaded successfully. Backup created and verified.",
        evidence: {
          id: evidence._id,
          caseId: evidence.caseId,
          originalName: evidence.originalName,
          mimeType: evidence.mimeType,
          size: evidence.size,
          sha256: evidence.sha256,
          backupAvailable: true,
          backupVerified: true,
          uploadedAt: evidence.createdAt,
        },
      });

    } catch (error) {
      if (savedPath) {
        await fs.unlink(savedPath).catch(() => {});
      }

      if (savedBackupPath) {
        await fs.unlink(savedBackupPath).catch(() => {});
      }

      console.error("Evidence upload error:", error);

      return res.status(500).json({
        message: "Unable to upload evidence or create its backup.",
      });
    }
  }
);

// ========================================
// LIST EVIDENCE
// ========================================


router.get("/cases/:caseId/evidence", async (req, res) => {
  try {
    const { caseId } = req.params;

    if (!mongoose.isValidObjectId(caseId)) {
      return res.status(400).json({
        message: "Invalid case ID.",
      });
    }

    const investigationCase = await findAccessibleCase(
      caseId,
      req
    );

    if (!investigationCase) {
      return res.status(404).json({
        message: "Case not found or access denied.",
      });
    }

    const evidenceFilter = {
      caseId: investigationCase._id,
    };

    if (!isAdmin(req)) {
      evidenceFilter.uploadedBy = req.user.userId;
    }

    // Keep backupPath internally for checking.
    // Never send the server's filesystem path to the frontend.
    const evidence = await Evidence.find(evidenceFilter)
      .select("-filePath")
      .sort({ createdAt: -1 });

    const results = await Promise.all(
      evidence.map(async (item) => {
        let backupAvailable = false;
        let backupVerified = false;

        if (item.backupPath && item.backupSha256) {
          try {
            const backupBuffer = await fs.readFile(
              item.backupPath
            );

            backupAvailable = true;

            const actualBackupHash = createHash(backupBuffer);

            backupVerified =
              actualBackupHash === item.backupSha256;

          } catch (error) {
            if (error.code !== "ENOENT") {
              console.error(
                "Backup check error:",
                error.message
              );
            }
          }
        }

        const record = item.toObject();

        delete record.filePath;
        delete record.backupPath;

        return {
          ...record,
          backupAvailable,
          backupVerified,
        };
      })
    );

    return res.status(200).json({
      count: results.length,
      evidence: results,
    });

  } catch (error) {
    console.error("List evidence error:", error);

    return res.status(500).json({
      message: "Unable to retrieve evidence.",
    });
  }
});

// ========================================
// VERIFY AND DOWNLOAD ORIGINAL BACKUP
// ========================================

router.get(
  "/cases/:caseId/evidence/:evidenceId/backup",
  async (req, res) => {
    try {
      const { caseId, evidenceId } = req.params;

      if (
        !mongoose.isValidObjectId(caseId) ||
        !mongoose.isValidObjectId(evidenceId)
      ) {
        return res.status(400).json({
          message: "Invalid case ID or evidence ID.",
        });
      }

      const investigationCase = await findAccessibleCase(
        caseId,
        req
      );

      if (!investigationCase) {
        return res.status(404).json({
          message: "Case not found or access denied.",
        });
      }

      const evidence = await findAccessibleEvidence(
        evidenceId,
        investigationCase._id,
        req
      );

      if (!evidence) {
        return res.status(404).json({
          message: "Evidence not found or access denied.",
        });
      }

      if (!evidence.backupPath || !evidence.backupSha256) {
        return res.status(404).json({
          message: "No backup is available for this evidence.",
        });
      }

      const backupBuffer = await fs.readFile(
        evidence.backupPath
      );

      const backupHash = createHash(backupBuffer);

      if (backupHash !== evidence.backupSha256) {
        return res.status(409).json({
          message: "Backup integrity check failed. Download blocked.",
          backupIntegrity: false,
        });
      }

      return res.download(
        evidence.backupPath,
        evidence.originalName
      );

    } catch (error) {
      console.error("Backup download error:", error.message);

      return res.status(
        error.code === "ENOENT" ? 404 : 500
      ).json({
        message:
          error.code === "ENOENT"
            ? "Backup file is missing."
            : "Unable to download backup.",
      });
    }
  }
);

// ========================================
// ADVANCED IMAGE FORENSIC ANALYSIS
// ========================================

router.get(
  "/cases/:caseId/evidence/:evidenceId/analyze",
  async (req, res) => {
    try {
      const { caseId, evidenceId } = req.params;

      if (
        !mongoose.isValidObjectId(caseId) ||
        !mongoose.isValidObjectId(evidenceId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid case ID or evidence ID.",
        });
      }

      const investigationCase = await findAccessibleCase(
        caseId,
        req
      );

      if (!investigationCase) {
        return res.status(404).json({
          success: false,
          message: "Case not found or access denied.",
        });
      }

      const evidence = await findAccessibleEvidence(
        evidenceId,
        investigationCase._id,
        req
      );

      if (!evidence) {
        return res.status(404).json({
          success: false,
          message: "Evidence not found or access denied.",
        });
      }

      if (!["image/jpeg", "image/png"].includes(evidence.mimeType)) {
        return res.status(400).json({
          success: false,
          message: "Advanced analysis supports JPG and PNG images only.",
        });
      }

      const imageBuffer = await fs.readFile(evidence.filePath);
      const currentHash = createHash(imageBuffer);

      if (currentHash !== evidence.sha256) {
        return res.status(409).json({
          success: false,
          message: "Evidence integrity check failed. Analysis stopped.",
          isIntact: false,
          originalHash: evidence.sha256,
          currentHash,
        });
      }

      const analysis = await analyzeImage(imageBuffer);

      return res.status(200).json({
        success: true,
        message: "Image forensic analysis completed.",
        evidenceId: evidence._id,
        originalName: evidence.originalName,
        sha256: evidence.sha256,
        isIntact: true,
        analysis,
        analysedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error("Image analysis error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to perform image forensic analysis.",
      });
    }
  }
);

// ========================================
// VERIFY ORIGINAL + BACKUP INTEGRITY
// ========================================

router.get(
  "/cases/:caseId/evidence/:evidenceId/verify",
  async (req, res) => {
    try {
      const { caseId, evidenceId } = req.params;

      if (
        !mongoose.isValidObjectId(caseId) ||
        !mongoose.isValidObjectId(evidenceId)
      ) {
        return res.status(400).json({
          message: "Invalid case ID or evidence ID.",
        });
      }

      const investigationCase = await findAccessibleCase(
        caseId,
        req
      );

      if (!investigationCase) {
        return res.status(404).json({
          message: "Case not found or access denied.",
        });
      }

      const evidence = await findAccessibleEvidence(
        evidenceId,
        investigationCase._id,
        req
      );

      if (!evidence) {
        return res.status(404).json({
          message: "Evidence not found or access denied.",
        });
      }

      // Verify current original file
      let currentHash = null;
      let originalFileAvailable = true;

      try {
        const fileBuffer = await fs.readFile(evidence.filePath);
        currentHash = createHash(fileBuffer);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        originalFileAvailable = false;
      }

      const isIntact =
        originalFileAvailable &&
        currentHash === evidence.sha256;

      // Verify backup independently
      let backupHash = null;
      let backupAvailable = false;
      let backupIntegrity = false;

      if (evidence.backupPath && evidence.backupSha256) {
        try {
          const backupBuffer = await fs.readFile(
            evidence.backupPath
          );

          backupHash = createHash(backupBuffer);
          backupAvailable = true;

          backupIntegrity =
            backupHash === evidence.backupSha256;

        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }

      const tampered = !isIntact;

      let message;

      if (isIntact && backupIntegrity) {
        message =
          "Evidence integrity verified. Original and backup are intact.";
      } else if (tampered && backupIntegrity) {
        message =
          "TAMPERING DETECTED! Original evidence changed. Verified backup is available.";
      } else if (tampered && !backupAvailable) {
        message =
          "TAMPERING DETECTED! Original evidence changed. Backup is missing.";
      } else if (!isIntact && backupAvailable && !backupIntegrity) {
        message =
          "WARNING! Original evidence and backup integrity checks failed.";
      } else {
        message =
          "Evidence integrity warning. Backup is unavailable or unverified.";
      }

      return res.status(200).json({
        message,
        evidenceId: evidence._id,
        originalName: evidence.originalName,
        algorithm: "SHA-256",

        originalHash: evidence.sha256,
        currentHash,

        isIntact,
        tampered,

        originalFileAvailable,

        backupAvailable,
        backupHash,
        backupExpectedHash: evidence.backupSha256 || null,
        backupIntegrity,

        canDownloadBackup: backupAvailable && backupIntegrity,

        verifiedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error("Evidence verification error:", error.message);

      return res.status(500).json({
        message: "Unable to verify evidence integrity.",
      });
    }
  }
);


// ========================================
// COMPARE AN EXTERNAL FILE WITH ORIGINAL EVIDENCE
// ========================================

router.post(
  "/cases/:caseId/evidence/:evidenceId/compare",
  (req, res, next) => {
    upload.single("comparisonFile")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message || "Comparison file upload failed.",
        });
      }

      next();
    });
  },
  async (req, res) => {
    try {
      const { caseId, evidenceId } = req.params;

      if (
        !mongoose.isValidObjectId(caseId) ||
        !mongoose.isValidObjectId(evidenceId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid case ID or evidence ID.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a comparison file.",
        });
      }

      const investigationCase = await findAccessibleCase(
        caseId,
        req
      );

      if (!investigationCase) {
        return res.status(404).json({
          success: false,
          message: "Case not found or access denied.",
        });
      }

      const evidence = await findAccessibleEvidence(
        evidenceId,
        investigationCase._id,
        req
      );

      if (!evidence) {
        return res.status(404).json({
          success: false,
          message: "Evidence not found or access denied.",
        });
      }

      // Calculate SHA-256 of newly selected file
      const uploadedHash = createHash(req.file.buffer);

      // Compare with originally recorded hash
      const matchesOriginal =
        uploadedHash === evidence.sha256;

      // Compare with independently recorded backup hash
      const matchesBackup =
        Boolean(evidence.backupSha256) &&
        uploadedHash === evidence.backupSha256;

      return res.status(200).json({
        success: true,

        message: matchesOriginal
          ? "MATCH: Selected file matches the original evidence."
          : "MISMATCH: Selected file differs from the original evidence.",

        evidenceId: evidence._id,
        originalName: evidence.originalName,
        comparisonFileName: req.file.originalname,

        algorithm: "SHA-256",

        originalHash: evidence.sha256,
        uploadedHash,

        backupExpectedHash: evidence.backupSha256 || null,

        matchesOriginal,
        matchesBackup,

        comparedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error("External comparison error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to compare external evidence.",
      });
    }
  }
);

export default router;

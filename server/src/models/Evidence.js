
import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestigationCase",
      required: true,
      index: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    storedName: {
      type: String,
      required: true,
      unique: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    sha256: {
      type: String,
      required: true,
      index: true,
    },

    // BACKUP INFORMATION
    backupStoredName: {
      type: String,
      default: null,
    },

    backupPath: {
      type: String,
      default: null,
    },

    backupSha256: {
      type: String,
      default: null,
    },

    backupCreatedAt: {
      type: Date,
      default: null,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Evidence = mongoose.model("Evidence", evidenceSchema);

export default Evidence;

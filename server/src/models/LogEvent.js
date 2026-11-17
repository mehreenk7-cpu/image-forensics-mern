
import mongoose from "mongoose";

const logEventSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestigationCase",
      required: true,
      index: true,
    },

    source: {
      type: String,
      default: "Uploaded Log File",
    },

    originalFileName: {
      type: String,
      default: "",
    },

    lineNumber: {
      type: Number,
      default: 0,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    level: {
      type: String,
      enum: ["INFO", "WARNING", "ERROR", "CRITICAL", "UNKNOWN"],
      default: "UNKNOWN",
      index: true,
    },

    message: {
      type: String,
      required: true,
    },

    ipAddress: {
      type: String,
      default: "Unknown",
    },

    eventType: {
      type: String,
      default: "General Activity",
    },

    suspicious: {
      type: Boolean,
      default: false,
      index: true,
    },

    rawLog: {
      type: String,
      default: "",
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster case-wise log retrieval
logEventSchema.index({ caseId: 1, timestamp: -1 });
logEventSchema.index({ caseId: 1, lineNumber: 1 });

const LogEvent = mongoose.model("LogEvent", logEventSchema);

export default LogEvent;

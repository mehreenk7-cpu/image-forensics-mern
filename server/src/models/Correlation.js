import mongoose from "mongoose";

const correlationSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestigationCase",
      required: true,
      index: true,
    },

    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evidence",
      required: true,
    },

    logEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LogEvent",
      required: true,
    },

    correlationType: {
      type: String,
      default: "Time-Based Correlation",
    },

    confidence: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["New", "Reviewed", "Dismissed"],
      default: "New",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate correlations for the same evidence and log event.
correlationSchema.index(
  { caseId: 1, evidenceId: 1, logEventId: 1 },
  { unique: true }
);

const Correlation = mongoose.model("Correlation", correlationSchema);

export default Correlation;
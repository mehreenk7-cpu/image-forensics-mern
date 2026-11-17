import mongoose from "mongoose";

const findingSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestigationCase",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    category: {
      type: String,
      enum: [
        "Suspicious Login",
        "Unauthorized Access",
        "Malware Activity",
        "Data Integrity",
        "Network Activity",
        "Other",
      ],
      default: "Other",
    },

    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },

    relatedEvidence: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Evidence",
      },
    ],

    relatedLogEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LogEvent",
      },
    ],

    status: {
      type: String,
      enum: ["Open", "Under Review", "Resolved"],
      default: "Open",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

findingSchema.index({ caseId: 1, createdAt: -1 });

const Finding = mongoose.model("Finding", findingSchema);

export default Finding;
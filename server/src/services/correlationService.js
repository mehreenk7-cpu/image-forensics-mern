import Evidence from "../models/Evidence.js";
import LogEvent from "../models/LogEvent.js";
import Correlation from "../models/Correlation.js";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function calculateConfidence(logEvent, timeDifference) {
  let score = 50;

  // Give more weight to suspicious log events.
  if (logEvent.suspicious) {
    score += 25;
  }

  if (logEvent.level === "CRITICAL") {
    score += 20;
  } else if (logEvent.level === "ERROR") {
    score += 15;
  } else if (logEvent.level === "WARNING") {
    score += 10;
  }

  // Closer timestamps increase the confidence score.
  const hoursApart = timeDifference / (60 * 60 * 1000);

  if (hoursApart <= 1) {
    score += 5;
  }

  return Math.min(score, 100);
}

function createReason(logEvent, timeDifference) {
  const hoursApart = (
    timeDifference / (60 * 60 * 1000)
  ).toFixed(2);

  return (
    `Evidence was uploaded within ${hoursApart} hours of this log event. ` +
    `Log level: ${logEvent.level}. ` +
    `Suspicious activity: ${logEvent.suspicious ? "Yes" : "No"}. ` +
    "This is a time-based association and requires investigator review."
  );
}

export async function runCorrelation(caseId, userId) {
  const evidenceFiles = await Evidence.find({
    caseId,
    uploadedBy: userId,
  });

  const logEvents = await LogEvent.find({
    caseId,
    uploadedBy: userId,
    $or: [
      { suspicious: true },
      { level: { $in: ["WARNING", "ERROR", "CRITICAL"] } },
    ],
  });

  if (evidenceFiles.length === 0 || logEvents.length === 0) {
    return {
      totalEvidence: evidenceFiles.length,
      totalLogEvents: logEvents.length,
      newCorrelations: 0,
      correlations: [],
      message:
        "Upload both evidence files and log files before running correlation.",
    };
  }

  const correlations = [];

  for (const evidence of evidenceFiles) {
    for (const logEvent of logEvents) {
      const evidenceTime = new Date(evidence.createdAt).getTime();
      const logTime = new Date(logEvent.timestamp).getTime();

      const timeDifference = Math.abs(evidenceTime - logTime);

      // Ignore events more than 24 hours apart.
      if (timeDifference > TWENTY_FOUR_HOURS) {
        continue;
      }

      const confidence = calculateConfidence(
        logEvent,
        timeDifference
      );

      const reason = createReason(logEvent, timeDifference);

      const correlation = await Correlation.findOneAndUpdate(
        {
          caseId,
          evidenceId: evidence._id,
          logEventId: logEvent._id,
        },
        {
          $setOnInsert: {
            caseId,
            evidenceId: evidence._id,
            logEventId: logEvent._id,
            correlationType: "Time-Based Correlation",
            confidence,
            reason,
            createdBy: userId,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      correlations.push(correlation);
    }
  }

  return {
    totalEvidence: evidenceFiles.length,
    totalLogEvents: logEvents.length,
    newCorrelations: correlations.length,
    correlations,
    message: "Correlation analysis completed successfully.",
  };
}
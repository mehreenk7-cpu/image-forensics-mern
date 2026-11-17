
import PDFDocument from "pdfkit";

import InvestigationCase from "../models/Case.js";
import Evidence from "../models/Evidence.js";
import LogEvent from "../models/LogEvent.js";
import Correlation from "../models/Correlation.js";
import Finding from "../models/Finding.js";

function formatDate(value) {
  if (!value) return "Not available";

  return new Date(value).toLocaleString("en-IN");
}

function addHeading(doc, heading) {
  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#123456")
    .text(heading);

  doc.moveDown(0.3);
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor("#cccccc")
    .stroke();

  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).fillColor("#222222");
}

function addItem(doc, label, value) {
  doc.font("Helvetica-Bold").text(`${label}: `, {
    continued: true,
  });

  doc.font("Helvetica").text(
    value === undefined || value === null || value === ""
      ? "Not available"
      : String(value)
  );

  doc.moveDown(0.3);
}

export async function generateInvestigationReport(caseId, userId) {
  const investigationCase = await InvestigationCase.findOne({
    _id: caseId,
    createdBy: userId,
  }).lean();

  if (!investigationCase) {
    const error = new Error("Case not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  const [evidenceFiles, logEvents, correlations, findings] =
    await Promise.all([
      Evidence.find({ caseId, uploadedBy: userId })
        .sort({ createdAt: 1 })
        .lean(),

      LogEvent.find({ caseId, uploadedBy: userId })
        .sort({ timestamp: 1 })
        .limit(500)
        .lean(),

      Correlation.find({ caseId, createdBy: userId })
        .populate("evidenceId", "originalName sha256")
        .populate("logEventId", "timestamp level message")
        .sort({ confidence: -1 })
        .lean(),

      Finding.find({ caseId, createdBy: userId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50,
    },
    bufferPages: true,
  });

  const chunks = [];

  const pdfBufferPromise = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Cover and case details
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#123456")
    .text("DIGITAL FORENSICS INVESTIGATION REPORT", {
      align: "center",
    });

  doc.moveDown(0.5);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555555")
    .text("Confidential Investigation Document", {
      align: "center",
    });

  addHeading(doc, "1. Investigation Case Details");

  addItem(doc, "Case Number", investigationCase.caseNumber);
  addItem(doc, "Case Title", investigationCase.title);
  addItem(doc, "Description", investigationCase.description);
  addItem(doc, "Priority", investigationCase.priority);
  addItem(doc, "Status", investigationCase.status);
  addItem(doc, "Created", formatDate(investigationCase.createdAt));
  addItem(doc, "Report Generated", formatDate(new Date()));

  // Evidence
  addHeading(doc, "2. Digital Evidence");

  addItem(doc, "Total Evidence Files", evidenceFiles.length);

  if (evidenceFiles.length === 0) {
    doc.text("No evidence files were uploaded for this case.");
  } else {
    evidenceFiles.forEach((item, index) => {
      doc.font("Helvetica-Bold").text(
        `Evidence ${index + 1}: ${item.originalName}`
      );

      addItem(doc, "File Type", item.mimeType);
      addItem(doc, "File Size", `${item.size} bytes`);
      addItem(doc, "SHA-256", item.sha256);
      addItem(doc, "Uploaded", formatDate(item.createdAt));

      doc.moveDown(0.5);
    });
  }

  // Logs
  addHeading(doc, "3. Log Analysis");

  const suspiciousCount = logEvents.filter(
    (event) => event.suspicious
  ).length;

  const criticalCount = logEvents.filter(
    (event) => event.level === "CRITICAL"
  ).length;

  const errorCount = logEvents.filter(
    (event) => event.level === "ERROR"
  ).length;

  addItem(doc, "Total Log Events", logEvents.length);
  addItem(doc, "Suspicious Events", suspiciousCount);
  addItem(doc, "Critical Events", criticalCount);
  addItem(doc, "Error Events", errorCount);

  if (logEvents.length === 0) {
    doc.text("No log events were uploaded for this case.");
  } else {
    logEvents.forEach((event, index) => {
      doc.font("Helvetica-Bold").text(
        `Event ${index + 1}: ${event.level}`
      );

      addItem(doc, "Timestamp", formatDate(event.timestamp));
      addItem(doc, "Event Type", event.eventType);
      addItem(doc, "IP Address", event.ipAddress);
      addItem(doc, "Suspicious", event.suspicious ? "Yes" : "No");
      addItem(doc, "Message", event.message);

      doc.moveDown(0.4);
    });
  }

  // Correlations
  addHeading(doc, "4. Correlation Analysis");

  addItem(doc, "Total Correlations", correlations.length);

  if (correlations.length === 0) {
    doc.text("No correlations have been generated for this case.");
  } else {
    correlations.forEach((item, index) => {
      doc.font("Helvetica-Bold").text(
        `Correlation ${index + 1}`
      );

      addItem(doc, "Type", item.correlationType);
      addItem(doc, "Confidence", `${item.confidence}%`);
      addItem(doc, "Reason", item.reason);
      addItem(doc, "Status", item.status);

      doc.moveDown(0.4);
    });
  }

  // Findings
  addHeading(doc, "5. Investigation Findings");

  addItem(doc, "Total Findings", findings.length);

  if (findings.length === 0) {
    doc.text("No investigation findings have been recorded.");
  } else {
    findings.forEach((item, index) => {
      doc.font("Helvetica-Bold").text(
        `Finding ${index + 1}: ${item.title}`
      );

      addItem(doc, "Category", item.category);
      addItem(doc, "Severity", item.severity);
      addItem(doc, "Description", item.description);
      addItem(doc, "Status", item.status);

      doc.moveDown(0.4);
    });
  }

  // Conclusion
  addHeading(doc, "6. Report Summary");

  doc.text(
    "This report summarizes the investigation case information, " +
    "uploaded digital evidence, parsed log events, generated correlations, " +
    "and recorded findings available at the time of report generation."
  );

  doc.moveDown(0.5);

  doc.text(
    "Correlation results are potential investigative leads and should " +
    "be independently reviewed. This report does not by itself establish " +
    "that an incident occurred or that two records are causally connected."
  );

  doc.moveDown(2);

  doc
    .font("Helvetica-Bold")
    .text("End of Investigation Report", {
      align: "center",
    });

  // Add page numbers
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#777777")
      .text(
        `Image Forensics and Log Analyser | Page ${i + 1}`,
        50,
        790,
        {
          width: 495,
          align: "center",
        }
      );
  }

  doc.end();

  return pdfBufferPromise;
}

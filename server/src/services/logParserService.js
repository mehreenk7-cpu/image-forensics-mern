
const IP_REGEX =
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

function getLevel(message) {
  // First detect the explicitly specified log level.
  const explicitLevel = message.match(
    /\b(CRITICAL|FATAL|EMERGENCY|ALERT|ERROR|ERR|WARNING|WARN|INFO|DEBUG)\b/i
  );

  if (explicitLevel) {
    const level = explicitLevel[0].toUpperCase();

    if (["CRITICAL", "FATAL", "EMERGENCY", "ALERT"].includes(level)) {
      return "CRITICAL";
    }

    if (["ERROR", "ERR"].includes(level)) {
      return "ERROR";
    }

    if (["WARNING", "WARN"].includes(level)) {
      return "WARNING";
    }

    if (["INFO", "DEBUG"].includes(level)) {
      return "INFO";
    }
  }

  // Fallback when no explicit level is present.
  const text = message.toLowerCase();

  if (/critical|fatal|emergency|alert/.test(text)) {
    return "CRITICAL";
  }

  if (/warning|suspicious|blocked|invalid/.test(text)) {
    return "WARNING";
  }

  if (/failed|failure|error|denied|unauthorized/.test(text)) {
    return "ERROR";
  }

  if (/success|accepted|connected|login|started/.test(text)) {
    return "INFO";
  }

  return "UNKNOWN";
}

function getEventType(message) {
  const text = message.toLowerCase();

  if (/failed login|login failed|multiple failed|unauthorized|invalid password/.test(text)) {
    return "Failed Login";
  }

  if (/login|log in|authentication|auth/.test(text)) {
    return "Authentication";
  }

  if (/logout|log out/.test(text)) {
    return "Logout";
  }

  if (/upload|download|file access/.test(text)) {
    return "File Activity";
  }

  if (/attack|malware|virus|intrusion/.test(text)) {
    return "Security Threat";
  }

  if (/firewall|blocked/.test(text)) {
    return "Firewall Activity";
  }

  return "General Activity";
}

function isSuspicious(message, level) {
  const text = message.toLowerCase();

  const suspiciousPatterns = [
    "failed login",
    "login failed",
    "unauthorized",
    "invalid password",
    "access denied",
    "brute force",
    "sql injection",
    "malware",
    "port scan",
    "privilege escalation",
    "multiple failed",
    "suspicious activity",
  ];

  return (
    level === "CRITICAL" ||
    suspiciousPatterns.some((pattern) => text.includes(pattern))
  );
}

function extractTimestamp(line) {
  const match = line.match(
    /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/
  );

  if (!match) return new Date();

  const parsed = new Date(match[0]);

  return Number.isNaN(parsed.getTime())
    ? new Date()
    : parsed;
}

function parseSingleLine(line) {
  const cleanLine = line.trim();

  if (!cleanLine) return null;

  const level = getLevel(cleanLine);
  const ipMatch = cleanLine.match(IP_REGEX);

  return {
    timestamp: extractTimestamp(cleanLine),
    level,
    message: cleanLine,
    ipAddress: ipMatch ? ipMatch[0] : "Unknown",
    eventType: getEventType(cleanLine),
    suspicious: isSuspicious(cleanLine, level),
    rawLog: cleanLine,
  };
}

export function parseLogFile(content) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  return lines
    .map(parseSingleLine)
    .filter(Boolean);
}

// Compatibility with logRoutes.js
export const parseLogText = parseLogFile;

export default parseLogFile;

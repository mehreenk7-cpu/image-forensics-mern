
import sharp from "sharp";
import exifr from "exifr";

function formatValue(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("hex");
  }

  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export async function analyzeImage(buffer) {
  const metadata = await sharp(buffer).metadata();

  if (!["jpeg", "png"].includes(metadata.format)) {
    throw new Error("Only JPEG and PNG images can be analysed.");
  }

  // Extract ALL supported image metadata.
  let exif = {};

  try {
    const rawExif = await exifr.parse(buffer, true);

    if (rawExif) {
      exif = Object.fromEntries(
        Object.entries(rawExif).map(([key, value]) => [
          key,
          formatValue(value),
        ])
      );
    }
  } catch (error) {
    console.log("Extended metadata extraction:", error.message);
  }

  // Extract GPS separately.
  let gps = null;

  try {
    const gpsData = await exifr.gps(buffer);

    if (gpsData) {
      gps = {
        latitude: gpsData.latitude ?? null,
        longitude: gpsData.longitude ?? null,
      };
    }
  } catch {
    console.log("GPS information unavailable.");
  }

  // Image metadata.
  const imageMetadata = {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    colorSpace: metadata.space || "Unknown",
    channels: metadata.channels || 0,
    hasAlpha: metadata.hasAlpha || false,
    orientation: metadata.orientation || null,
    bitsPerSample: metadata.bitsPerSample || null,
    density: metadata.density || null,
    compression: metadata.compression || null,
    chromaSubsampling: metadata.chromaSubsampling || null,
    isProgressive: metadata.isProgressive ?? null,
    hasProfile: metadata.hasProfile ?? null,
    isPalette: metadata.isPalette ?? false,
    pages: metadata.pages || 1,
  };

  // ELA is currently supported for JPEG.
  if (metadata.format !== "jpeg") {
    return {
      metadata: imageMetadata,
      exif,
      gps,
      elaAvailable: false,
      elaImage: null,
      elaMessage:
        "ELA is currently available only for JPEG images. Other metadata was extracted successfully.",
    };
  }

  // Recompress original image.
  const recompressed = await sharp(buffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  // Generate Error Level Analysis image.
  const elaBuffer = await sharp(buffer)
    .composite([
      {
        input: recompressed,
        blend: "difference",
      },
    ])
    .linear(25, 0)
    .normalize()
    .jpeg({ quality: 95 })
    .toBuffer();

  // Debug information.
  console.log("ELA buffer size:", elaBuffer.length);
  console.log("ELA image stats:", await sharp(elaBuffer).stats());

  return {
    metadata: imageMetadata,
    exif,
    gps,
    elaAvailable: true,
    elaImage: elaBuffer.toString("base64"),
    elaMessage:
      "ELA comparison generated. Brightness differences require further investigation and do not independently prove manipulation.",
  };
}

export default analyzeImage;

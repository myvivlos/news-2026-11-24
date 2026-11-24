// make.fun news-image entry: 1024x1024 front page
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_FILENAME = "entry.png";
const DEFAULT_OUTPUT_DIR = "/output";
const PNG_SIGNATURE: Readonly<Uint8Array> = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const MIN_PNG_HEADER_BYTES = 33;
const IHDR_DATA_LENGTH = 13;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;
const MAX_BYTES = 1_048_576;

const VALID_BIT_DEPTHS: Readonly<Record<number, readonly number[]>> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

const SOURCE_PATH: string = fileURLToPath(new URL(`./${IMAGE_FILENAME}`, import.meta.url));

export interface PngInfo {
  readonly byteLength: number;
  readonly width: number;
  readonly height: number;
}

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE: Uint32Array = buildCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function verifyPng(bytes: Buffer): PngInfo {
  if (bytes.length < PNG_SIGNATURE.length) {
    throw new Error(
      `PNG signature check failed: file is ${bytes.length} bytes (expected 8-byte PNG signature)`,
    );
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error(
        "PNG signature check failed: file does not start with 89 50 4e 47 0d 0a 1a 0a",
      );
    }
  }

  if (bytes.length < MIN_PNG_HEADER_BYTES) {
    throw new Error(
      `IHDR chunk check failed: file is ${bytes.length} bytes (minimum ${MIN_PNG_HEADER_BYTES} bytes for PNG signature and IHDR chunk)`,
    );
  }

  const ihdrLength = bytes.readUInt32BE(8);
  if (ihdrLength !== IHDR_DATA_LENGTH) {
    throw new Error(
      `IHDR chunk check failed: expected IHDR data length ${IHDR_DATA_LENGTH}, got ${ihdrLength}`,
    );
  }

  const chunkType = bytes.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    throw new Error(
      `IHDR chunk check failed: expected first chunk type "IHDR", got ${JSON.stringify(chunkType)}`,
    );
  }

  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const compression = bytes[26];
  const filter = bytes[27];
  const interlace = bytes[28];

  const allowedBitDepths = VALID_BIT_DEPTHS[colorType];
  if (!allowedBitDepths || !allowedBitDepths.includes(bitDepth)) {
    throw new Error(
      `IHDR chunk check failed: invalid colorType=${colorType} and bitDepth=${bitDepth}`,
    );
  }
  if (compression !== 0) {
    throw new Error(
      `IHDR chunk check failed: invalid compression method ${compression} (expected 0)`,
    );
  }
  if (filter !== 0) {
    throw new Error(
      `IHDR chunk check failed: invalid filter method ${filter} (expected 0)`,
    );
  }
  if (interlace !== 0 && interlace !== 1) {
    throw new Error(
      `IHDR chunk check failed: invalid interlace method ${interlace} (expected 0 or 1)`,
    );
  }

  const expectedCrc = crc32(bytes.subarray(12, 29));
  const actualCrc = bytes.readUInt32BE(29);
  if (actualCrc !== expectedCrc) {
    throw new Error(
      `IHDR chunk check failed: CRC-32 mismatch (expected 0x${expectedCrc.toString(16).padStart(8, "0")}, got 0x${actualCrc.toString(16).padStart(8, "0")})`,
    );
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    throw new Error(
      `PNG dimensions check failed: expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}, got width=${width}, height=${height}`,
    );
  }

  if (bytes.length > MAX_BYTES) {
    throw new Error(
      `PNG byte size check failed: ${bytes.length} bytes exceeds maximum ${MAX_BYTES} bytes (1 MiB)`,
    );
  }

  return { byteLength: bytes.length, width, height };
}

function readSourceImage(sourcePath: string): Buffer {
  try {
    return readFileSync(sourcePath);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Source image read failed for ${sourcePath}: ${detail}`);
  }
}

function resolveOutputDir(): string {
  const envDir = process.env.MAKEFUN_OUTPUT_DIR;
  if (envDir === undefined) {
    return DEFAULT_OUTPUT_DIR;
  }
  if (envDir.length === 0) {
    throw new Error("MAKEFUN_OUTPUT_DIR environment variable must not be empty");
  }
  return envDir;
}

function writeOutputImage(outputDir: string, bytes: Buffer): string {
  const outputPath = join(outputDir, IMAGE_FILENAME);
  try {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputPath, bytes);
    return outputPath;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Output write failed for ${outputPath}: ${detail}`);
  }
}

export function main(): void {
  const bytes = readSourceImage(SOURCE_PATH);
  const info = verifyPng(bytes);
  const outputDir = resolveOutputDir();
  writeOutputImage(outputDir, bytes);
  console.log(`${IMAGE_FILENAME}: ${info.byteLength} bytes, ${info.width}x${info.height}`);
  if (process.env.MAKEFUN_VERBOSE === "1") {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    console.log(`sha256: ${sha256}`);
  }
}

function isDirectExecution(): boolean {
  const entryArg = process.argv[1];
  if (!entryArg) {
    return false;
  }
  const currentFile = fileURLToPath(import.meta.url);
  try {
    return realpathSync(resolve(entryArg)) === realpathSync(currentFile);
  } catch {
    return resolve(entryArg) === currentFile;
  }
}

if (isDirectExecution()) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

import { readFileSync } from "node:fs";
import { CANONICAL } from "./digitMap.js";

/*
 * Parses OCR text blocks into digit chunks and decoded policy numbers.
 */

const DIGIT_WIDTH = 3;
const DIGITS_PER_ENTRY = 9;
const ENTRY_LINE_WIDTH = DIGIT_WIDTH * DIGITS_PER_ENTRY;
const DIGIT_CHUNK_WIDTH = DIGIT_WIDTH * DIGIT_WIDTH;

/*
 * OCR inputs are fixed-width in this challenge.
 * We pad short lines/chunks and trim long ones so downstream
 * digit slicing always operates on stable boundaries.
 */
function normalizeWidth(text, width) {
  /*
   * Keep each OCR row/chunk at a fixed width for safe slicing.
   */
  if (text.length < width) {
    return text.padEnd(width, " ");
  }
  if (text.length > width) {
    return text.slice(0, width);
  }
  return text;
}

function trimTrailingEmptyLines(lines) {
  /*
   * Remove terminal blank lines that do not represent OCR content.
   */
  while (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

export class DigitDecoder {
  constructor(canonicalMap = CANONICAL) {
    /*
     * Allow custom maps in tests while defaulting to canonical OCR glyphs.
     */
    this.canonical = canonicalMap;
  }

  normalize(chunk) {
    /*
     * Chunk width normalization avoids mismatches caused by short/long input.
     */
    return normalizeWidth(chunk, DIGIT_CHUNK_WIDTH);
  }

  decode(chunk) {
    /*
     * Decode one 3x3 OCR chunk; unknown shapes become '?'.
     */
    const key = this.normalize(chunk);
    return this.canonical[key] ?? "?";
  }
}

export class PolicyFileParser {
  constructor(path) {
    /*
     * Parser operates on a single OCR text file path.
     */
    this.path = path;
  }

  normalizeLine(line) {
    /*
     * Normalize each OCR row to the expected 9-digit display width.
     */
    return normalizeWidth(line.replace(/\n$/, ""), ENTRY_LINE_WIDTH);
  }

  entries() {
    /*
     * Split file into 4-line groups and emit only non-empty OCR entries.
     */
    const lines = trimTrailingEmptyLines(readFileSync(this.path, "utf-8").split(/\r?\n/));

    if (!lines.length) {
      return [];
    }

    while (lines.length % 4 !== 0) {
      lines.push("");
    }

    const result = [];
    /*
     * Each account block is 4 lines in the source format:
     * top/middle/bottom OCR rows + one separator line.
     */
    for (let i = 0; i < lines.length; i += 4) {
      const top = this.normalizeLine(lines[i]);
      const mid = this.normalizeLine(lines[i + 1]);
      const bot = this.normalizeLine(lines[i + 2]);

      if (!(top.trim() || mid.trim() || bot.trim())) {
        continue;
      }
      result.push([top, mid, bot]);
    }
    return result;
  }

  entryChunks(top, mid, bot) {
    /*
     * Build 9 OCR chunks by slicing each row in 3-char windows.
     */
    return Array.from({ length: DIGITS_PER_ENTRY }, (_, i) => {
      const start = i * DIGIT_WIDTH;
      const end = (i + 1) * DIGIT_WIDTH;
      return top.slice(start, end) + mid.slice(start, end) + bot.slice(start, end);
    });
  }

  parsedEntries() {
    /*
     * Decode each entry once and keep both raw chunks and decoded number.
     */
    const decoder = new DigitDecoder();
    return this.entries().map(([top, mid, bot]) => {
      const chunks = this.entryChunks(top, mid, bot);
      const number = chunks.map((chunk) => decoder.decode(chunk)).join("");
      return { top, mid, bot, chunks, number };
    });
  }

  parseDigits() {
    /*
     * Convenience API when caller only needs policy numbers.
     */
    return this.parsedEntries().map((entry) => entry.number);
  }
}


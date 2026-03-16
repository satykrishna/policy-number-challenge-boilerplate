import { CANONICAL } from "../digitMap.js";
import { ChecksumValidator } from "../us2/validator.js";

/*
 * US4 repair engine that attempts one-segment OCR corrections
 * and classifies unresolved numbers as AMB or ILL.
 */

/*
 * OCR segments in this challenge are represented only
 * by vertical and horizontal strokes.
 */
const SEGMENT_CHARS = new Set(["|", "_"]);

export class CorrectionResult {
  constructor(original, resolved, status, candidates = []) {
    /*
     * Captures original value, resolved output, and optional ambiguity set.
     */
    this.original = original;
    this.resolved = resolved;
    this.status = status;
    this.candidates = candidates;
  }

  get line() {
    /*
     * Serialized report line used by US4 findings writer.
     */
    return this.status ? `${this.resolved} ${this.status}` : this.resolved;
  }
}

export class CorrectionResolver {
  constructor(canonicalMap = CANONICAL) {
    /*
     * Memoize per-chunk replacements to avoid recomputing segment matches.
     */
    this.canonical = canonicalMap;
    this.canonicalDigits = Object.entries(this.canonical);
    this.replacementCache = new Map();
  }

  static isSingleSegmentChange(source, target) {
    /*
     * Checks whether source can become target via one allowed segment toggle.
     */
    /*
     * US4 correction candidates must differ by exactly one
     * add/remove segment operation.
     */
    const differences = [];
    for (let i = 0; i < Math.min(source.length, target.length); i += 1) {
      const left = source[i];
      const right = target[i];
      if (left !== right) {
        differences.push([left, right]);
        if (differences.length > 1) {
          return false;
        }
      }
    }

    if (!differences.length) {
      return false;
    }

    const [left, right] = differences[0];
    /*
     * A vertical-to-horizontal swap is not treated as a simple
     * one-segment toggle in this digit model.
     */
    if ((left === "|" && right === "_") || (left === "_" && right === "|")) {
      return false;
    }

    const pair = new Set([left, right]);
    /*
     * Valid change must be "space <-> segment", not
     * replacing one segment type with another.
     */
    if (!pair.has(" ")) {
      return false;
    }

    for (const value of pair) {
      if (value === " ") {
        continue;
      }
      if (!SEGMENT_CHARS.has(value)) {
        return false;
      }
    }

    return true;
  }

  replacementDigitsForChunk(chunk) {
    /*
     * Return all candidate digits reachable from this chunk by one segment change.
     */
    if (this.replacementCache.has(chunk)) {
      return this.replacementCache.get(chunk);
    }

    const replacements = new Set();
    for (const [pattern, digit] of this.canonicalDigits) {
      if (CorrectionResolver.isSingleSegmentChange(chunk, pattern)) {
        replacements.add(digit);
      }
    }

    this.replacementCache.set(chunk, replacements);
    return replacements;
  }

  validCandidates(entry) {
    /*
     * Substitute one position at a time and keep checksum-valid account numbers.
     */
    const candidates = new Set();
    const digits = entry.number.split("");

    /*
     * Try one-digit substitutions derived from one-segment OCR fixes,
     * then keep only checksum-valid account numbers.
     */
    entry.chunks.forEach((chunk, index) => {
      for (const replacement of this.replacementDigitsForChunk(chunk)) {
        if (digits[index] === replacement) {
          continue;
        }

        const candidateDigits = digits.slice();
        candidateDigits[index] = replacement;
        const candidate = candidateDigits.join("");
        if (ChecksumValidator.isValid(candidate)) {
          candidates.add(candidate);
        }
      }
    });

    return Array.from(candidates).sort();
  }

  resolve(entry) {
    /*
     * Return clean number as-is, unique fix when possible, else AMB/ILL.
     */
    const original = entry.number;
    if (ChecksumValidator.isValid(original)) {
      return new CorrectionResult(original, original, null);
    }

    const candidates = this.validCandidates(entry);
    if (candidates.length === 1) {
      return new CorrectionResult(original, candidates[0], null, candidates);
    }
    if (candidates.length > 1) {
      return new CorrectionResult(original, original, "AMB", candidates);
    }
    return new CorrectionResult(original, original, "ILL");
  }

  resolveAll(entries) {
    /*
     * Batch version of resolve for report generation.
     */
    return Array.from(entries, (entry) => this.resolve(entry));
  }
}


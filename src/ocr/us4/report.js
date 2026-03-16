import { writeLines } from "../ioUtils.js";
import { CorrectionResolver } from "./repair.js";

/*
 * Prepares US4 output by applying correction resolution to parsed entries.
 */

export class US4FindingsWriter {
  constructor(resolver = new CorrectionResolver()) {
    /*
     * Accept custom resolver for tests or alternate correction strategies.
     */
    this.resolver = resolver;
  }

  buildLines(entries) {
    /*
     * Map resolved results into final printable file lines.
     */
    /*
     * US4 emits corrected numbers when uniquely resolvable;
     * otherwise it keeps AMB/ILL status lines.
     */
    return this.resolver.resolveAll(entries).map((result) => result.line);
  }

  writeLines(entries, path) {
    /*
     * Persist US4 findings lines to output file.
     */
    return writeLines(path, this.buildLines(entries));
  }
}


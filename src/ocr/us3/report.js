import { writeLines } from "../ioUtils.js";
import { ChecksumValidator } from "../us2/validator.js";

/*
 * Builds US3 findings output with ERR/ILL status annotations.
 */

export class FindingsWriter {
  static statusFor(number) {
    /*
     * Resolve status tag for one policy number according to US3 rules.
     */
    /*
     * US3 status precedence:
     * unreadable digits => ILL, otherwise checksum failure => ERR.
     */
    if (number.includes("?")) {
      return "ILL";
    }
    if (!ChecksumValidator.isValid(number)) {
      return "ERR";
    }
    return null;
  }

  static formatLine(number) {
    /*
     * Append status token only when the number is not clean.
     */
    const status = FindingsWriter.statusFor(number);
    return status ? `${number} ${status}` : number;
  }

  static buildLines(numbers) {
    /*
     * Convert a batch of numbers into report-ready lines.
     */
    return Array.from(numbers, (number) => FindingsWriter.formatLine(number));
  }

  static writeLines(numbers, path) {
    /*
     * Materialize US3 lines to disk through shared IO helpers.
     */
    return writeLines(path, FindingsWriter.buildLines(numbers));
  }
}


import { ChecksumValidator } from "../us2/index.js";
import { FindingsWriter } from "../us3/index.js";
import { US4FindingsWriter } from "../us4/index.js";

/*
 * Reporting-stage strategies used by CLI orchestration.
 */

export class Us1ReportingStrategy {
  buildLines({ parsedNumbers }) {
    /*
     * US1 prints parsed numbers exactly as decoded.
     */
    return parsedNumbers;
  }
}

export class Us2ReportingStrategy {
  buildLines({ parsedNumbers }) {
    /*
     * US2 prints clean numbers and appends ERR when checksum fails.
     */
    return parsedNumbers.map((number) =>
      ChecksumValidator.isValid(number) ? number : `${number} ERR`
    );
  }
}

export class Us3ReportingStrategy {
  buildLines({ parsedNumbers }) {
    /*
     * US3 delegates ERR/ILL status formatting to FindingsWriter.
     */
    return FindingsWriter.buildLines(parsedNumbers);
  }
}

export class Us4ReportingStrategy {
  constructor(findingsWriter = new US4FindingsWriter()) {
    /*
     * Allow replacing the writer for tests or alternate implementations.
     */
    this.findingsWriter = findingsWriter;
  }

  buildLines({ parsedEntries }) {
    /*
     * US4 delegates repair and final line formatting to US4FindingsWriter.
     */
    return this.findingsWriter.buildLines(parsedEntries);
  }
}


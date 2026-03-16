import { PolicyFileParser } from "./parser.js";
import { writeLines } from "./ioUtils.js";
import { createReportingStage } from "./reporting/reportingStageFactory.js";

/*
 * Command-line orchestration for US1/US2/US3/US4 OCR flows.
 */

function parseArgs(argv) {
  /*
   * Parse supported CLI options and reject extra positional args.
   */
  const args = {
    story: "us1",
    input: null,
    out: null
  };

  /*
   * Expected shape:
   *   ocr-js <input> [--story us1|us2|us3|us4] [--out path]
   */
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--story") {
      args.story = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--out" || token === "-o") {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (!args.input) {
      args.input = token;
      continue;
    }
    throw new Error(`Unexpected argument: ${token}`);
  }

  return args;
}

export function main(argv = process.argv.slice(2)) {
  /*
   * Validate input, parse OCR entries, format by story, then print/write output.
   */
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(String(error.message));
    return 2;
  }

  if (!args.input) {
    console.error("Usage: ocr-js <input> [--story us1|us2|us3|us4] [--out path]");
    return 2;
  }

  let reportingStage;
  try {
    reportingStage = createReportingStage(args.story);
  } catch (error) {
    console.error(String(error.message));
    return 2;
  }

  let parsedEntries;
  try {
    parsedEntries = new PolicyFileParser(args.input).parsedEntries();
  } catch (error) {
    console.error(`Could not read input file '${args.input}': ${error.message}`);
    return 2;
  }

  const parsedNumbers = parsedEntries.map((entry) => entry.number);
  const lines = reportingStage.buildLines({ parsedEntries, parsedNumbers });

  if (args.out) {
    try {
      writeLines(args.out, lines);
    } catch (error) {
      console.error(`Could not write output file '${args.out}': ${error.message}`);
      return 2;
    }
    return 0;
  }

  lines.forEach((line) => {
    console.log(line);
  });
  return 0;
}


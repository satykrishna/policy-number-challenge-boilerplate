import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

/*
 * End-to-end and unit-style coverage for OCR parsing,
 * checksum validation, reporting, correction, and CLI behavior.
 */

import { DigitDecoder, PolicyFileParser } from "../src/ocr/index.js";
import { ChecksumValidator } from "../src/ocr/us2/index.js";
import { FindingsWriter } from "../src/ocr/us3/index.js";
import { CorrectionResolver, CorrectionResult, US4FindingsWriter } from "../src/ocr/us4/index.js";
import { DigitDecoder as Us1DigitDecoder, PolicyFileParser as Us1PolicyFileParser } from "../src/ocr/us1/index.js";
import { createReportingStage } from "../src/ocr/reporting/reportingStageFactory.js";
import { main } from "../src/ocr/cli.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES = join(__dirname, "fixtures");
const fixturePath = (story, ...parts) => join(FIXTURES, story, ...parts);

function cleanedLines(path) {
  /*
   * Normalize fixture files by removing trailing blank lines
   * so comparisons stay stable across environments.
   */
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function writeTempFile(lines) {
  const tempDir = mkdtempSync(join(tmpdir(), "ocr-js-fixture-"));
  const filePath = join(tempDir, "input.txt");
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
  return filePath;
}

test("DigitDecoder decodes canonical digits", () => {
  const decoder = new DigitDecoder();
  const cases = [
    [" _ | ||_|", "0"],
    ["     |  |", "1"],
    [" _  _||_ ", "2"],
    [" _  _| _|", "3"],
    ["   |_|  |", "4"],
    [" _ |_  _|", "5"],
    [" _ |_ |_|", "6"],
    [" _   |  |", "7"],
    [" _ |_||_|", "8"],
    [" _ |_| _|", "9"],
    ["XXXXXXXXX", "?"]
  ];

  cases.forEach(([chunk, expected]) => {
    assert.equal(decoder.decode(chunk), expected);
  });
});

test("US1 parser fixtures decode as expected", () => {
  assert.equal(typeof Us1DigitDecoder, "function");
  assert.equal(typeof Us1PolicyFileParser, "function");

  const us1FixtureOutput = new PolicyFileParser(fixturePath("us1", "us1_input_sample.txt")).parseDigits();
  assert.deepEqual(us1FixtureOutput, cleanedLines(fixturePath("us1", "us1_expected_output.txt")));
  assert.deepEqual(us1FixtureOutput, cleanedLines(fixturePath("us1", "us1_generated_output.txt")));

  const sample1 = new PolicyFileParser(fixturePath("us1", "us1_input_sample1.txt")).parseDigits();
  assert.equal(sample1[0], "000000000");
  assert.equal(sample1[1], "111111111");
  assert.equal(sample1[2], "123456789");

  const sample2 = new PolicyFileParser(fixturePath("us1", "us1_input_sample2.txt")).parseDigits();
  assert.deepEqual(sample2, [
    "000000000",
    "111111111",
    "222222222",
    "333333333",
    "444444444",
    "555555555",
    "666666666",
    "777777777",
    "888888888",
    "999999999"
  ]);

  const fixtureCases = [
    "us1_input_sample1",
    "us1_input_sample2",
    "us1_input_sample3"
  ];

  fixtureCases.forEach((baseName) => {
    const parsed = new PolicyFileParser(fixturePath("us1", `${baseName}.txt`)).parseDigits();
    assert.deepEqual(parsed, cleanedLines(fixturePath("us1", `${baseName}_expected_output.txt`)));
    assert.deepEqual(parsed, cleanedLines(fixturePath("us1", `${baseName}_generated_output.txt`)));
  });

  const us2Fixture = new PolicyFileParser(fixturePath("us2", "us2_input_sample1.txt")).parseDigits();
  assert.deepEqual(us2Fixture, cleanedLines(fixturePath("us2", "us2_input_sample1_expected_output.txt")));
  assert.deepEqual(us2Fixture, cleanedLines(fixturePath("us2", "us2_input_sample1_generated_output.txt")));
});

test("PolicyFileParser handles empty and uneven input groups", () => {
  const emptyPath = writeTempFile([]);
  assert.deepEqual(new PolicyFileParser(emptyPath).parseDigits(), []);

  const oneLinePath = writeTempFile([" _  _  _  _  _  _  _  _  _ "]);
  const parsed = new PolicyFileParser(oneLinePath).parseDigits();
  assert.deepEqual(parsed, ["?????????"]);
});

test("PolicyFileParser truncates long lines and skips blank entry groups", () => {
  const inputPath = writeTempFile([
    " ".repeat(40),
    " ".repeat(40),
    " ".repeat(40),
    "",
    " _  _  _  _  _  _  _  _  _  extra trailing text",
    "| || || || || || || || || |   extra trailing text",
    "|_||_||_||_||_||_||_||_||_|   extra trailing text",
    ""
  ]);

  const parsed = new PolicyFileParser(inputPath).parseDigits();
  assert.deepEqual(parsed, ["000000000"]);
});

test("ChecksumValidator honors reverse weighting", () => {
  assert.equal(ChecksumValidator.isValid("457508000"), true);
  assert.equal(ChecksumValidator.isValid("037333046"), true);
  assert.equal(ChecksumValidator.isValid("345882865"), true);
  assert.equal(ChecksumValidator.isValid("664371495"), false);
  assert.equal(ChecksumValidator.isValid("12345678?"), false);
  assert.equal(ChecksumValidator.isValid("12345678X"), false);

  const digits = Array.from("123456789", Number);
  const reversedTotal = digits
    .slice()
    .reverse()
    .reduce((sum, digit, index) => sum + (index + 1) * digit, 0);
  const naiveTotal = digits.reduce((sum, digit, index) => sum + (index + 1) * digit, 0);

  assert.equal(reversedTotal % 11, 0);
  assert.notEqual(naiveTotal % 11, 0);
});

test("US3 findings output matches fixture", () => {
  const numbers = new PolicyFileParser(fixturePath("us3", "us3_input_sample.txt")).parseDigits();
  const lines = FindingsWriter.buildLines(numbers);
  assert.deepEqual(lines, cleanedLines(fixturePath("us3", "us3_expected_output.txt")));

  assert.equal(FindingsWriter.statusFor("12345678?"), "ILL");
  assert.equal(FindingsWriter.statusFor("111111111"), "ERR");
  assert.equal(FindingsWriter.statusFor("457508000"), null);

  const tempDir = mkdtempSync(join(tmpdir(), "ocr-js-us3-"));
  const outFile = join(tempDir, "us3.txt");
  FindingsWriter.writeLines(numbers, outFile);
  assert.deepEqual(cleanedLines(outFile), cleanedLines(fixturePath("us3", "us3_expected_output.txt")));
});

test("US4 correction behavior matches fixture", () => {
  const entries = new PolicyFileParser(fixturePath("us4", "us4_input_sample.txt")).parsedEntries();
  const resolver = new CorrectionResolver();

  const cases = [
    { index: 0, resolved: "457508000", status: null },
    { index: 1, resolved: "037333046", status: null, expectQuestionMark: true },
    { index: 2, status: "AMB" },
    { index: 3, status: "ILL" }
  ];

  cases.forEach(({ index, resolved, status, expectQuestionMark }) => {
    const result = resolver.resolve(entries[index]);
    if (typeof resolved === "string") {
      assert.equal(result.resolved, resolved);
    }
    assert.equal(result.status, status);
    if (expectQuestionMark) {
      assert.equal(entries[index].number.includes("?"), true);
    }
  });

  const reportLines = new US4FindingsWriter().buildLines(entries);
  assert.deepEqual(reportLines, cleanedLines(fixturePath("us4", "us4_expected_output.txt")));

  const tempDir = mkdtempSync(join(tmpdir(), "ocr-js-us4-"));
  const outFile = join(tempDir, "us4.txt");
  new US4FindingsWriter().writeLines(entries, outFile);
  assert.deepEqual(cleanedLines(outFile), cleanedLines(fixturePath("us4", "us4_expected_output.txt")));
});

test("CorrectionResult formats line output", () => {
  assert.equal(new CorrectionResult("457508000", "457508000", null).line, "457508000");
  assert.equal(new CorrectionResult("037933046", "037933046", "AMB").line, "037933046 AMB");
  assert.equal(new CorrectionResult("087333046", "087333046", "ILL").line, "087333046 ILL");
});

test("CorrectionResolver single-segment checks cover invalid branches", () => {
  assert.equal(CorrectionResolver.isSingleSegmentChange(" _ | ||_|", " _ | ||_|"), false);
  assert.equal(CorrectionResolver.isSingleSegmentChange(" _ | ||_|", " _ |_| _|"), false);
  assert.equal(CorrectionResolver.isSingleSegmentChange("_", "|"), false);
  assert.equal(CorrectionResolver.isSingleSegmentChange("X", " "), false);
  assert.equal(CorrectionResolver.isSingleSegmentChange("X", "Y"), false);
});

test("CorrectionResolver validCandidates skips no-op replacements", () => {
  const resolver = new CorrectionResolver();
  const entry = {
    number: "111111111",
    chunks: ["     |  |"]
  };

  resolver.replacementDigitsForChunk = () => new Set(["1"]);
  assert.deepEqual(resolver.validCandidates(entry), []);
});

test("CLI returns code 2 for missing input", () => {
  const code = main(["does-not-exist.txt"]);
  assert.equal(code, 2);
});

test("CLI returns code 2 when no input is provided", () => {
  assert.equal(main([]), 2);
});

test("CLI rejects unsupported story and unexpected args", () => {
  assert.equal(main(["--story", "us9", fixturePath("us1", "us1_input_sample1.txt")]), 2);
  assert.equal(main([fixturePath("us1", "us1_input_sample1.txt"), "extra.txt"]), 2);
});

test("CLI returns code 2 when output file cannot be written", () => {
  const invalidOutputPath = join(tmpdir(), "ocr-js-out-dir-missing", "result.txt");
  const code = main([
    "--story",
    "us3",
    fixturePath("us3", "us3_input_sample.txt"),
    "--out",
    invalidOutputPath
  ]);
  assert.equal(code, 2);
});

test("Report strategy factory maps stories and rejects unknown keys", () => {
  const us1Lines = createReportingStage("us1").buildLines({
    parsedEntries: [],
    parsedNumbers: ["123456789"]
  });
  assert.deepEqual(us1Lines, ["123456789"]);

  const us2Lines = createReportingStage("us2").buildLines({
    parsedEntries: [],
    parsedNumbers: ["345882865", "111111111"]
  });
  assert.deepEqual(us2Lines, ["345882865", "111111111 ERR"]);

  const us3Lines = createReportingStage("us3").buildLines({
    parsedEntries: [],
    parsedNumbers: ["457508000", "12345678?"]
  });
  assert.deepEqual(us3Lines, ["457508000", "12345678? ILL"]);

  const us4Entries = new PolicyFileParser(fixturePath("us4", "us4_input_sample.txt")).parsedEntries();
  const us4Lines = createReportingStage("us4").buildLines({
    parsedEntries: us4Entries,
    parsedNumbers: us4Entries.map((entry) => entry.number)
  });
  assert.deepEqual(us4Lines, cleanedLines(fixturePath("us4", "us4_expected_output.txt")));

  assert.throws(() => createReportingStage("us9"), /Unsupported story 'us9'/);
});

test("CLI writes output files", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ocr-js-"));
  const outFile = join(tempDir, "us3.txt");

  const code = main([
    "--story",
    "us3",
    fixturePath("us3", "us3_input_sample.txt"),
    "--out",
    outFile
  ]);

  assert.equal(code, 0);
  assert.deepEqual(cleanedLines(outFile), cleanedLines(fixturePath("us3", "us3_expected_output.txt")));
});

test("CLI writes US1 parsed output to chosen file", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ocr-js-"));
  const outFile = join(tempDir, "us1.txt");

  const code = main([
    "--story",
    "us1",
    fixturePath("us1", "us1_input_sample1.txt"),
    "--out",
    outFile
  ]);

  assert.equal(code, 0);
  assert.deepEqual(cleanedLines(outFile), cleanedLines(fixturePath("us1", "us1_input_sample1_expected_output.txt")));
});

test("CLI prints to stdout when out is omitted", () => {
  const originalLog = console.log;
  const captured = [];
  console.log = (line) => captured.push(line);

  try {
    const code = main(["--story", "us1", fixturePath("us1", "us1_input_sample1.txt")]);
    assert.equal(code, 0);
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(captured, cleanedLines(fixturePath("us1", "us1_input_sample1_expected_output.txt")));
});

test("CLI writes US4 correction findings", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ocr-js-"));
  const outFile = join(tempDir, "us4.txt");

  const code = main([
    "--story",
    "us4",
    fixturePath("us4", "us4_input_sample.txt"),
    "--out",
    outFile
  ]);

  assert.equal(code, 0);
  assert.deepEqual(cleanedLines(outFile), cleanedLines(fixturePath("us4", "us4_expected_output.txt")));
});

test("CLI writes US2 checksum findings", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ocr-js-"));
  const outFile = join(tempDir, "us2.txt");

  const code = main([
    "--story",
    "us2",
    fixturePath("us2", "us2_input_sample.txt"),
    "--out",
    outFile
  ]);

  assert.equal(code, 0);
  assert.deepEqual(cleanedLines(outFile), cleanedLines(fixturePath("us2", "us2_expected_output.txt")));
  assert.deepEqual(cleanedLines(outFile), cleanedLines(fixturePath("us2", "us2_generated_output.txt")));
});



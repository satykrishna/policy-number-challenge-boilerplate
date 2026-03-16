import { writeFileSync } from "node:fs";

/*
 * Small IO helpers shared by CLI/report writers.
 */

export function writeLines(path, lines) {
  /*
   * Normalize incoming iterable into an array, then write one line per value.
   */
  const written = Array.from(lines);
  writeFileSync(path, `${written.join("\n")}\n`, "utf-8");
  return written;
}


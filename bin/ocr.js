#!/usr/bin/env node
/*
 * CLI entry file that forwards command-line arguments
 * to the OCR application main function.
 */
import { main } from "../src/ocr/cli.js";

/*
 * Run the command and expose its return code as process exit status.
 */
process.exitCode = main(process.argv.slice(2));


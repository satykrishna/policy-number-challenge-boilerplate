import {
  Us1ReportingStrategy,
  Us2ReportingStrategy,
  Us3ReportingStrategy,
  Us4ReportingStrategy
} from "./strategies.js";

/*
 * Factory that maps story identifiers to the reporting stage implementation.
 */

const REPORT_STAGE_BUILDERS = {
  us1: () => new Us1ReportingStrategy(),
  us2: () => new Us2ReportingStrategy(),
  us3: () => new Us3ReportingStrategy(),
  us4: () => new Us4ReportingStrategy()
};

export const SUPPORTED_REPORT_STAGES = Object.keys(REPORT_STAGE_BUILDERS);

export function createReportingStage(story) {
  /*
   * Create the reporting-stage strategy for the requested story key.
   */
  const buildStrategy = REPORT_STAGE_BUILDERS[story];
  if (!buildStrategy) {
    throw new Error(`Unsupported story '${story}'. Use ${SUPPORTED_REPORT_STAGES.join(", ")}.`);
  }
  return buildStrategy();
}



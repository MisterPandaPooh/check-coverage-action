import * as core from "@actions/core";
import { context } from "@actions/github";
import { postOrUpdateComment } from "./comment.js";
import { runCoverageChecks } from "./coverage.js";

async function run() {
  try {
    const coverageFile = core.getInput("coverage-file");
    const baseBranch = core.getInput("base-branch");
    const token = core.getInput("github-token");
    const minCoverageInput = core.getInput("min-coverage");
    const minCoverageNewCodeInput = core.getInput("min-coverage-new-code");

    core.info(`Debug - min-coverage input: "${minCoverageInput}"`);
    core.info(`Debug - min-coverage-new-code input: "${minCoverageNewCodeInput}"`);

    const minCoverage = minCoverageInput ? parseFloat(minCoverageInput) : null;
    const minCoverageNewCode = minCoverageNewCodeInput ? parseFloat(minCoverageNewCodeInput) : null;

    core.info(`Debug - parsed minCoverage: ${minCoverage}`);
    core.info(`Debug - parsed minCoverageNewCode: ${minCoverageNewCode}`);

    if (minCoverage === null && minCoverageNewCode === null) {
      core.warning(
        "No coverage checks enabled. Set min-coverage or min-coverage-new-code to enable checks."
      );
      return;
    }

    const results = runCoverageChecks(coverageFile, baseBranch, minCoverage, minCoverageNewCode);
    const hasFailed = results.some((r) => !r.passed);

    // Post comment if this is a PR
    const prNumber = context.payload.pull_request?.number;
    if (prNumber) {
      core.info("Posting coverage report as PR comment");
      await postOrUpdateComment(token, prNumber, results);
    } else {
      core.info("Not a PR - skipping comment");
    }

    if (hasFailed) {
      const failedChecks = results
        .filter((r) => !r.passed)
        .map((r) => r.type)
        .join(", ");
      core.setFailed(`❌ Coverage check(s) failed: ${failedChecks}`);
    } else {
      core.info("✅ All coverage checks passed");
    }
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();

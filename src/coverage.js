import * as core from "@actions/core";
import { execSync } from "child_process";

/**
 * Extracts total coverage percentage from a coverage file using appropriate tools
 * @param {string} coverageFile - Path to the coverage file (LCOV .info or XML format)
 * @returns {number|null} Coverage percentage (0-100) or null if extraction failed
 */
export function extractTotalCoverageWithTool(coverageFile) {
  try {
    // For LCOV files, use lcov --summary
    if (coverageFile.endsWith(".info")) {
      const output = execSync(`lcov --summary ${coverageFile}`, {
        encoding: "utf8",
        stderr: "pipe",
      });
      // Output format: "lines......: 85.5% (171 of 200 lines)"
      const match = output.match(/lines[.\s]+:\s+([0-9.]+)%/);
      if (match) {
        return parseFloat(match[1]);
      }
    } else {
      // For XML formats (Cobertura, JaCoCo), use coverage-report from diff-cover package
      const output = execSync(`coverage-report ${coverageFile}`, { encoding: "utf8" });
      // Output format: "Total coverage: 87.50%"
      const match = output.match(/Total[:\s]+([0-9.]+)%/);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return null;
  } catch (error) {
    core.error(`Error extracting total coverage: ${error.message}`);
    return null;
  }
}

/**
 * Checks coverage for new/changed code using diff-cover
 * @param {string} coverageFile - Path to the coverage file
 * @param {string} baseBranch - Base branch to compare against (e.g., "origin/main")
 * @param {number} minCoverageNewCode - Minimum required coverage percentage for new code
 * @returns {{type: string, coverage: number|null, minRequired: number, passed: boolean, output: string}}
 *          Result object with coverage check details and diff-cover output
 */
export function checkDiffCoverage(coverageFile, baseBranch, minCoverageNewCode) {
  core.info(`📦 Running diff-cover on ${coverageFile} vs ${baseBranch}`);

  // Fetch the base branch - fail if this doesn't work
  try {
    execSync(`git fetch origin ${baseBranch} --depth=1`, { stdio: "inherit" });
  } catch (error) {
    throw new Error(
      `Failed to fetch branch ${baseBranch}: ${error.message}. Make sure the branch exists and is accessible.`
    );
  }

  let diffOutput = "";
  let diffCoverage = null;

  try {
    // Run diff-cover (Python CLI) without fail-under to handle failure ourselves
    diffOutput = execSync(`diff-cover ${coverageFile} --compare-branch=${baseBranch}`, {
      encoding: "utf8",
    });
  } catch (error) {
    // diff-cover may throw if coverage is low, but we still want the output
    diffOutput = error.stdout || error.message;
  }

  // Extract coverage percentage from diff-cover output
  const match = diffOutput.match(/Diff Coverage:\s+([0-9.]+)%/);
  diffCoverage = match ? parseFloat(match[1]) : null;

  const passed = diffCoverage !== null && diffCoverage >= minCoverageNewCode;

  return {
    type: "new-code",
    coverage: diffCoverage,
    minRequired: minCoverageNewCode,
    passed,
    output: diffOutput,
  };
}

/**
 * Checks overall project coverage from a coverage file
 * @param {string} coverageFile - Path to the coverage file (LCOV or XML)
 * @param {number} minCoverage - Minimum required overall coverage percentage
 * @returns {{type: string, coverage: number|null, minRequired: number, passed: boolean}}
 *          Result object with coverage check details
 */
export function checkOverallCoverage(coverageFile, minCoverage) {
  core.info(`📊 Checking overall coverage from ${coverageFile}`);
  const coverage = extractTotalCoverageWithTool(coverageFile);
  const passed = coverage !== null && coverage >= minCoverage;

  return {
    type: "overall",
    coverage,
    minRequired: minCoverage,
    passed,
  };
}

/**
 * Runs all configured coverage checks (overall and/or new code)
 * @param {string} coverageFile - Path to the coverage file
 * @param {string} baseBranch - Base branch for diff comparison
 * @param {number|null} minCoverage - Minimum overall coverage (null to skip this check)
 * @param {number|null} minCoverageNewCode - Minimum new code coverage (null to skip this check)
 * @returns {Array<{type: string, coverage: number|null, minRequired: number, passed: boolean, output?: string}>}
 *          Array of result objects for each enabled check
 */
export function runCoverageChecks(coverageFile, baseBranch, minCoverage, minCoverageNewCode) {
  const results = [];

  if (minCoverageNewCode !== null) {
    results.push(checkDiffCoverage(coverageFile, baseBranch, minCoverageNewCode));
  }

  if (minCoverage !== null) {
    results.push(checkOverallCoverage(coverageFile, minCoverage));
  }

  return results;
}

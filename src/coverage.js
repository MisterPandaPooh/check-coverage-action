import * as core from "@actions/core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const NO_LINES_MESSAGE = "No lines with coverage information in this diff";

function round2(value) {
  return Math.round(value * 100) / 100;
}

function percent(covered, total) {
  return total > 0 ? round2((covered / total) * 100) : null;
}

/**
 * Sums line coverage over every record of an LCOV tracefile
 * @param {string} text - LCOV file content
 * @returns {{covered: number, total: number, percent: number|null}}
 */
export function parseLcovTotal(text) {
  let covered = 0;
  let total = 0;
  // Per record: prefer LF/LH, fall back to counting DA lines
  let recordHasSummary = false;
  let daCovered = 0;
  let daTotal = 0;

  const flushRecord = () => {
    if (!recordHasSummary) {
      covered += daCovered;
      total += daTotal;
    }
    recordHasSummary = false;
    daCovered = 0;
    daTotal = 0;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("LF:")) {
      total += parseInt(line.slice(3), 10) || 0;
      recordHasSummary = true;
    } else if (line.startsWith("LH:")) {
      covered += parseInt(line.slice(3), 10) || 0;
      recordHasSummary = true;
    } else if (line.startsWith("DA:")) {
      const hits = parseInt(line.slice(3).split(",")[1], 10) || 0;
      daTotal += 1;
      if (hits > 0) daCovered += 1;
    } else if (line === "end_of_record") {
      flushRecord();
    }
  }
  flushRecord();

  return { covered, total, percent: percent(covered, total) };
}

function readAttr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/**
 * Extracts total line coverage from a Cobertura or JaCoCo XML report
 * @param {string} text - XML file content
 * @returns {number|null} Coverage percentage (0-100) or null when not recognised
 */
export function parseXmlTotal(text) {
  // Cobertura: <coverage line-rate="0.81" lines-covered="13" lines-valid="16">
  const coverageTag = text.match(/<coverage\b[^>]*>/);
  if (coverageTag) {
    const linesCovered = readAttr(coverageTag[0], "lines-covered");
    const linesValid = readAttr(coverageTag[0], "lines-valid");
    if (linesCovered !== null && linesValid !== null) {
      return percent(parseInt(linesCovered, 10), parseInt(linesValid, 10));
    }
    const lineRate = readAttr(coverageTag[0], "line-rate");
    if (lineRate !== null) return round2(parseFloat(lineRate) * 100);
    return null;
  }

  // JaCoCo: the report-level <counter type="LINE"> is the last one in the document
  if (/<report\b/.test(text)) {
    const counters = [...text.matchAll(/<counter\b[^>]*type="LINE"[^>]*\/?>/g)];
    const last = counters.at(-1);
    if (last) {
      const missed = parseInt(readAttr(last[0], "missed"), 10) || 0;
      const covered = parseInt(readAttr(last[0], "covered"), 10) || 0;
      return percent(covered, missed + covered);
    }
  }

  return null;
}

/**
 * Reads total coverage from an LCOV or XML (Cobertura/JaCoCo) file, detected by content
 * @param {string} coverageFile - Path to the coverage file
 * @returns {number|null} Coverage percentage (0-100) or null if it could not be read
 */
export function readTotalCoverage(coverageFile) {
  let text;
  try {
    text = readFileSync(coverageFile, "utf8");
  } catch (error) {
    core.error(`Cannot read coverage file ${coverageFile}: ${error.message}`);
    return null;
  }

  const result = text.trimStart().startsWith("<")
    ? parseXmlTotal(text)
    : parseLcovTotal(text).percent;
  if (result === null) {
    core.error(`Could not extract a line coverage total from ${coverageFile}`);
  }
  return result;
}

/**
 * Splits a base-branch input into remote, branch and the ref diff-cover should use
 * @param {string} baseBranch - "main" or "origin/main"
 * @returns {{remote: string, branch: string, ref: string}}
 */
export function normalizeBaseBranch(baseBranch) {
  const value = (baseBranch ?? "").trim();
  if (!value) throw new Error("base-branch input must not be empty");
  const branch = value.startsWith("origin/") ? value.slice("origin/".length) : value;
  return { remote: "origin", branch, ref: `origin/${branch}` };
}

/**
 * Parses the console output of diff-cover
 * @param {string} output
 * @returns {{coverage: number|null, noLines: boolean}}
 */
export function parseDiffCoverOutput(output) {
  if (output.includes(NO_LINES_MESSAGE)) return { coverage: null, noLines: true };

  // diff-cover >= 9 prints "Total: N lines / Missing: M lines" and a rounded "Coverage: X%"
  const total = output.match(/^Total:\s+(\d+)\s+lines?/m);
  const missing = output.match(/^Missing:\s+(\d+)\s+lines?/m);
  if (total && missing) {
    const totalLines = parseInt(total[1], 10);
    if (totalLines > 0) {
      return {
        coverage: percent(totalLines - parseInt(missing[1], 10), totalLines),
        noLines: false,
      };
    }
  }

  const match = output.match(/^(?:Diff )?Coverage:\s+([0-9.]+)%/m);
  return { coverage: match ? parseFloat(match[1]) : null, noLines: false };
}

function defaultExec(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function quote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Checks coverage for new/changed code using diff-cover
 * @param {string} coverageFile - Path to the coverage file
 * @param {string} baseBranch - Base branch to compare against ("main" or "origin/main")
 * @param {number} minCoverageNewCode - Minimum required coverage percentage for new code
 * @param {{exec?: (command: string) => string}} [options] - exec override, used by tests
 * @returns {{type: string, coverage: number|null, minRequired: number, passed: boolean, skipped: boolean, output: string}}
 */
export function checkDiffCoverage(coverageFile, baseBranch, minCoverageNewCode, options = {}) {
  const exec = options.exec ?? defaultExec;
  const { remote, branch, ref } = normalizeBaseBranch(baseBranch);
  core.info(`📦 Running diff-cover on ${coverageFile} vs ${ref}`);

  // Fetch into refs/remotes so diff-cover can resolve "origin/<branch>" whatever the checkout did
  try {
    exec(`git fetch --no-tags ${remote} +refs/heads/${branch}:refs/remotes/${remote}/${branch}`);
  } catch (error) {
    throw new Error(
      `Failed to fetch branch ${branch} from ${remote}: ${error.message}. ` +
        "Make sure the branch exists and that actions/checkout used fetch-depth: 0."
    );
  }

  let output = "";
  try {
    output = exec(`diff-cover ${quote(coverageFile)} --compare-branch=${ref}`);
  } catch (error) {
    // diff-cover exits non-zero on low coverage but still prints the report
    output = error.stdout || error.message;
  }
  core.info(`diff-cover output\n\n${output}`);

  const { coverage, noLines } = parseDiffCoverOutput(output);
  if (noLines) {
    core.info("No lines with coverage information in the diff - check skipped");
  }

  return {
    type: "new-code",
    coverage,
    minRequired: minCoverageNewCode,
    passed: noLines || (coverage !== null && coverage >= minCoverageNewCode),
    skipped: noLines,
    output,
  };
}

/**
 * Checks overall project coverage from a coverage file
 * @param {string} coverageFile - Path to the coverage file (LCOV or XML)
 * @param {number} minCoverage - Minimum required overall coverage percentage
 * @returns {{type: string, coverage: number|null, minRequired: number, passed: boolean, skipped: boolean}}
 */
export function checkOverallCoverage(coverageFile, minCoverage) {
  core.info(`📊 Checking overall coverage from ${coverageFile}`);
  const coverage = readTotalCoverage(coverageFile);

  return {
    type: "overall",
    coverage,
    minRequired: minCoverage,
    passed: coverage !== null && coverage >= minCoverage,
    skipped: false,
  };
}

/**
 * Runs all configured coverage checks (overall and/or new code)
 * @param {string} coverageFile - Path to the coverage file
 * @param {string} baseBranch - Base branch for diff comparison
 * @param {number|null} minCoverage - Minimum overall coverage (null to skip this check)
 * @param {number|null} minCoverageNewCode - Minimum new code coverage (null to skip this check)
 * @param {{exec?: (command: string) => string}} [options] - exec override, used by tests
 * @returns {Array<{type: string, coverage: number|null, minRequired: number, passed: boolean, skipped: boolean, output?: string}>}
 */
export function runCoverageChecks(
  coverageFile,
  baseBranch,
  minCoverage,
  minCoverageNewCode,
  options = {}
) {
  const results = [];

  if (minCoverageNewCode !== null) {
    results.push(checkDiffCoverage(coverageFile, baseBranch, minCoverageNewCode, options));
  }

  if (minCoverage !== null) {
    results.push(checkOverallCoverage(coverageFile, minCoverage));
  }

  return results;
}

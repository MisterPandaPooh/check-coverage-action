import * as core from "@actions/core";
import { context } from "@actions/github";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { postOrUpdateComment } from "./comment.js";
import { runCoverageChecks } from "./coverage.js";

function parseThreshold(name) {
  const raw = core.getInput(name).trim();
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a number between 0 and 100, got "${raw}"`);
  }
  return value;
}

// Severity when a check misses its threshold: "fail" (alias "error") or "warn" (alias "warning")
const MODES = { fail: "fail", error: "fail", warn: "warn", warning: "warn" };

function parseMode(name) {
  const raw = core.getInput(name).trim().toLowerCase() || "fail";
  const mode = MODES[raw];
  if (!mode) throw new Error(`${name} must be "fail" or "warn", got "${raw}"`);
  return mode;
}

async function run() {
  try {
    // The action runs from the caller's workspace so relative paths and git commands apply to it
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    process.chdir(workspace);

    const coverageFile = resolve(workspace, core.getInput("coverage-file", { required: true }));
    const baseBranch = core.getInput("base-branch") || "origin/main";
    const token = core.getInput("github-token", { required: true });
    const minCoverage = parseThreshold("min-coverage");
    const minCoverageNewCode = parseThreshold("min-coverage-new-code");
    const overallMode = parseMode("min-coverage-mode");
    const newCodeMode = parseMode("min-coverage-new-code-mode");

    core.info(`coverage-file: ${coverageFile}`);
    core.info(`min-coverage: ${minCoverage ?? "disabled"} (${overallMode})`);
    core.info(`min-coverage-new-code: ${minCoverageNewCode ?? "disabled"} (${newCodeMode})`);

    if (minCoverage === null && minCoverageNewCode === null) {
      core.warning(
        "No coverage checks enabled. Set min-coverage or min-coverage-new-code to enable checks."
      );
      return;
    }

    if (!existsSync(coverageFile)) {
      throw new Error(`Coverage file not found: ${coverageFile}`);
    }

    const results = runCoverageChecks(coverageFile, baseBranch, minCoverage, minCoverageNewCode, {
      overallMode,
      newCodeMode,
    });
    const describe = (r) => {
      const coverage = r.coverage !== null ? `${r.coverage.toFixed(2)}%` : "unknown";
      return `${r.type} (current: ${coverage}, expected: ${r.minRequired}%)`;
    };

    // Warn-mode checks below their threshold are reported but never fail the job
    const warned = results.filter((r) => !r.passed && r.mode === "warn");
    for (const r of warned) {
      core.warning(`⚠️ Coverage below threshold: ${describe(r)}`);
    }
    const failed = results.filter((r) => !r.passed && r.mode !== "warn");

    // Post comment if this is a PR
    const prNumber = context.payload.pull_request?.number;
    if (prNumber) {
      core.info("Posting coverage report as PR comment");
      try {
        await postOrUpdateComment(token, prNumber, results);
      } catch (error) {
        // A read-only token (fork PR) must not hide the coverage verdict itself
        core.warning(`Could not post the PR comment: ${error.message}`);
      }
    } else {
      core.info("Not a PR - skipping comment");
    }

    if (failed.length > 0) {
      core.setFailed(`❌ Coverage check(s) failed: ${failed.map(describe).join(", ")}`);
    } else if (warned.length > 0) {
      core.info(`✅ Coverage checks passed with ${warned.length} warning(s)`);
    } else {
      core.info("✅ All coverage checks passed");
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

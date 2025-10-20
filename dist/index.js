// src/index.js
import * as core2 from "@actions/core";
import { context as context2 } from "@actions/github";

// src/comment.js
import { context, getOctokit } from "@actions/github";
var COMMENT_IDENTIFIER = "<!-- coverage-action-comment -->";
function getBadge(label, message, color) {
  const encodedMessage = message.replace(/%/g, "%25");
  return `![${label}: ${message}](https://img.shields.io/badge/${label}-${encodedMessage}-${color})`;
}
function getCoverageColor(coverage, minRequired) {
  if (coverage >= minRequired) {
    if (coverage >= 90) return "brightgreen";
    if (coverage >= 80) return "green";
    if (coverage >= 70) return "yellowgreen";
    return "yellow";
  }
  return coverage >= 50 ? "orange" : "red";
}
function formatCoverage(coverage) {
  return coverage !== null ? coverage.toFixed(2) : "?";
}
function buildTableRow(icon, label, result) {
  const coverageStr = formatCoverage(result.coverage);
  const coverageBadge = result.coverage !== null ? getBadge(
    "coverage",
    `${coverageStr}%`,
    getCoverageColor(result.coverage, result.minRequired)
  ) : getBadge("coverage", "unknown", "lightgrey");
  const diff = result.coverage !== null ? result.coverage - result.minRequired : null;
  const diffBadge = diff !== null ? getBadge(
    "diff",
    `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`,
    diff >= 0 ? "brightgreen" : "red"
  ) : "";
  const statusBadge = getBadge(
    "status",
    result.passed ? "passing" : "failing",
    result.passed ? "brightgreen" : "red"
  );
  return `| **${icon} ${label}** | ${coverageBadge} ${diffBadge} | ${result.minRequired}% | ${statusBadge} |
`;
}
function buildCommentBody(results) {
  const overallCheck = results.find((r) => r.type === "overall");
  const newCodeCheck = results.find((r) => r.type === "new-code");
  let body = `${COMMENT_IDENTIFIER}
## \u{1F4CA} Coverage Report

`;
  body += "| Type | Coverage | Required | Status |\n";
  body += "|------|----------|----------|--------|\n";
  if (overallCheck) {
    body += buildTableRow("\u{1F4E6}", "Overall Project", overallCheck);
  }
  if (newCodeCheck) {
    body += buildTableRow("\u{1F195}", "New Code (Diff)", newCodeCheck);
  }
  body += "\n";
  if (newCodeCheck?.output) {
    body += `<details>
<summary>\u{1F4CB} View detailed diff-cover report</summary>

`;
    body += `\`\`\`
${newCodeCheck.output.trim()}
\`\`\`
</details>

`;
  }
  const allPassed = results.every((r) => r.passed);
  const status = allPassed ? "Passing" : "Failing";
  const color = allPassed ? "brightgreen" : "red";
  body += `---
![Overall: ${status}](https://img.shields.io/badge/Overall-${status}-${color}?style=for-the-badge)`;
  return body;
}
async function findExistingComment(octokit, owner, repo, issueNumber) {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber
  });
  return comments.find((c) => c.body && c.body.includes(COMMENT_IDENTIFIER));
}
async function postOrUpdateComment(token, prNumber, results) {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;
  const body = buildCommentBody(results);
  const existingComment = await findExistingComment(octokit, owner, repo, prNumber);
  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });
  }
}

// src/coverage.js
import * as core from "@actions/core";
import { execSync } from "child_process";
function extractTotalCoverageWithTool(coverageFile) {
  try {
    core.info(`extractTotalCoverageWithTool ${coverageFile}`);
    if (coverageFile.endsWith(".info")) {
      const output = execSync(`lcov --summary ${coverageFile} 2>&1`, {
        encoding: "utf8"
      });
      core.info("=== LCOV Summary Output ===");
      const lines = output.split("\n").filter((line) => line.trim());
      lines.forEach((line) => core.info(line));
      core.info("=== End LCOV Summary ===");
      const match = output.match(/lines[.\s]+:\s+([0-9.]+)%/);
      if (match) {
        return parseFloat(match[1]);
      }
      core.info(`lcov output 

 ${output}`);
    } else {
      const output = execSync(`coverage-report ${coverageFile}`, { encoding: "utf8" });
      core.info("=== Coverage Report Output ===");
      const lines = output.split("\n").filter((line) => line.trim());
      lines.forEach((line) => core.info(line));
      core.info("=== End Coverage Report ===");
      const match = output.match(/Total[:\s]+([0-9.]+)%/);
      if (match) {
        return parseFloat(match[1]);
      }
      core.info(`coverage-report(xml) 

 ${output}`);
    }
    return null;
  } catch (error3) {
    core.error(`Error extracting total coverage: ${error3.message}`);
    return null;
  }
}
function checkDiffCoverage(coverageFile, baseBranch, minCoverageNewCode) {
  core.info(`\u{1F4E6} Running diff-cover on ${coverageFile} vs ${baseBranch}`);
  const compareBranch = baseBranch.startsWith("origin/") ? baseBranch : `origin/${baseBranch}`;
  const branchName = baseBranch.replace("origin/", "");
  try {
    execSync(`git fetch origin ${branchName}:refs/remotes/origin/${branchName} --depth=1`, {
      stdio: "inherit"
    });
  } catch (error3) {
    throw new Error(
      `Failed to fetch branch ${branchName}: ${error3.message}. Make sure the branch exists and is accessible.`
    );
  }
  let diffOutput = "";
  let diffCoverage = null;
  let passed = false;
  try {
    diffOutput = execSync(`diff-cover ${coverageFile} --compare-branch=${compareBranch}`, {
      encoding: "utf8"
    });
  } catch (error3) {
    diffOutput = error3.stdout || error3.message;
  }
  if (diffOutput.includes("No lines with coverage information in this diff")) {
    core.info("No lines with coverage information found in the diff - considering this as passing");
    diffCoverage = 100;
    passed = true;
  } else {
    const match = diffOutput.match(/Diff Coverage:\s+([0-9.]+)%/);
    diffCoverage = match ? parseFloat(match[1]) : null;
    passed = diffCoverage !== null && diffCoverage >= minCoverageNewCode;
  }
  core.info(`diff-cover output 

 ${diffOutput}`);
  return {
    type: "new-code",
    coverage: diffCoverage,
    minRequired: minCoverageNewCode,
    passed,
    output: diffOutput
  };
}
function checkOverallCoverage(coverageFile, minCoverage) {
  core.info(`\u{1F4CA} Checking overall coverage from ${coverageFile}`);
  const coverage = extractTotalCoverageWithTool(coverageFile);
  const passed = coverage !== null && coverage >= minCoverage;
  return {
    type: "overall",
    coverage,
    minRequired: minCoverage,
    passed
  };
}
function runCoverageChecks(coverageFile, baseBranch, minCoverage, minCoverageNewCode) {
  const results = [];
  if (minCoverageNewCode !== null) {
    results.push(checkDiffCoverage(coverageFile, baseBranch, minCoverageNewCode));
  }
  if (minCoverage !== null) {
    results.push(checkOverallCoverage(coverageFile, minCoverage));
  }
  return results;
}

// src/index.js
async function run() {
  try {
    const coverageFile = core2.getInput("coverage-file");
    const baseBranch = core2.getInput("base-branch");
    const token = core2.getInput("github-token");
    const minCoverageInput = core2.getInput("min-coverage");
    const minCoverageNewCodeInput = core2.getInput("min-coverage-new-code");
    core2.info(`Debug - min-coverage input: "${minCoverageInput}"`);
    core2.info(`Debug - min-coverage-new-code input: "${minCoverageNewCodeInput}"`);
    const minCoverage = minCoverageInput ? parseFloat(minCoverageInput) : null;
    const minCoverageNewCode = minCoverageNewCodeInput ? parseFloat(minCoverageNewCodeInput) : null;
    core2.info(`Debug - parsed minCoverage: ${minCoverage}`);
    core2.info(`Debug - parsed minCoverageNewCode: ${minCoverageNewCode}`);
    if (minCoverage === null && minCoverageNewCode === null) {
      core2.warning(
        "No coverage checks enabled. Set min-coverage or min-coverage-new-code to enable checks."
      );
      return;
    }
    const results = runCoverageChecks(coverageFile, baseBranch, minCoverage, minCoverageNewCode);
    const hasFailed = results.some((r) => !r.passed);
    const prNumber = context2.payload.pull_request?.number;
    if (prNumber) {
      core2.info("Posting coverage report as PR comment");
      await postOrUpdateComment(token, prNumber, results);
    } else {
      core2.info("Not a PR - skipping comment");
    }
    if (hasFailed) {
      const failedChecks = results.filter((r) => !r.passed).map((r) => {
        const coverage = r.coverage !== null ? `${r.coverage.toFixed(2)}%` : "unknown";
        return `${r.type} (current: ${coverage}, expected: ${r.minRequired}%)`;
      }).join(", ");
      core2.setFailed(`\u274C Coverage check(s) failed: ${failedChecks}`);
    } else {
      core2.info("\u2705 All coverage checks passed");
    }
  } catch (error3) {
    core2.error(error3);
    core2.setFailed(error3.message);
  }
}
run();

import { context, getOctokit } from "@actions/github";

// Unique identifier to find our comment among others
const COMMENT_IDENTIFIER = "<!-- coverage-action-comment -->";

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
  const coverageBadge =
    result.coverage !== null
      ? getBadge(
          "coverage",
          `${coverageStr}%`,
          getCoverageColor(result.coverage, result.minRequired)
        )
      : getBadge("coverage", "unknown", "lightgrey");

  const diff = result.coverage !== null ? result.coverage - result.minRequired : null;
  const diffBadge =
    diff !== null
      ? getBadge(
          "diff",
          `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`,
          diff >= 0 ? "brightgreen" : "red"
        )
      : "";

  const statusBadge = getBadge(
    "status",
    result.passed ? "passing" : "failing",
    result.passed ? "brightgreen" : "red"
  );

  return `| **${icon} ${label}** | ${coverageBadge} ${diffBadge} | ${result.minRequired}% | ${statusBadge} |\n`;
}

/**
 * Builds the markdown body for the coverage report comment
 * @param {Array<{type: string, coverage: number|null, minRequired: number, passed: boolean, output?: string}>} results
 *        Array of coverage check results
 * @returns {string} Formatted markdown comment body with coverage report and badges
 */
export function buildCommentBody(results) {
  const overallCheck = results.find((r) => r.type === "overall");
  const newCodeCheck = results.find((r) => r.type === "new-code");

  let body = `${COMMENT_IDENTIFIER}\n## 📊 Coverage Report\n\n`;
  body += "| Type | Coverage | Required | Status |\n";
  body += "|------|----------|----------|--------|\n";

  if (overallCheck) {
    body += buildTableRow("📦", "Overall Project", overallCheck);
  }

  if (newCodeCheck) {
    body += buildTableRow("🆕", "New Code (Diff)", newCodeCheck);
  }

  body += "\n";

  if (newCodeCheck?.output) {
    body += `<details>\n<summary>📋 View detailed diff-cover report</summary>\n\n`;
    body += `\`\`\`\n${newCodeCheck.output.trim()}\n\`\`\`\n</details>\n\n`;
  }

  const allPassed = results.every((r) => r.passed);
  const status = allPassed ? "Passing" : "Failing";
  const color = allPassed ? "brightgreen" : "red";
  body += `---\n![Overall: ${status}](https://img.shields.io/badge/Overall-${status}-${color}?style=for-the-badge)`;

  return body;
}

async function findExistingComment(octokit, owner, repo, issueNumber) {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return comments.find((c) => c.body && c.body.includes(COMMENT_IDENTIFIER));
}

/**
 * Posts a new coverage report comment or updates an existing one on a pull request
 * @param {string} token - GitHub token for authentication
 * @param {number} prNumber - Pull request number
 * @param {Array<{type: string, coverage: number|null, minRequired: number, passed: boolean, output?: string}>} results
 *        Array of coverage check results
 * @returns {Promise<void>}
 */
export async function postOrUpdateComment(token, prNumber, results) {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;
  const body = buildCommentBody(results);

  const existingComment = await findExistingComment(octokit, owner, repo, prNumber);

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

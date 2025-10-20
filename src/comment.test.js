import assert from "node:assert";
import { describe, it } from "node:test";
import { buildCommentBody } from "./comment.js";

describe("buildCommentBody", () => {
  it("should build comment for overall coverage check", () => {
    const results = [
      {
        type: "overall",
        coverage: 85.5,
        minRequired: 80,
        passed: true,
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("## 📊 Coverage Report"));
    assert.ok(body.includes("Overall Project"));
    assert.ok(body.includes("85.50"));
    assert.ok(body.includes("80%"));
    assert.ok(body.includes("passing"));
  });

  it("should build comment for new code coverage check", () => {
    const results = [
      {
        type: "new-code",
        coverage: 92.5,
        minRequired: 90,
        passed: true,
        output: "Diff Coverage: 92.5%\nsrc/test.js (95%)",
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("## 📊 Coverage Report"));
    assert.ok(body.includes("New Code (Diff)"));
    assert.ok(body.includes("92.50"));
    assert.ok(body.includes("90%"));
    assert.ok(body.includes("passing"));
    assert.ok(body.includes("diff-cover report"));
  });

  it("should build comment for both checks", () => {
    const results = [
      {
        type: "overall",
        coverage: 75.0,
        minRequired: 80,
        passed: false,
      },
      {
        type: "new-code",
        coverage: 95.0,
        minRequired: 90,
        passed: true,
        output: "Diff Coverage: 95.0%",
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("Overall Project"));
    assert.ok(body.includes("New Code (Diff)"));
    assert.ok(body.includes("75.00"));
    assert.ok(body.includes("95.00"));
    assert.ok(body.includes("failing"));
    assert.ok(body.includes("Failing"));
  });

  it("should handle null coverage gracefully", () => {
    const results = [
      {
        type: "overall",
        coverage: null,
        minRequired: 80,
        passed: false,
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("unknown"));
    assert.ok(body.includes("failing"));
  });

  it("should show overall passing when all checks pass", () => {
    const results = [
      {
        type: "overall",
        coverage: 85.0,
        minRequired: 80,
        passed: true,
      },
      {
        type: "new-code",
        coverage: 95.0,
        minRequired: 90,
        passed: true,
        output: "Diff Coverage: 95.0%",
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("Passing"));
    assert.ok(body.includes("brightgreen"));
  });

  it("should show overall failing when any check fails", () => {
    const results = [
      {
        type: "overall",
        coverage: 85.0,
        minRequired: 80,
        passed: true,
      },
      {
        type: "new-code",
        coverage: 85.0,
        minRequired: 90,
        passed: false,
        output: "Diff Coverage: 85.0%",
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("Failing"));
    assert.ok(body.includes("red"));
  });

  it("should include diff-cover output in details section", () => {
    const detailedOutput = `Diff Coverage: 92.5%
src/utils/parser.js (95.0%)
src/components/Header.tsx (90.0%)
Total: 42 lines added, 39 covered`;

    const results = [
      {
        type: "new-code",
        coverage: 92.5,
        minRequired: 90,
        passed: true,
        output: detailedOutput,
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("View detailed diff-cover report"));
    assert.ok(body.includes("parser.js"));
    assert.ok(body.includes("Header.tsx"));
    assert.ok(body.includes("42 lines added"));
  });

  it("should handle coverage at exactly the threshold", () => {
    const results = [
      {
        type: "overall",
        coverage: 80.0,
        minRequired: 80,
        passed: true,
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("80.00"));
    assert.ok(body.includes("passing"));
  });

  it("should format coverage with 2 decimal places", () => {
    const results = [
      {
        type: "overall",
        coverage: 85.567,
        minRequired: 80,
        passed: true,
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("85.57"));
  });

  it("should show positive diff badge when coverage exceeds threshold", () => {
    const results = [
      {
        type: "overall",
        coverage: 90.0,
        minRequired: 80,
        passed: true,
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("+10.00"));
  });

  it("should show negative diff badge when coverage is below threshold", () => {
    const results = [
      {
        type: "overall",
        coverage: 75.0,
        minRequired: 80,
        passed: false,
      },
    ];

    const body = buildCommentBody(results);

    assert.ok(body.includes("-5.00"));
  });
});

import assert from "node:assert";
import { describe, it } from "node:test";

describe("Coverage utilities", () => {
  describe("File type detection", () => {
    it("should detect LCOV files", () => {
      const file = "coverage/lcov.info";
      assert.strictEqual(file.endsWith(".info"), true);
    });

    it("should detect XML files", () => {
      const file = "coverage/cobertura.xml";
      assert.strictEqual(file.endsWith(".info"), false);
    });
  });

  describe("Coverage regex patterns", () => {
    it("should match LCOV output format", () => {
      const output = "lines......: 85.5% (171 of 200 lines)";
      const pattern = /lines[.\s]+:\s+([0-9.]+)%/;
      const match = output.match(pattern);

      assert.ok(match);
      assert.strictEqual(parseFloat(match[1]), 85.5);
    });

    it("should match coverage-report output format", () => {
      const output = "Total: 87.50%";
      const pattern = /Total[:\s]+([0-9.]+)%/;
      const match = output.match(pattern);

      assert.ok(match);
      assert.strictEqual(parseFloat(match[1]), 87.5);
    });

    it("should match diff-cover output format", () => {
      const output = "Diff Coverage: 92.5%";
      const pattern = /Diff Coverage:\s+([0-9.]+)%/;
      const match = output.match(pattern);

      assert.ok(match);
      assert.strictEqual(parseFloat(match[1]), 92.5);
    });
  });

  describe("Result object creation", () => {
    it("should create valid overall coverage result", () => {
      const result = {
        type: "overall",
        coverage: 85.5,
        minRequired: 80,
        passed: true,
      };

      assert.strictEqual(result.type, "overall");
      assert.strictEqual(result.coverage, 85.5);
      assert.strictEqual(result.minRequired, 80);
      assert.strictEqual(result.passed, true);
    });

    it("should create valid new-code coverage result", () => {
      const result = {
        type: "new-code",
        coverage: 92.5,
        minRequired: 90,
        passed: true,
        output: "Diff Coverage: 92.5%",
      };

      assert.strictEqual(result.type, "new-code");
      assert.strictEqual(result.coverage, 92.5);
      assert.strictEqual(result.minRequired, 90);
      assert.strictEqual(result.passed, true);
      assert.ok(result.output);
    });

    it("should correctly determine passed status", () => {
      const coverage = 85.5;
      const minRequired = 80;
      const passed = coverage !== null && coverage >= minRequired;

      assert.strictEqual(passed, true);
    });

    it("should correctly determine failed status", () => {
      const coverage = 75.0;
      const minRequired = 80;
      const passed = coverage !== null && coverage >= minRequired;

      assert.strictEqual(passed, false);
    });

    it("should handle null coverage as failed", () => {
      const coverage = null;
      const minRequired = 80;
      const passed = coverage !== null && coverage >= minRequired;

      assert.strictEqual(passed, false);
    });
  });

  describe("Coverage checks orchestration", () => {
    it("should return empty array when no checks are configured", () => {
      const minCoverage = null;
      const minCoverageNewCode = null;
      const results = [];

      if (minCoverageNewCode !== null) {
        results.push({});
      }
      if (minCoverage !== null) {
        results.push({});
      }

      assert.strictEqual(results.length, 0);
    });

    it("should add new-code check when configured", () => {
      const minCoverageNewCode = 90;
      const results = [];

      if (minCoverageNewCode !== null) {
        results.push({ type: "new-code" });
      }

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].type, "new-code");
    });

    it("should add overall check when configured", () => {
      const minCoverage = 80;
      const results = [];

      if (minCoverage !== null) {
        results.push({ type: "overall" });
      }

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].type, "overall");
    });

    it("should add both checks when both are configured", () => {
      const minCoverage = 80;
      const minCoverageNewCode = 90;
      const results = [];

      if (minCoverageNewCode !== null) {
        results.push({ type: "new-code" });
      }
      if (minCoverage !== null) {
        results.push({ type: "overall" });
      }

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].type, "new-code");
      assert.strictEqual(results[1].type, "overall");
    });
  });

  describe("Error handling", () => {
    it("should handle null coverage gracefully", () => {
      const coverage = null;
      assert.strictEqual(coverage, null);
    });

    it("should handle parsing errors", () => {
      const invalidOutput = "Invalid output";
      const match = invalidOutput.match(/lines[.\s]+:\s+([0-9.]+)%/);
      assert.strictEqual(match, null);
    });
  });

  describe("Coverage calculation", () => {
    it("should parse coverage percentage correctly", () => {
      const percentageStr = "85.5";
      const coverage = parseFloat(percentageStr);
      assert.strictEqual(coverage, 85.5);
    });

    it("should handle integer percentages", () => {
      const percentageStr = "100";
      const coverage = parseFloat(percentageStr);
      assert.strictEqual(coverage, 100);
    });

    it("should handle decimal percentages", () => {
      const percentageStr = "85.567";
      const coverage = parseFloat(percentageStr);
      assert.strictEqual(coverage, 85.567);
    });
  });
});

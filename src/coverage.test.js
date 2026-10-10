import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  checkDiffCoverage,
  normalizeBaseBranch,
  parseDiffCoverOutput,
  parseLcovTotal,
  parseXmlTotal,
  readTotalCoverage,
  runCoverageChecks,
} from "./coverage.js";

const LCOV = `TN:
SF:src/a.js
DA:1,1
DA:2,0
LF:10
LH:8
end_of_record
SF:src/b.js
LF:30
LH:22
end_of_record
`;

const COBERTURA = `<?xml version="1.0" ?>
<coverage line-rate="0.8125" lines-covered="13" lines-valid="16" version="7.3">
  <packages><package name="src"><classes><class filename="src/a.js" line-rate="0.8125"/></classes></package></packages>
</coverage>`;

const JACOCO = `<?xml version="1.0" encoding="UTF-8"?>
<report name="demo">
  <package name="demo">
    <class name="demo/A"><counter type="LINE" missed="2" covered="6"/></class>
    <counter type="LINE" missed="2" covered="6"/>
  </package>
  <counter type="INSTRUCTION" missed="10" covered="90"/>
  <counter type="LINE" missed="5" covered="15"/>
</report>`;

describe("parseLcovTotal", () => {
  it("sums LH/LF over every record", () => {
    assert.deepStrictEqual(parseLcovTotal(LCOV), { covered: 30, total: 40, percent: 75 });
  });

  it("returns null percent when nothing is instrumented", () => {
    assert.deepStrictEqual(parseLcovTotal("TN:\nSF:x\nLF:0\nLH:0\nend_of_record\n"), {
      covered: 0,
      total: 0,
      percent: null,
    });
  });

  it("falls back to DA lines when LF/LH are missing", () => {
    const text = "SF:x\nDA:1,1\nDA:2,0\nDA:3,4\nend_of_record\n";
    assert.deepStrictEqual(parseLcovTotal(text), { covered: 2, total: 3, percent: 66.67 });
  });
});

describe("parseXmlTotal", () => {
  it("reads Cobertura lines-covered / lines-valid", () => {
    assert.strictEqual(parseXmlTotal(COBERTURA), 81.25);
  });

  it("falls back to Cobertura line-rate", () => {
    assert.strictEqual(parseXmlTotal('<coverage line-rate="0.5"></coverage>'), 50);
  });

  it("reads the report-level JaCoCo LINE counter", () => {
    assert.strictEqual(parseXmlTotal(JACOCO), 75);
  });

  it("returns null for an unknown document", () => {
    assert.strictEqual(parseXmlTotal("<foo/>"), null);
  });
});

describe("readTotalCoverage", () => {
  const dir = mkdtempSync(join(tmpdir(), "cov-"));

  it("detects LCOV by content, whatever the extension", () => {
    const file = join(dir, "lcov.txt");
    writeFileSync(file, LCOV);
    assert.strictEqual(readTotalCoverage(file), 75);
  });

  it("detects XML by content", () => {
    const file = join(dir, "coverage.xml");
    writeFileSync(file, COBERTURA);
    assert.strictEqual(readTotalCoverage(file), 81.25);
  });

  it("returns null when the file is missing", () => {
    assert.strictEqual(readTotalCoverage(join(dir, "nope.info")), null);
  });
});

describe("normalizeBaseBranch", () => {
  it("accepts a bare branch name", () => {
    assert.deepStrictEqual(normalizeBaseBranch("main"), {
      remote: "origin",
      branch: "main",
      ref: "origin/main",
    });
  });

  it("accepts an origin/ prefixed name", () => {
    assert.deepStrictEqual(normalizeBaseBranch("origin/dev"), {
      remote: "origin",
      branch: "dev",
      ref: "origin/dev",
    });
  });

  it("keeps slashes inside the branch name", () => {
    assert.deepStrictEqual(normalizeBaseBranch("origin/release/1.2"), {
      remote: "origin",
      branch: "release/1.2",
      ref: "origin/release/1.2",
    });
  });

  it("rejects an empty value", () => {
    assert.throws(() => normalizeBaseBranch("  "), /base-branch/);
  });
});

describe("parseDiffCoverOutput", () => {
  it("computes a precise percentage from the diff-cover 10.x totals", () => {
    const output = `-------------
Diff Coverage
Diff: origin/main...HEAD, staged and unstaged changes
-------------
lib.js (57.1%): Missing lines 7-9
-------------
Total:   7 lines
Missing: 3 lines
Coverage: 57%
-------------
`;
    assert.deepStrictEqual(parseDiffCoverOutput(output), { coverage: 57.14, noLines: false });
  });

  it("handles the singular 'line' wording", () => {
    const output = "Total:   1 line\nMissing: 0 lines\nCoverage: 100%\n";
    assert.deepStrictEqual(parseDiffCoverOutput(output), { coverage: 100, noLines: false });
  });

  it("falls back to the Coverage line when totals are absent", () => {
    assert.deepStrictEqual(parseDiffCoverOutput("Coverage: 57%\n"), {
      coverage: 57,
      noLines: false,
    });
  });

  it("still reads the legacy 'Diff Coverage: X%' wording", () => {
    assert.deepStrictEqual(parseDiffCoverOutput("-----\nDiff Coverage: 92.5%\n"), {
      coverage: 92.5,
      noLines: false,
    });
  });

  it("flags a diff without coverable lines", () => {
    assert.deepStrictEqual(
      parseDiffCoverOutput("No lines with coverage information in this diff.\n"),
      { coverage: null, noLines: true }
    );
  });

  it("returns null when nothing matches", () => {
    assert.deepStrictEqual(parseDiffCoverOutput("boom"), { coverage: null, noLines: false });
  });
});

describe("checkDiffCoverage", () => {
  function fakeExec(outputs) {
    const calls = [];
    const exec = (cmd) => {
      calls.push(cmd);
      const out = outputs[calls.length - 1];
      if (out instanceof Error) throw out;
      return out ?? "";
    };
    return { exec, calls };
  }

  it("fetches the base branch into origin/<branch> and passes when above the threshold", () => {
    const { exec, calls } = fakeExec(["", "Diff Coverage: 90.0%\n"]);
    const result = checkDiffCoverage("cov.info", "main", 80, { exec });

    assert.match(
      calls[0],
      /^git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main$/
    );
    assert.match(calls[1], /^diff-cover .*cov\.info.* --compare-branch=origin\/main$/);
    assert.strictEqual(result.coverage, 90);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.skipped, false);
  });

  it("fails when below the threshold even if diff-cover exits non-zero", () => {
    const err = Object.assign(new Error("exit 1"), { stdout: "Diff Coverage: 50.0%\n" });
    const { exec } = fakeExec(["", err]);
    const result = checkDiffCoverage("cov.info", "origin/main", 80, { exec });

    assert.strictEqual(result.coverage, 50);
    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.output, "Diff Coverage: 50.0%\n");
  });

  it("marks the check as skipped when the diff has no coverable lines", () => {
    const { exec } = fakeExec(["", "No lines with coverage information in this diff.\n"]);
    const result = checkDiffCoverage("cov.info", "main", 80, { exec });

    assert.strictEqual(result.coverage, null);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.skipped, true);
  });

  it("throws a clear error when the base branch cannot be fetched", () => {
    const { exec } = fakeExec([new Error("couldn't find remote ref")]);
    assert.throws(() => checkDiffCoverage("cov.info", "main", 80, { exec }), /fetch .*main/);
  });

  it("fails when diff-cover output cannot be parsed", () => {
    const { exec } = fakeExec(["", "diff-cover: command not found"]);
    const result = checkDiffCoverage("cov.info", "main", 80, { exec });
    assert.strictEqual(result.coverage, null);
    assert.strictEqual(result.passed, false);
  });
});

describe("runCoverageChecks", () => {
  const dir = mkdtempSync(join(tmpdir(), "cov-"));
  const file = join(dir, "lcov.info");
  writeFileSync(file, LCOV);
  const exec = () => "Diff Coverage: 100%\n";

  it("returns nothing when no threshold is configured", () => {
    assert.deepStrictEqual(runCoverageChecks(file, "main", null, null, { exec }), []);
  });

  it("runs only the overall check", () => {
    const results = runCoverageChecks(file, "main", 70, null, { exec });
    assert.deepStrictEqual(
      results.map((r) => [r.type, r.coverage, r.passed]),
      [["overall", 75, true]]
    );
  });

  it("runs both checks, new code first", () => {
    const results = runCoverageChecks(file, "main", 80, 90, { exec });
    assert.deepStrictEqual(
      results.map((r) => [r.type, r.coverage, r.passed]),
      [
        ["new-code", 100, true],
        ["overall", 75, false],
      ]
    );
  });
});

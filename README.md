# 🧮 Coverage Action

A GitHub Action that enforces code coverage standards for your pull requests. Keep your codebase healthy by ensuring new code meets your coverage requirements!

## Why Use This Action?

When reviewing pull requests, it's crucial to ensure that:

- **New code is properly tested** - Don't let untested code slip into your codebase
- **Overall project coverage doesn't drop** - Maintain or improve your project's test coverage over time
- **Standards are enforced automatically** - No manual checks needed, the CI does it for you

This action uses **[diff-cover](https://github.com/Bachmann1234/diff_cover)** under the hood to analyze only the lines changed in your PR, giving you precise coverage metrics for new code.

## ✨ Features

- 🎯 **Check new code coverage** - Focus on what changed in the PR
- 📊 **Check overall coverage** - Ensure project-wide coverage standards
- 💬 **Automatic PR comments** - Clear visual feedback on every PR
- 🚨 **Fail CI on insufficient coverage** - Prevent merging untested code
- 📄 **Multiple formats** - Supports LCOV, Cobertura XML and JaCoCo XML
- ⚡ **Fast and efficient** - No system packages to install, analyzes only changed lines using `diff-cover`

---

## 🚀 Quick Start

### Basic Example (Check New Code Only)

```yaml
name: Check Coverage

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  coverage-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # needed to post the comment
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install and test
        run: |
          npm ci
          npm run test -- --coverage --coverageReporters=lcov

      - name: Check new code coverage
        uses: MisterPandaPooh/check-coverage-action@v1
        with:
          coverage-file: coverage/lcov.info
          min-coverage-new-code: 80
          base-branch: origin/${{ github.base_ref }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Check Both Overall and New Code Coverage

```yaml
- name: Check coverage
  uses: MisterPandaPooh/check-coverage-action@v1
  with:
    coverage-file: coverage/lcov.info
    min-coverage: 70 # Overall project coverage
    min-coverage-new-code: 90 # New code must have higher coverage
    base-branch: origin/${{ github.base_ref }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Check Only Overall Coverage

```yaml
- name: Check overall coverage
  uses: MisterPandaPooh/check-coverage-action@v1
  with:
    coverage-file: coverage/lcov.info
    min-coverage: 80
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## ⚙️ Inputs

| Input                   | Description                                                                            | Required | Default       |
| ----------------------- | -------------------------------------------------------------------------------------- | -------- | ------------- |
| `coverage-file`         | Path to the LCOV, Cobertura XML or JaCoCo XML file, relative to the workspace          | ✅       | -             |
| `min-coverage`          | Minimum overall project coverage % required (optional - if not set, check is disabled) | ❌       | -             |
| `min-coverage-new-code` | Minimum new code coverage % required (optional - if not set, check is disabled)        | ❌       | -             |
| `base-branch`           | Comparison branch, with or without the `origin/` prefix                                | ❌       | `origin/main` |
| `github-token`          | GitHub token to comment on PR                                                          | ✅       | -             |

**Note:** At least one of `min-coverage` or `min-coverage-new-code` should be set, otherwise no coverage checks will be performed.

---

## 🔧 How It Works

This is a composite action that sets up Node.js 24 and Python, then runs a single bundled script from your repository's workspace:

1. **Reads your coverage file** and computes the overall line coverage itself (LCOV, Cobertura XML or JaCoCo XML, detected by content)
2. **Checks overall coverage** (optional) against `min-coverage`
3. **Checks new code coverage** (optional) - fetches `base-branch` and runs `diff-cover` on the lines changed since it
4. **Posts or updates a comment** on your PR with the results
5. **Passes or fails** the CI check based on your thresholds

When the diff contains no coverable line (docs only, config only…), the new code check is reported as **skipped** and passes.

---

## 📊 PR Comment Example

When both checks are enabled:

> ## 📊 Coverage Report
>
> | Type                   | Coverage                 | Required | Status  |
> | ---------------------- | ------------------------ | -------- | ------- |
> | **📦 Overall Project** | `75.30%` `diff: +5.30%`  | 70%      | passing |
> | **🆕 New Code (Diff)** | `92.50%` `diff: +2.50%`  | 90%      | passing |
>
> <details>
> <summary>📋 View detailed diff-cover report</summary>
>
> ```
> src/utils/parser.js (95.0%): Missing lines 12
> src/components/Header.tsx (90.0%): Missing lines 40-41
> Total:   40 lines
> Missing: 3 lines
> Coverage: 92%
> ```
>
> </details>
>
> ---
>
> **Overall: Passing**

The real comment uses shields.io badges instead of inline code.

---

## 📝 Important Notes

- **Git history**: `min-coverage-new-code` needs the merge base between your branch and `base-branch`. With the default shallow checkout the action fetches the full history itself (with a warning); set `fetch-depth: 0` in `actions/checkout` to avoid that extra fetch on every run
- **Working tree**: `diff-cover` also counts uncommitted changes to tracked files. Make sure your test step does not rewrite tracked sources before the action runs
- **Base branch**: For pull request workflows, use `${{ github.base_ref }}` (or `origin/${{ github.base_ref }}`, both work). For workflows that run on both push and PR events, use `${{ github.base_ref || 'main' }}` to fall back to main
- **Permissions**: posting the comment needs `pull-requests: write` on the job. Without it (for example on a PR from a fork) the comment is skipped with a warning and the check still passes or fails on the thresholds
- **Flexible checks**: You can enable overall coverage check, new code coverage check, or both - use what works best for your project
- **Multiple formats**: Supports LCOV (`.info`), Cobertura XML and JaCoCo XML

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup, workflow, and testing guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

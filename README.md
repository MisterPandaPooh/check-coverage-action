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
- 📄 **Multiple formats** - Supports LCOV, Cobertura XML, JaCoCo XML, and more
- ⚡ **Fast and efficient** - Analyzes only changed lines using `diff-cover`

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
| `coverage-file`         | Path to LCOV or XML coverage file                                                      | ✅       | -             |
| `min-coverage`          | Minimum overall project coverage % required (optional - if not set, check is disabled) | ❌       | -             |
| `min-coverage-new-code` | Minimum new code coverage % required (optional - if not set, check is disabled)        | ❌       | -             |
| `base-branch`           | Comparison branch (used for new code coverage check)                                   | ❌       | `origin/main` |
| `github-token`          | GitHub token to comment on PR                                                          | ✅       | -             |

**Note:** At least one of `min-coverage` or `min-coverage-new-code` should be set, otherwise no coverage checks will be performed.

---

## 🔧 How It Works

This is a composite action that sets up Node.js and Python with caching for fast execution. When triggered on a pull request:

1. **Sets up Node.js and Python** with dependency caching for faster subsequent runs
2. **Analyzes your coverage file** (LCOV or XML format)
3. **Checks overall coverage** (optional) - Uses `lcov` or `coverage-report` tools
4. **Checks new code coverage** (optional) - Uses `diff-cover` to analyze only changed lines
5. **Posts a comment** on your PR with detailed results
6. **Passes or fails** the CI check based on your thresholds

---

## 📊 PR Comment Example

When both checks are enabled:

> 🧮 **Coverage Report**
>
> ### 📊 Overall Project Coverage
>
> **Coverage:** 75.30%  
> **Minimum required:** 70%  
> **Status:** ✅ Pass
>
> ### 🆕 New Code Coverage
>
> **Coverage:** 92.50%  
> **Minimum required:** 90%  
> **Status:** ✅ Pass
>
> <details>
> <summary>📜 diff-cover output</summary>
>
> ```
> Diff Coverage: 92.5%
> src/utils/parser.js (95%)
> src/components/Header.tsx (90%)
> ```
>
> </details>
>
> ---
>
> **Overall Status:** ✅ All checks passed

---

## 📝 Important Notes

- **Git history required**: When using `min-coverage-new-code`, make sure to set `fetch-depth: 0` in `actions/checkout` to have full Git history for comparison
- **Base branch**: For pull request workflows, use `origin/${{ github.base_ref }}`. For workflows that run on both push and PR events, use `origin/${{ github.base_ref || 'main' }}` to fallback to main branch
- **Flexible checks**: You can enable overall coverage check, new code coverage check, or both - use what works best for your project
- **Multiple formats**: Supports LCOV (`.info`), Cobertura XML, JaCoCo XML, and other common coverage formats

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup, workflow, and testing guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

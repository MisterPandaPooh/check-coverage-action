# 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report bugs** - Open an issue with details about the problem
2. **Suggest features** - Share your ideas for improvements
3. **Submit PRs** - Fix bugs or add new features
4. **Improve documentation** - Help others understand the action better

## Development Setup

```bash
# Clone the repository
git clone https://github.com/MisterPandaPooh/check-coverage-action.git
cd check-coverage-action

# Install dependencies
npm install
```

## Development Workflow

### 1. Make Code Changes

Edit files in `src/index.js`, `src/coverage.js`, or `src/comment.js`

### 2. Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

### 3. Build the Action

**⚠️ IMPORTANT:** The `dist/` folder must be committed!

GitHub Actions runs the bundled code in `dist/index.js`, not the source files.

```bash
# Build the bundled distribution
npm run build

# Verify dist is up to date (CI will check this)
npm run check-dist
```

### 4. Commit Your Changes

```bash
# Stage your source changes AND the built dist/
git add src/ dist/

# Commit everything together
git commit -m "Your commit message"

# Push your changes
git push origin your-branch
```

**Common Mistakes to Avoid:**

- ❌ Forgetting to run `npm run build` after code changes
- ❌ Not committing the `dist/` folder
- ❌ Having uncommitted changes in `dist/` (CI will fail)

**Pro Tip:** Run `npm run check-dist` before committing to ensure dist/ is up to date!

## Testing Your Changes

### Unit Tests

```bash
npm test
```

### Integration Test (Self-Test)

The CI workflow includes a self-test job that uses the action to check its own coverage. You can see this in action when you open a PR.

### Manual Testing

Create a test repository and reference your branch:

```yaml
- uses: MisterPandaPooh/check-coverage-action@your-branch-name
  with:
    coverage-file: coverage/lcov.info
    min-coverage-new-code: 80
```

For major changes, please open an issue first to discuss what you'd like to change.

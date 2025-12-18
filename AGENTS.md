# markdown-to-slack-blocks

You are a TypeScript library developer specializing in Markdown parsing and Slack Block Kit.

## Commands

```bash
npm test                  # Run all tests with Vitest (no watch mode)
npm run build             # Compile TypeScript to dist/
npm run clean             # Remove dist/ directory
npm run generate-fixtures # Regenerate JSON test fixtures from input.md
```

## Project Knowledge

- **Tech Stack:** TypeScript 5.9, Node.js ≥18, Vitest 4.0, mdast-util-from-markdown 2.0
- **Purpose:** Convert Markdown strings into Slack Block Kit JSON format
- **Key Options:** `mentions` (user/channel/group/team mappings), `detectColors`, `preferSectionBlocks`

### File Structure

- `src/index.ts` – Main entry point, exports `markdownToBlocks()` and `splitBlocks()` functions
- `src/parser.ts` – Core parsing logic using mdast AST
- `src/splitter.ts` – Splits large block arrays to fit Slack's limits (40 blocks, 12k chars)
- `src/types.ts` – TypeScript type definitions for Slack blocks
- `src/validator.ts` – Input validation (user IDs, channel IDs, etc.)
- `tests/` – Integration and unit tests
- `tests/fixtures/` – Test input/output JSON files

## Code Style

**Naming conventions:**
- Functions: `camelCase` (`parseMarkdown`, `validateOptions`)
- Types/Interfaces: `PascalCase` (`SlackBlock`, `RichTextElement`)
- Constants: `UPPER_SNAKE_CASE`

**Example of good code:**
```typescript
// ✅ Good - explicit types, descriptive names
export function markdownToBlocks(
  markdown: string,
  options?: MarkdownToBlocksOptions
): SlackBlock[] {
  const validated = validateOptions(options);
  const ast = fromMarkdown(markdown, mdastOptions);
  return convertAstToBlocks(ast, validated);
}

// ❌ Bad - implicit any, vague names
function convert(md, opts) {
  return parse(md).map(x => transform(x, opts));
}
```

## Testing

- All changes must pass tests: `npm test`
- Tests use fixtures in `tests/fixtures/` with `input.md` and `output*.json` pairs
- **To update fixtures:** If you change the parser logic and need to update snapshots, run `npm run generate-fixtures`. This runs `scripts/generate-fixtures.ts`.
- Run specific test: `npm test tests/integration.test.ts`

## Boundaries

- ✅ **Always:** Run `npm test` before commits, follow existing code patterns, use strict TypeScript, **bump version in `package.json` after noticeable changes**
- ⚠️ **Ask first:** Adding new dependencies, changing the public API
- 🚫 **Never:** Commit `node_modules/`, modify `dist/` directly, break Slack Block Kit JSON schema compatibility

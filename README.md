# Markdown to Slack Blocks

A powerful library to convert Markdown text into Slack's Block Kit JSON format.

## Motivation

While Slack does offer native [markdown support in blocks](https://api.slack.com/reference/surfaces/formatting#basics), there are significant limitations. The following markdown features are **not supported** by Slack's native markdown:

- **Code blocks with syntax highlighting** — Slack renders code blocks but ignores language hints
- **Horizontal rules** — No native support for `---` or `***` dividers
- **Tables** — Markdown tables are not rendered
- **Task lists** — Checkbox-style lists (`- [ ]`, `- [x]`) are not recognized

This library is particularly useful for apps that leverage **platform AI features** where you expect a **markdown response from an LLM**. Instead of sending raw markdown that Slack can't fully render, this library converts it to proper Block Kit JSON that displays correctly.

### Additional Features

Beyond basic markdown conversion, this library provides:

- **Mention Support**: User, channel, user group, and team mentions (`@username`, `#channel`) are automatically detected and converted to Slack's native mention format when ID mappings are provided. Without mappings, mentions are rendered as plain text in some cases.
- **Native Slack Dates**: Support for Slack's date formatting syntax, allowing dynamic date rendering that respects user timezones.
- **Color Detection**: Optional color detection that converts color values (hex, rgb, named colors) into Slack's native color elements for rich visual formatting.

## How It Works

This library uses a two-step conversion process:

1. **Markdown → AST**: The markdown string is parsed into an Abstract Syntax Tree (AST) using [mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown), with GitHub Flavored Markdown (GFM) support via [mdast-util-gfm](https://github.com/syntax-tree/mdast-util-gfm).

2. **AST → Slack Blocks**: The AST is traversed and converted into Slack's Block Kit JSON format, mapping markdown elements to their corresponding Slack block types and rich text elements.

### Key Libraries

- **[mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown)** — Parses markdown into an AST
- **[mdast-util-gfm](https://github.com/syntax-tree/mdast-util-gfm)** — Adds GitHub Flavored Markdown support (tables, strikethrough, task lists)
- **[micromark-extension-gfm](https://github.com/micromark/micromark-extension-gfm)** — Micromark extension for GFM syntax
- **[mdast-util-to-string](https://github.com/syntax-tree/mdast-util-to-string)** — Extracts plain text from AST nodes

## Supported Output

### Blocks

| Block Type | Description |
|------------|-------------|
| `rich_text` | Primary block type for formatted text content |
| `header` | H1 headings rendered as header blocks |
| `divider` | Horizontal rules converted to divider blocks |
| `image` | Standalone images |
| `section` | Text sections with optional accessories |
| `context` | Smaller context text and images |
| `table` | Table data (converted from markdown tables) |

### Rich Text Elements

| Element Type | Description |
|--------------|-------------|
| `rich_text_section` | Container for inline text elements |
| `rich_text_list` | Ordered and unordered lists (supports nesting) |
| `rich_text_preformatted` | Code blocks |
| `rich_text_quote` | Blockquotes |

### Rich Text Section Elements

| Element Type | Description |
|--------------|-------------|
| `text` | Plain text with optional styling (bold, italic, strike, code) |
| `link` | Hyperlinks |
| `emoji` | Emoji shortcodes (`:emoji_name:`) |
| `user` | User mentions (`@username`) |
| `channel` | Channel mentions (`#channel`) |
| `usergroup` | User group mentions |
| `team` | Team mentions |
| `broadcast` | Broadcast mentions (`@here`, `@channel`, `@everyone`) |
| `date` | Formatted date objects |
| `color` | Color values (when `detectColors` is enabled) |

### Text Styles

| Style | Markdown Syntax |
|-------|-----------------|
| **Bold** | `**text**` or `__text__` |
| *Italic* | `*text*` or `_text_` |
| ~~Strikethrough~~ | `~~text~~` |
| `Code` | `` `text` `` |

## Features

- **Standard Markdown Support**: Converts headings, lists, bold, italic, code blocks, blockquotes, and links.
- **Slack-Specific Extensions**: Support for user mentions, channel mentions, user groups, and team mentions.
- **Configurable**: Options to customize behavior, such as color detection.
- **Type-Safe**: Written in TypeScript with full type definitions.

## Installation

```bash
npm install markdown-to-slack-blocks
```

## Usage

```typescript
import { markdownToBlocks } from 'markdown-to-slack-blocks';

const markdown = `
# Hello World
This is a **bold** statement.
`;

const blocks = markdownToBlocks(markdown);
console.log(JSON.stringify(blocks, null, 2));
```

### Options

You can pass an options object to `markdownToBlocks`, otherwise the mentions will be rendered as text in some blocks (e.g. tables):

```typescript
const options = {
    mentions: {
        users: { 'username': 'U123456' },
        channels: { 'general': 'C123456' },
        userGroups: { 'engineers': 'S123456' },
        teams: { 'myteam': 'T123456' }
    },
    detectColors: true,
    preferSectionBlocks: true // default: true
};

const blocks = markdownToBlocks(markdown, options);
```

### Validation

The library validates that the IDs provided in the `mentions` option adhere to Slack's ID format:
- **User IDs**: Must start with `U` or `W`.
- **Channel IDs**: Must start with `C`.
- **User Group IDs**: Must start with `S`.
- **Team IDs**: Must start with `T`.

All IDs must be alphanumeric.

### Handling Large Messages

Slack limits messages to **~45 blocks** and **~12KB** of JSON. Use `splitBlocks` to split large outputs into several messages, or `splitBlocksWithText` if you also need a plain-text fallback for `postMessage`:

```typescript
import { markdownToBlocks, splitBlocks, splitBlocksWithText } from 'markdown-to-slack-blocks';

const blocks = markdownToBlocks(veryLongMarkdown);

// Blocks-only batches
const batches = splitBlocks(blocks);
for (const batch of batches) {
    await slack.postMessage({ channel, blocks: batch });
}

// Batches with text fallback
const batchesWithText = splitBlocksWithText(blocks);
for (const batch of batchesWithText) {
    await slack.postMessage({ channel, text: batch.text, blocks: batch.blocks });
}
```

**Options:**
```typescript
splitBlocks(blocks, { maxBlocks: 40, maxCharacters: 12000 });
splitBlocksWithText(blocks, { maxBlocks: 40, maxCharacters: 12000 });
```

Splitting happens at natural boundaries: between blocks first, then within `rich_text` elements, and finally within large code blocks by line. `splitBlocksWithText` additionally generates a concise plaintext summary per batch (headers, sections, rich text, tables, etc.) suitable for Slack's `text` field.

### Plain text rendering

If you already have a block array and need a lightweight plaintext fallback (for example to populate the `text` field in `chat.postMessage`), use `blocksToPlainText`:

```typescript
import { blocksToPlainText } from 'markdown-to-slack-blocks';

const text = blocksToPlainText(blocks);
// -> "Hello world" or similar, depending on your blocks
```

The function walks the rendered blocks and returns a joined string that keeps list markers, quotes, tables (as `cell | cell` rows), mentions, dates (using the provided fallback or ISO string), and basic formatting markers where possible. The output is best-effort and is intended for concise fallbacks rather than full fidelity rendering.

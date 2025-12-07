# Markdown to Slack Block Kit

A powerful library to convert Markdown text into Slack's Block Kit JSON format.

## Motivation

While Slack does offer native [markdown support in blocks](https://api.slack.com/reference/surfaces/formatting#basics), there are significant limitations. The following markdown features are **not supported** by Slack's native markdown:

- **Code blocks with syntax highlighting** — Slack renders code blocks but ignores language hints
- **Horizontal rules** — No native support for `---` or `***` dividers
- **Tables** — Markdown tables are not rendered
- **Task lists** — Checkbox-style lists (`- [ ]`, `- [x]`) are not recognized

This library is particularly useful for apps that leverage **platform AI features** where you expect a **markdown response from an LLM**. Instead of sending raw markdown that Slack can't fully render, this library converts it to proper Block Kit JSON that displays correctly.

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

You can pass an options object to `markdownToBlocks`, otherwise the mentions will be rendered as text:

```typescript
const options = {
    mentions: {
        users: { 'username': 'U123456' },
        channels: { 'general': 'C123456' },
        userGroups: { 'engineers': 'S123456' },
        teams: { 'myteam': 'T123456' }
    },
    detectColors: true
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

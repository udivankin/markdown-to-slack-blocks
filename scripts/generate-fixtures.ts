import {
	blocksToMarkdown,
	markdownToBlocks,
	splitBlocksWithText,
} from "../src/index";
import * as fs from "node:fs";
import * as path from "node:path";

const fixturesDir = path.join(__dirname, "..", "tests", "fixtures");
const mdPath = path.join(fixturesDir, "input.md");
const markdown = fs.readFileSync(mdPath, "utf-8");
const mentions = JSON.parse(
	fs.readFileSync(path.join(fixturesDir, "mentions.json"), "utf-8"),
);
const reversedMentions = JSON.parse(
	fs.readFileSync(path.join(fixturesDir, "mentions.reversed.json"), "utf-8"),
);

const baseOptions = {
	mentions,
	detectColors: true,
};

// Generate rich_text output (preferSectionBlocks: false)
const richTextBlocks = markdownToBlocks(markdown, {
	...baseOptions,
	preferSectionBlocks: false,
});
fs.writeFileSync(
	path.join(fixturesDir, "output_rich_text.json"),
	JSON.stringify(richTextBlocks, null, 2),
);
console.log("✓ Generated output_rich_text.json");

// Generate sections output (preferSectionBlocks: true)
const sectionBlocks = markdownToBlocks(markdown, {
	...baseOptions,
	preferSectionBlocks: true,
});
fs.writeFileSync(
	path.join(fixturesDir, "output_sections.json"),
	JSON.stringify(sectionBlocks, null, 2),
);
console.log("✓ Generated output_sections.json");

fs.writeFileSync(
	path.join(fixturesDir, "output_sections.md"),
	`${blocksToMarkdown(sectionBlocks, { mentions: reversedMentions })}\n`,
);
console.log("✓ Generated output_sections.md");

// Generate long content output (blocks and split batches)
const longMdPath = path.join(fixturesDir, "input_long.md");
const longMarkdown = fs.readFileSync(longMdPath, "utf-8");
const longBlocks = markdownToBlocks(longMarkdown);
const longBatches = splitBlocksWithText(longBlocks);

fs.writeFileSync(
	path.join(fixturesDir, "output_long.json"),
	JSON.stringify(longBlocks, null, 2),
);
console.log("✓ Generated output_long.json");

fs.writeFileSync(
	path.join(fixturesDir, "output_long_split.json"),
	JSON.stringify(longBatches, null, 2),
);
console.log("✓ Generated output_long_split.json");

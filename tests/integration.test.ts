import { describe, it, expect } from "vitest";
import {
	blocksToMarkdown,
	markdownToBlocks,
	splitBlocks,
	splitBlocksWithText,
} from "../src/index";
import * as fs from "node:fs";
import * as path from "node:path";

const fixturesDir = path.join(__dirname, "fixtures");
const mentions = JSON.parse(
	fs.readFileSync(path.join(fixturesDir, "mentions.json"), "utf-8"),
);
const reversedMentions = JSON.parse(
	fs.readFileSync(path.join(fixturesDir, "mentions.reversed.json"), "utf-8"),
);

function createOptions(preferSectionBlocks?: boolean) {
	return {
		mentions,
		detectColors: true,
		...(preferSectionBlocks === undefined ? {} : { preferSectionBlocks }),
	};
}

describe("Integration Test", () => {
	it("converts full_features.md to expected JSON", () => {
		const mdPath = path.join(fixturesDir, "input.md");
		const jsonPath = path.join(fixturesDir, "output_rich_text.json");

		const markdown = fs.readFileSync(mdPath, "utf-8");
		const expectedJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

		const result = markdownToBlocks(markdown, createOptions(false));

		expect(result).toEqual(expectedJson);
	});

	it("converts full_features.md to section blocks JSON", () => {
		const mdPath = path.join(fixturesDir, "input.md");
		const jsonPath = path.join(fixturesDir, "output_sections.json");

		const markdown = fs.readFileSync(mdPath, "utf-8");
		const expectedJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

		const result = markdownToBlocks(markdown, createOptions(true));

		expect(result).toEqual(expectedJson);
	});

	it("converts full_features.md to expected section blocks Markdown", () => {
		const mdPath = path.join(fixturesDir, "input.md");
		const markdownPath = path.join(fixturesDir, "output_sections.md");

		const markdown = fs.readFileSync(mdPath, "utf-8");
		const expectedMarkdown = fs.readFileSync(markdownPath, "utf-8").trimEnd();

		const blocks = markdownToBlocks(markdown, createOptions(true));
		const result = blocksToMarkdown(blocks, { mentions: reversedMentions });

		expect(result).toBe(expectedMarkdown);
	});

	it("splits large content that exceeds Slack limits", () => {
		const mdPath = path.join(fixturesDir, "input.md");
		const markdown = fs.readFileSync(mdPath, "utf-8");

		// Repeat the markdown content multiple times to exceed limits
		const largeMarkdown = Array(10).fill(markdown).join("\n\n---\n\n");

		const blocks = markdownToBlocks(largeMarkdown, createOptions());
		const batches = splitBlocks(blocks);

		// Should result in multiple batches
		expect(batches.length).toBeGreaterThan(1);

		// Each batch should respect limits
		for (const batch of batches) {
			expect(batch.length).toBeLessThanOrEqual(40);
			expect(JSON.stringify(batch).length).toBeLessThanOrEqual(12000);
		}

		// Log stats in a way that integrates with Vitest output
		console.log(
			`\n  📊 Split stats: ${blocks.length} blocks → ${batches.length} batches`,
		);

		// Total blocks across batches should equal original
		const totalBlocks = batches.reduce((sum, batch) => sum + batch.length, 0);
		expect(totalBlocks).toBe(blocks.length);
	});

	it("converts input_long.md to expected blocks and split batches", () => {
		const mdPath = path.join(fixturesDir, "input_long.md");
		const blocksJsonPath = path.join(fixturesDir, "output_long.json");
		const splitJsonPath = path.join(fixturesDir, "output_long_split.json");

		const markdown = fs.readFileSync(mdPath, "utf-8");
		const expectedBlocks = JSON.parse(fs.readFileSync(blocksJsonPath, "utf-8"));
		const expectedBatches = JSON.parse(fs.readFileSync(splitJsonPath, "utf-8"));

		const blocks = markdownToBlocks(markdown);
		expect(blocks).toEqual(expectedBlocks);

		const result = splitBlocksWithText(blocks);

		// Check overall structure
		expect(result.length).toBe(expectedBatches.length);
		expect(result).toEqual(expectedBatches);

		// Verify limits are respected for implicit check
		for (const batch of result.map((r) => r.blocks)) {
			expect(batch.length).toBeLessThanOrEqual(40);
			expect(JSON.stringify(batch).length).toBeLessThanOrEqual(12000);

			// Verify text section limit
			for (const block of batch) {
				if (block.type === "section" && block.text?.type === "mrkdwn") {
					expect(block.text.text.length).toBeLessThanOrEqual(3000);
				}
			}
		}

		// Sanity: text fallback should not be empty
		expect(
			result.every((r) => typeof r.text === "string" && r.text.length > 0),
		).toBe(true);
	});
});

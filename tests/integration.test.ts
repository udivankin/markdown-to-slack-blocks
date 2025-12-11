import { describe, it, expect } from "vitest";
import {
	markdownToBlocks,
	splitBlocks,
	splitBlocksWithText,
} from "../src/index";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Integration Test", () => {
	it("converts full_features.md to expected JSON", () => {
		const mdPath = path.join(__dirname, "fixtures", "input.md");
		const jsonPath = path.join(__dirname, "fixtures", "output_rich_text.json");

		const markdown = fs.readFileSync(mdPath, "utf-8");
		const expectedJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

		const options = {
			mentions: {
				users: { jdoe: "U12345" },
				channels: { general: "C00001" },
				userGroups: { devs: "S12345" },
				teams: { T123456: "T123456" },
			},
			detectColors: true,
			preferSectionBlocks: false,
		};

		const result = markdownToBlocks(markdown, options);

		expect(result).toEqual(expectedJson);
	});

	it("converts full_features.md to section blocks JSON", () => {
		const mdPath = path.join(__dirname, "fixtures", "input.md");
		const jsonPath = path.join(__dirname, "fixtures", "output_sections.json");

		const markdown = fs.readFileSync(mdPath, "utf-8");
		const expectedJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

		const options = {
			mentions: {
				users: { jdoe: "U12345" },
				channels: { general: "C00001" },
				userGroups: { devs: "S12345" },
				teams: { T123456: "T123456" },
			},
			detectColors: true,
			preferSectionBlocks: true,
		};

		const result = markdownToBlocks(markdown, options);

		expect(result).toEqual(expectedJson);
	});

	it("splits large content that exceeds Slack limits", () => {
		const mdPath = path.join(__dirname, "fixtures", "input.md");
		const markdown = fs.readFileSync(mdPath, "utf-8");

		// Repeat the markdown content multiple times to exceed limits
		const largeMarkdown = Array(10).fill(markdown).join("\n\n---\n\n");

		const options = {
			mentions: {
				users: { jdoe: "U12345" },
				channels: { general: "C00001" },
				userGroups: { devs: "S12345" },
				teams: { T123456: "T123456" },
			},
			detectColors: true,
		};

		const blocks = markdownToBlocks(largeMarkdown, options);
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
		const mdPath = path.join(__dirname, "fixtures", "input_long.md");
		const blocksJsonPath = path.join(__dirname, "fixtures", "output_long.json");
		const splitJsonPath = path.join(
			__dirname,
			"fixtures",
			"output_long_split.json",
		);

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

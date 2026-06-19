import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { blocksToMarkdown, markdownToBlocks } from "../src/index";
import type { Block } from "../src/types";

const fixturesDir = path.join(__dirname, "fixtures");
const reverseMentions = JSON.parse(
	fs.readFileSync(path.join(fixturesDir, "mentions.reversed.json"), "utf-8"),
);

describe("blocksToMarkdown", () => {
	it("renders Markdown-friendly syntax from section mrkdwn and rich_text blocks", () => {
		const blocks: Block[] = [
			{
				type: "header",
				text: { type: "plain_text", text: "Title" },
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Hello *bold*, _italic_, ~strike~, `code`, <https://example.com|link>, <@U12345>, <!here>",
				},
			},
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_list",
						style: "bullet",
						indent: 0,
						elements: [
							{
								type: "rich_text_section",
								elements: [{ type: "text", text: "First item" }],
							},
						],
					},
					{
						type: "rich_text_list",
						style: "bullet",
						indent: 1,
						elements: [
							{
								type: "rich_text_section",
								elements: [{ type: "text", text: "Nested item" }],
							},
						],
					},
				],
			},
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_quote",
						elements: [{ type: "text", text: "Quoted text" }],
					},
				],
			},
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_preformatted",
						elements: [{ type: "text", text: "const x = 1;" }],
					},
				],
			},
		];

		expect(blocksToMarkdown(blocks)).toBe(
			[
				"# Title",
				"",
				"Hello **bold**, *italic*, ~strike~, `code`, [link](<https://example.com>), <@U12345>, <!here>",
				"",
				"- First item",
				"  - Nested item",
				"",
				"> Quoted text",
				"",
				"```",
				"const x = 1;",
				"```",
			].join("\n"),
		);
	});

	it("renders visible mention names when reverse mention options are supplied", () => {
		const blocks: Block[] = [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Hello <@U12345>, join <#C00001>, ask <!subteam^S12345>, notify <!subteam^T123456>, format <@S12345>, ping <@here>",
				},
			},
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [
							{ type: "user", user_id: "U12345" },
							{ type: "text", text: " in " },
							{ type: "channel", channel_id: "C00001" },
							{ type: "text", text: " with " },
							{ type: "usergroup", usergroup_id: "S12345" },
							{ type: "text", text: " and " },
							{ type: "team", team_id: "T123456" },
						],
					},
				],
			},
		];

			expect(blocksToMarkdown(blocks, { mentions: reverseMentions })).toBe(
			[
				"Hello @jdoe, join #general, ask @devs, notify @T123456, format @devs, ping <@here>",
				"",
				"@jdoe in #general with @devs and @T123456",
			].join("\n"),
		);
	});

	it("renders data_table blocks back to a markdown table", () => {
		const blocks = markdownToBlocks(
			"| Name | Amount | Stage |\n| --- | --- | --- |\n| Alpha | 10 | **Won** |",
		);
		expect(blocksToMarkdown(blocks)).toBe(
			["| Name | Amount | Stage |", "| --- | --- | --- |", "| Alpha | 10 | **Won** |"].join(
				"\n",
			),
		);
	});

	it("round-trips data_table blocks with mixed cell types", () => {
		const markdown =
			"| Name | Amount | Stage |\n| --- | --- | --- |\n| Alpha | 10 | **Won** |\n| Bravo | 2.5 | Waiting on *review* |";
		const blocks = markdownToBlocks(markdown);
		const roundTripped = markdownToBlocks(blocksToMarkdown(blocks));
		expect(roundTripped).toEqual(blocks);
	});

	it("round-trips the rich_text fixture output", () => {
		const jsonPath = path.join(fixturesDir, "output_rich_text.json");
		const expectedBlocks = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

		const markdown = blocksToMarkdown(expectedBlocks);
		const roundTripped = markdownToBlocks(markdown, {
			detectColors: true,
			preferSectionBlocks: false,
		});

		expect(roundTripped).toEqual(expectedBlocks);
	});

	it("round-trips the section fixture output", () => {
		const jsonPath = path.join(fixturesDir, "output_sections.json");
		const expectedBlocks = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

		const markdown = blocksToMarkdown(expectedBlocks);
		const roundTripped = markdownToBlocks(markdown, {
			detectColors: true,
			preferSectionBlocks: true,
		});

		expect(roundTripped).toEqual(expectedBlocks);
	});
});

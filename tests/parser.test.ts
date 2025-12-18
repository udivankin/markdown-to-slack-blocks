import { describe, it, expect } from "vitest";
import { markdownToBlocks } from "../src/index";
import type { MarkdownToBlocksOptions } from "../src/types";

describe("markdownToBlocks", () => {
	it("converts plain text to a section block by default", () => {
		const mkd = "Hello world";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Hello world",
				},
			},
		]);
	});

	it("converts plain text to rich_text block when preferSectionBlocks is false", () => {
		const mkd = "Hello world";
		const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
		expect(result).toMatchObject([
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [
							{ type: "text", text: "Hello world" }, // No style: {}
						],
					},
				],
			},
		]);
		// Strict check for no style property
		// @ts-expect-error
		expect(result[0].elements[0].elements[0].style).toBeUndefined();
	});

	it("converts headers to header blocks (H1/H2)", () => {
		const mkd = "# Heading 1\n## Heading 2";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{ type: "header", text: { type: "plain_text", text: "Heading 1" } },
			{ type: "header", text: { type: "plain_text", text: "Heading 2" } },
		]);
	});

	it("converts bold and italic text to mrkdwn in section block", () => {
		const mkd = "This is *italic* and **bold**";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "This is _italic_ and *bold*",
				},
			},
		]);
	});

	it("converts bold and italic text to rich_text when preferSectionBlocks is false", () => {
		const mkd = "This is *italic* and **bold**";
		const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
		expect(result).toMatchObject([
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [
							{ type: "text", text: "This is " },
							{ type: "text", text: "italic", style: { italic: true } },
							{ type: "text", text: " and " },
							{ type: "text", text: "bold", style: { bold: true } },
						],
					},
				],
			},
		]);
	});

	it("converts unordered lists", () => {
		const mkd = "- Item 1\n- Item 2";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_list",
						style: "bullet",
						elements: [
							{
								type: "rich_text_section",
								elements: [{ type: "text", text: "Item 1" }],
							},
							{
								type: "rich_text_section",
								elements: [{ type: "text", text: "Item 2" }],
							},
						],
					},
				],
			},
		]);
	});

	it("converts ordered lists", () => {
		const mkd = "1. Item 1\n2. Item 2";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_list",
						style: "ordered",
						elements: [
							{
								type: "rich_text_section",
								elements: [{ type: "text", text: "Item 1" }],
							},
							{
								type: "rich_text_section",
								elements: [{ type: "text", text: "Item 2" }],
							},
						],
					},
				],
			},
		]);
	});

	it("converts nested lists with proper indentation", () => {
		const mkd = `- Level 1
  - Level 2 with **bold**
    - Level 3`;
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
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
								elements: [{ type: "text", text: "Level 1" }],
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
								elements: [
									{ type: "text", text: "Level 2 with " },
									{ type: "text", text: "bold", style: { bold: true } },
								],
							},
						],
					},
					{
						type: "rich_text_list",
						style: "bullet",
						indent: 2,
						elements: [
							{
								type: "rich_text_section",
								elements: [{ type: "text", text: "Level 3" }],
							},
						],
					},
				],
			},
		]);
	});

	it("converts code blocks", () => {
		const mkd = "```\nconst x = 1;\n```";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_preformatted",
						elements: [{ type: "text", text: "const x = 1;" }],
					},
				],
			},
		]);
	});

	it("converts blockquotes", () => {
		const mkd = "> This is a quote";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_quote",
						elements: [{ type: "text", text: "This is a quote" }],
					},
				],
			},
		]);
	});

	it("converts tables (GFM)", () => {
		const mkd = "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |";
		const result = markdownToBlocks(mkd);
		expect(result).toMatchObject([
			{
				type: "table",
				rows: [
					// Header row usually part of rows in Slack structure or separate?
					// Implementation maps all row children. GFM table parser structure:
					// table -> tableRow -> tableCell
					// The Header row is just the first row.
					[
						{
							type: "rich_text",
							elements: [
								{ type: "rich_text_section", elements: [{ text: "Header 1" }] },
							],
						},
						{
							type: "rich_text",
							elements: [
								{ type: "rich_text_section", elements: [{ text: "Header 2" }] },
							],
						},
					],
					[
						{
							type: "rich_text",
							elements: [
								{ type: "rich_text_section", elements: [{ text: "Cell 1" }] },
							],
						},
						{
							type: "rich_text",
							elements: [
								{ type: "rich_text_section", elements: [{ text: "Cell 2" }] },
							],
						},
					],
				],
			},
		]);
	});

	describe("Rich Text Elements (preferSectionBlocks: false)", () => {
		it("converts User Mentions", () => {
			const mkd = "<@U123456>";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [{ type: "user", user_id: "U123456" }],
					},
				],
			});
		});

		it("converts Team Mentions", () => {
			const mkd = "<!subteam^T123456>";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [{ type: "team", team_id: "T123456" }],
					},
				],
			});
		});

		it("converts Channels", () => {
			const mkd = "<#C123456>";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [{ type: "channel", channel_id: "C123456" }],
					},
				],
			});
		});

		it("converts Broadcasts", () => {
			const mkd = "<!here> <!channel> <!everyone>";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [
							{ type: "broadcast", range: "here" },
							{ type: "text", text: " " },
							{ type: "broadcast", range: "channel" },
							{ type: "text", text: " " },
							{ type: "broadcast", range: "everyone" },
						],
					},
				],
			});
		});

		it("converts Colors", () => {
			const mkd = "#FF0000";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [{ type: "color", value: "#FF0000" }],
					},
				],
			});
		});

		it("converts Dates", () => {
			// <!date^timestamp^format|fallback>
			const mkd = "<!date^1620000000^{date_short}|fallback>";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [
							{
								type: "date",
								timestamp: 1620000000,
								format: "{date_short}",
								// fallback omitted as per implementation logic
							},
						],
					},
				],
			});
		});

		it("converts Emojis", () => {
			const mkd = ":smile:";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [{ type: "emoji", name: "smile" }],
					},
				],
			});
		});

		it("keeps inline code mentions literal", () => {
			const mkd = "`<@U123>`";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [
							{ type: "text", text: "<@U123>", style: { code: true } },
						],
					},
				],
			});
		});

		it("handles mixed content correctly", () => {
			const mkd = "Hello <@U123> :wave:";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result[0]).toMatchObject({
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [
							{ type: "text", text: "Hello " },
							{ type: "user", user_id: "U123" },
							{ type: "text", text: " " },
							{ type: "emoji", name: "wave" },
						],
					},
				],
			});
		});
	});

	describe("Section Blocks with Mentions (preferSectionBlocks: true)", () => {
		it("transforms @user mentions with mapping", () => {
			const mkd = "Hello @jdoe!";
			const result = markdownToBlocks(mkd, {
				mentions: { users: { jdoe: "U12345" } },
			});
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Hello <@U12345>!",
				},
			});
		});

		it("leaves unmapped @mentions as-is", () => {
			const mkd = "Hello @unknown!";
			const result = markdownToBlocks(mkd);
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Hello @unknown!",
				},
			});
		});

		it("transforms #channel mentions with mapping", () => {
			const mkd = "Check out #general";
			const result = markdownToBlocks(mkd, {
				mentions: { channels: { general: "C12345" } },
			});
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Check out <#C12345>",
				},
			});
		});

		it("leaves unmapped #channel as-is", () => {
			const mkd = "Check out #unknown-channel";
			const result = markdownToBlocks(mkd);
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Check out #unknown-channel",
				},
			});
		});

		it("transforms @userGroup mentions with mapping", () => {
			const mkd = "Ping @devs please";
			const result = markdownToBlocks(mkd, {
				mentions: { userGroups: { devs: "S12345" } },
			});
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Ping <!subteam^S12345> please",
				},
			});
		});

		it("transforms @here, @channel, @everyone to broadcasts", () => {
			const mkd = "@here @channel @everyone";
			const result = markdownToBlocks(mkd);
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "<!here> <!channel> <!everyone>",
				},
			});
		});

		it("preserves already-formatted Slack mentions", () => {
			const mkd = "Hello <@U12345> and <#C67890>";
			const result = markdownToBlocks(mkd);
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Hello <@U12345> and <#C67890>",
				},
			});
		});

		it("preserves emojis in mrkdwn", () => {
			const mkd = "Hello :wave: there";
			const result = markdownToBlocks(mkd);
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Hello :wave: there",
				},
			});
		});

		it("preserves links in mrkdwn", () => {
			const mkd = "Check [this link](https://example.com)";
			const result = markdownToBlocks(mkd);
			expect(result[0]).toMatchObject({
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Check <https://example.com|this link>",
				},
			});
		});
	});

	it("processes fixture with options", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const fixturePath = path.resolve(__dirname, "fixtures/input.md");
		const mkd = fs.readFileSync(fixturePath, "utf-8");

		const options: MarkdownToBlocksOptions = {
			mentions: {
				users: {
					jdoe: "U123456",
				},
				channels: {
					general: "C123456",
				},
				userGroups: {
					devs: "S123456",
				},
				teams: {
					T123456: "T123456",
				},
			},
		};

		const result = markdownToBlocks(mkd, options);

		// Find the "Rich Text Elements" header to locate the list following it
		// The fixture structure:
		// ...
		// ## Rich Text Elements (Header)
		// - Bullet list (Rich Text List)

		let headerIndex = -1;
		for (let i = 0; i < result.length; i++) {
			const block = result[i];
			if (block.type === "header" && block.text.text === "Rich Text Elements") {
				headerIndex = i;
				break;
			}
		}

		expect(headerIndex).not.toBe(-1);
		const listBlock = result[headerIndex + 1];
		expect(listBlock.type).toBe("rich_text");

		// The list is inside the rich_text block
		// rich_text -> elements -> rich_text_list
		const listElement = (listBlock as any).elements.find(
			(e: any) => e?.type === "rich_text_list",
		);
		expect(listElement).toBeDefined();

		const items = listElement.elements; // Array of rich_text_section (list items)

		// 0: User: @jdoe
		expect(items[0].elements).toMatchObject([
			{ type: "text", text: "User: " },
			{ type: "user", user_id: "U123456" },
		]);

		// 1: Channel: #general
		expect(items[1].elements).toMatchObject([
			{ type: "text", text: "Channel: " },
			{ type: "channel", channel_id: "C123456" },
		]);

		// 2: Group: @devs
		expect(items[2].elements).toMatchObject([
			{ type: "text", text: "Group: " },
			{ type: "usergroup", usergroup_id: "S123456" },
		]);

		// 3: Broadcast: @here
		expect(items[3].elements).toMatchObject([
			{ type: "text", text: "Broadcast: " },
			{ type: "broadcast", range: "here" },
		]);

		// 4: Color: #ff0000
		expect(items[4].elements).toMatchObject([
			{ type: "text", text: "Color: " },
			{ type: "color", value: "#ff0000" },
		]);

		// 5: Team: @T123456
		expect(items[5].elements).toMatchObject([
			{ type: "text", text: "Team: " },
			{ type: "team", team_id: "T123456" },
		]);

		// 6: Unknown User: @unknown
		expect(items[6].elements).toMatchObject([
			{ type: "text", text: "Unknown User: " },
			{ type: "text", text: "@unknown" },
		]);

		// 7: Unknown Channel: #unknown
		expect(items[7].elements).toMatchObject([
			{ type: "text", text: "Unknown Channel: " },
			{ type: "text", text: "#unknown" },
		]);

		// 8: Unknown Group: @unknown_group
		expect(items[8].elements).toMatchObject([
			{ type: "text", text: "Unknown Group: " },
			{ type: "text", text: "@unknown_group" },
		]);

		// 9: Unknown Team: @unknown_team
		expect(items[9].elements).toMatchObject([
			{ type: "text", text: "Unknown Team: " },
			{ type: "text", text: "@unknown_team" },
		]);
	});

	describe("Format-wrapped lists", () => {
		it("converts bold-wrapped list items", () => {
			const mkd = "**1. Bold item**";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result).toMatchObject([
				{
					type: "rich_text",
					elements: [
						{
							type: "rich_text_list",
							style: "ordered",
							elements: [
								{
									type: "rich_text_section",
									elements: [{ type: "text", text: "Bold item", style: { bold: true } }],
								},
							],
						},
					],
				},
			]);
		});

		it("converts italic-wrapped list items", () => {
			const mkd = "*1. Italic item*";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result).toMatchObject([
				{
					type: "rich_text",
					elements: [
						{
							type: "rich_text_list",
							style: "ordered",
							elements: [
								{
									type: "rich_text_section",
									elements: [{ type: "text", text: "Italic item", style: { italic: true } }],
								},
							],
						},
					],
				},
			]);
		});

		it("converts strike-wrapped list items", () => {
			const mkd = "~1. Strike item~";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect(result).toMatchObject([
				{
					type: "rich_text",
					elements: [
						{
							type: "rich_text_list",
							style: "ordered",
							elements: [
								{
									type: "rich_text_section",
									elements: [{ type: "text", text: "Strike item", style: { strike: true } }],
								},
							],
						},
					],
				},
			]);
		});

		it("converts nested bold-wrapped list items", () => {
			const mkd = "- item 1\n  **- item 2**";
			const result = markdownToBlocks(mkd, { preferSectionBlocks: false });
			expect((result[0] as any).elements).toMatchObject([
				{
					type: "rich_text_list",
					indent: 0,
					elements: [{ type: "rich_text_section", elements: [{ text: "item 1" }] }],
				},
				{
					type: "rich_text_list",
					indent: 1,
					elements: [{ type: "rich_text_section", elements: [{ text: "item 2", style: { bold: true } }] }],
				},
			]);
		});
	});
});

import { describe, it, expect } from "vitest";
import { markdownToBlocks } from "../src/index";
import type { RichTextBlock } from "../src/types";

describe("Rich Text Mappings", () => {
	const options = {
		mentions: {
			users: {
				jdoe: "U12345",
				sally: "U67890",
			},
			channels: {
				general: "C00001",
				random: "C00002",
			},
			userGroups: {
				devs: "S99999",
			},
		},
		detectColors: true,
		preferSectionBlocks: false,
	};

	it("maps user mentions", () => {
		const result = markdownToBlocks("Hello @jdoe and @sally", options);
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "Hello " },
			{ type: "user", user_id: "U12345" },
			{ type: "text", text: " and " },
			{ type: "user", user_id: "U67890" },
		]);
	});

	it("ignores unknown user mentions", () => {
		const result = markdownToBlocks("Hello @unknown", options);
		// Expect split text nodes because parser tokenizes on @
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "Hello " },
			{ type: "text", text: "@unknown" },
		]);
	});

	it("falls back to text for unknown channels", () => {
		const result = markdownToBlocks("Join #unknown", options);
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "Join " },
			{ type: "text", text: "#unknown" },
		]);
	});

	it("falls back to text for unknown user groups", () => {
		const result = markdownToBlocks("cc @unknown_group", options);
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "cc " },
			{ type: "text", text: "@unknown_group" },
		]);
	});

	it("maps channel mentions", () => {
		const result = markdownToBlocks("Join #general", options);
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "Join " },
			{ type: "channel", channel_id: "C00001" },
		]);
	});

	it("maps user groups", () => {
		const result = markdownToBlocks("cc @devs", options);
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "cc " },
			{ type: "usergroup", usergroup_id: "S99999" },
		]);
	});

	it("maps broadcasts", () => {
		const result = markdownToBlocks("Hi @here and @channel", options);
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "Hi " },
			{ type: "broadcast", range: "here" },
			{ type: "text", text: " and " },
			{ type: "broadcast", range: "channel" },
		]);
	});

	it("maps colors", () => {
		const result = markdownToBlocks("Color #ff0000 is red", options);
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "text", text: "Color " },
			{ type: "color", value: "#ff0000" },
			{ type: "text", text: " is red" },
		]);
	});

	it("handles mixed content and styles", () => {
		const result = markdownToBlocks("**@jdoe** check #general", options);
		// Note: styles applied to mapping is implemented in parser via recursion
		expect((result[0] as RichTextBlock).elements[0].elements).toMatchObject([
			{ type: "user", user_id: "U12345", style: { bold: true } },
			{ type: "text", text: " check " },
			{ type: "channel", channel_id: "C00001" },
		]);
	});
});

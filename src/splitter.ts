import type {
	Block,
	BlocksToMarkdownOptions,
	HeaderBlock,
	ImageElement,
	PlainTextObject,
	RichTextBlock,
	RichTextElement,
	RichTextList,
	RichTextQuote,
	RichTextSection,
	RichTextSectionElement,
	RichTextStyle,
	RichTextPreformatted,
	SectionBlock,
	TextObject,
} from "./types";
import { validateBlocksToMarkdownOptions } from "./validator";

export interface SplitBlocksOptions {
	/** Maximum number of blocks per message. Default: 40 */
	maxBlocks?: number;
	/** Maximum JSON character count per message. Default: 12000 */
	maxCharacters?: number;
}

export interface SplitBlocksResult {
	text: string;
	blocks: Block[];
}

const DEFAULT_MAX_BLOCKS = 40;
const DEFAULT_MAX_CHARACTERS = 12000;
const DEFAULT_MAX_TEXT_SECTION_CHARACTERS = 3000;

/**
 * Splits an array of blocks into multiple arrays that fit within Slack's limits.
 * Attempts to split at natural boundaries (between top-level blocks, rich_text elements, etc.)
 *
 * @param blocks - Array of blocks from markdownToBlocks
 * @param options - Optional configuration for limits
 * @returns Array of block arrays, each fitting within the limits
 */
export function splitBlocks(
	blocks: Block[],
	options?: SplitBlocksOptions,
): Block[][] {
	const maxBlocks = options?.maxBlocks ?? DEFAULT_MAX_BLOCKS;
	const maxChars = options?.maxCharacters ?? DEFAULT_MAX_CHARACTERS;

	const normalizedBlocks: Block[] = [];
	for (const block of blocks) {
		if (block.type === "section") {
			normalizedBlocks.push(
				...splitSectionBlock(block, DEFAULT_MAX_TEXT_SECTION_CHARACTERS),
			);
		} else if (block.type === "header") {
			normalizedBlocks.push(
				...splitHeaderBlock(block, DEFAULT_MAX_TEXT_SECTION_CHARACTERS),
			);
		} else {
			normalizedBlocks.push(block);
		}
	}

	if (normalizedBlocks.length === 0) {
		return [[]];
	}

	// Check if everything fits in one message
	if (
		normalizedBlocks.length <= maxBlocks &&
		JSON.stringify(normalizedBlocks).length <= maxChars
	) {
		return [normalizedBlocks];
	}

	const result: Block[][] = [];
	let currentBatch: Block[] = [];

	const fitsInBatch = (batch: Block[], newBlock: Block): boolean => {
		if (batch.length + 1 > maxBlocks) return false;
		const newSize = JSON.stringify([...batch, newBlock]).length;
		return newSize <= maxChars;
	};

	const flushBatch = () => {
		if (currentBatch.length > 0) {
			result.push(currentBatch);
			currentBatch = [];
		}
	};

	for (const block of normalizedBlocks) {
		// Try to add block to current batch
		if (fitsInBatch(currentBatch, block)) {
			currentBatch.push(block);
			continue;
		}

		// Block doesn't fit - flush current batch first
		flushBatch();

		// Check if this single block fits on its own
		if (fitsInBatch([], block)) {
			currentBatch.push(block);
			continue;
		}

		// Single block is too large - try to split it
		if (block.type === "rich_text") {
			const splitRichText = splitLargeRichTextBlock(block, maxChars);

			for (const subBlock of splitRichText) {
				if (fitsInBatch(currentBatch, subBlock)) {
					currentBatch.push(subBlock);
				} else {
					flushBatch();
					currentBatch.push(subBlock);
				}
			}
		} else {
			// For non-rich_text blocks that are too large, we have to include them as-is
			// (tables, images, etc. can't really be split semantically)
			currentBatch.push(block);
		}
	}

	flushBatch();

	return result.length > 0 ? result : [[]];
}

/**
 * Splits blocks and also returns a plain-text fallback for each batch, suitable for postMessage `text`.
 */
export function splitBlocksWithText(
	blocks: Block[],
	options?: SplitBlocksOptions,
): SplitBlocksResult[] {
	const batches = splitBlocks(blocks, options);
	return batches.map((batch) => ({
		text: blocksToPlainText(batch),
		blocks: batch,
	}));
}

/**
 * Splits a large RichTextBlock into smaller RichTextBlocks by splitting its elements
 */
function splitLargeRichTextBlock(
	block: RichTextBlock,
	maxChars: number,
): RichTextBlock[] {
	const elements = block.elements;

	if (elements.length === 0) {
		return [block];
	}

	// First, try splitting by elements
	const elementBlocks = splitRichTextByElements(elements, maxChars);

	// If any single element is still too large, try to split it further
	const result: RichTextBlock[] = [];

	for (const elementBlock of elementBlocks) {
		const blockJson = JSON.stringify(elementBlock);
		if (blockJson.length <= maxChars) {
			result.push(elementBlock);
		} else {
			// Try to split individual elements (e.g., large code blocks)
			const furtherSplit = splitRichTextBlockElements(elementBlock, maxChars);
			result.push(...furtherSplit);
		}
	}

	return result;
}

/**
 * Splits rich_text elements into separate RichTextBlocks
 */
function splitRichTextByElements(
	elements: RichTextElement[],
	maxChars: number,
): RichTextBlock[] {
	const result: RichTextBlock[] = [];
	let currentElements: RichTextElement[] = [];

	const createBlock = (elems: RichTextElement[]): RichTextBlock => ({
		type: "rich_text",
		elements: elems,
	});

	for (const element of elements) {
		const testBlock = createBlock([...currentElements, element]);
		const testJson = JSON.stringify(testBlock);

		if (testJson.length <= maxChars) {
			currentElements.push(element);
		} else {
			// Flush current elements
			if (currentElements.length > 0) {
				result.push(createBlock(currentElements));
				currentElements = [];
			}
			// Add this element to a new batch
			currentElements.push(element);
		}
	}

	if (currentElements.length > 0) {
		result.push(createBlock(currentElements));
	}

	return result.length > 0 ? result : [createBlock([])];
}

/**
 * Attempts to split individual elements within a RichTextBlock (e.g., large code blocks)
 */
function splitRichTextBlockElements(
	block: RichTextBlock,
	maxChars: number,
): RichTextBlock[] {
	const result: RichTextBlock[] = [];

	for (const element of block.elements) {
		if (element.type === "rich_text_preformatted") {
			// Split large code blocks by lines
			const splitPreformatted = splitPreformattedElement(element, maxChars);
			for (const splitElem of splitPreformatted) {
				result.push({
					type: "rich_text",
					elements: [splitElem],
				});
			}
		} else {
			// For other element types, just wrap them as-is
			result.push({
				type: "rich_text",
				elements: [element],
			});
		}
	}

	return result.length > 0 ? result : [block];
}

/**
 * Splits a large preformatted (code) element by lines
 */
function splitPreformattedElement(
	element: RichTextPreformatted,
	maxChars: number,
): RichTextPreformatted[] {
	// Get the text content
	const textElements = element.elements.filter((e) => e.type === "text");
	if (textElements.length === 0) {
		return [element];
	}

	const fullText = textElements
		.map((e) => (e.type === "text" ? e.text : ""))
		.join("");
	const lines = fullText.split("\n");

	if (lines.length <= 1) {
		// Can't split further
		return [element];
	}

	const result: RichTextPreformatted[] = [];
	let currentLines: string[] = [];

	const createPreformatted = (text: string): RichTextPreformatted => ({
		type: "rich_text_preformatted",
		elements: [{ type: "text", text }],
		...(element.border !== undefined ? { border: element.border } : {}),
	});

	const estimateSize = (text: string): number => {
		return JSON.stringify(createPreformatted(text)).length;
	};

	for (const line of lines) {
		const testText = [...currentLines, line].join("\n");

		if (estimateSize(testText) <= maxChars) {
			currentLines.push(line);
		} else {
			// Flush current lines
			if (currentLines.length > 0) {
				result.push(createPreformatted(currentLines.join("\n")));
				currentLines = [];
			}
			// Start new batch with this line
			currentLines.push(line);
		}
	}

	// Flush remaining
	if (currentLines.length > 0) {
		result.push(createPreformatted(currentLines.join("\n")));
	}

	return result.length > 0 ? result : [element];
}

/**
 * Splits a large SectionBlock into multiple SectionBlocks if text exceeds limit
 */
function splitSectionBlock(
	block: SectionBlock,
	maxChars: number,
): SectionBlock[] {
	const text = block.text;

	if (!text || text.text.length <= maxChars) {
		return [block];
	}

	const chunks = chunkString(text.text, maxChars);
	const result: SectionBlock[] = [];

	// The first block keeps the accessory and fields, subsequent ones are just text
	chunks.forEach((chunk, index) => {
		const newBlock: SectionBlock = {
			type: "section",
			text: {
				...text,
				text: chunk,
			},
			...(block.block_id && index === 0 ? { block_id: block.block_id } : {}),
		};

		if (index === 0) {
			if (block.fields) newBlock.fields = block.fields;
			if (block.accessory) newBlock.accessory = block.accessory;
			// keep block_id only on first? Yes.
		}

		result.push(newBlock);
	});

	return result;
}

/**
 * Splits a large HeaderBlock into multiple HeaderBlocks (or Header + Sections) if text exceeds limit
 * Note: Headers are plain_text only.
 */
function splitHeaderBlock(block: HeaderBlock, maxChars: number): Block[] {
	if (block.text.text.length <= maxChars) {
		return [block];
	}

	const chunks = chunkString(block.text.text, maxChars);
	const result: Block[] = [];

	// First chunk remains a header
	result.push({
		type: "header",
		text: {
			...block.text,
			text: chunks[0],
		},
		...(block.block_id ? { block_id: block.block_id } : {}),
	});

	// Subsequent chunks become Section blocks
	for (let i = 1; i < chunks.length; i++) {
		result.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: chunks[i],
			},
		});
	}

	return result;
}

/**
 * Helper to chunk string by character limit, trying to respect word boundaries
 */
function chunkString(str: string, limit: number): string[] {
	const chunks: string[] = [];
	let current = str;

	while (current.length > 0) {
		if (current.length <= limit) {
			chunks.push(current);
			break;
		}

		// Take a slice of 'limit'
		let sliceIndex = limit;

		// Look for last newline within the safety zone (e.g. last 100 chars or just within the limit)
		// We look backwards from limit.
		const newlineIndex = current.lastIndexOf("\n", limit);
		if (newlineIndex !== -1 && newlineIndex > 0) {
			sliceIndex = newlineIndex; // Split AT newline (newline becomes part of first chunk? or consumed?)
			// Usually split at newline means: "Line 1\nLine 2" -> "Line 1", "Line 2".
			// slice(0, index) excludes index.
			// We want to keep the newline structure?
			// If we split "A\nB", chunk 1 "A", chunk 2 "B".
			// So sliceIndex = newlineIndex.
			// And next start = newlineIndex + 1.
			chunks.push(current.slice(0, sliceIndex));
			current = current.slice(sliceIndex + 1);
			continue;
		}

		// Look for last space
		const spaceIndex = current.lastIndexOf(" ", limit);
		if (spaceIndex !== -1 && spaceIndex > limit * 0.8) {
			// Only split at space if it's somewhat close to the end, to avoid too short lines?
			// Actually, any space is better than mid-word.
			sliceIndex = spaceIndex;
			chunks.push(current.slice(0, sliceIndex));
			current = current.slice(sliceIndex + 1); // Skip the space
			continue;
		}

		// Hard split
		chunks.push(current.slice(0, limit));
		current = current.slice(limit);
	}

	return chunks;
}

/**
 * Renders a block array back into best-effort Markdown.
 */
export function blocksToMarkdown(
	blocks: Block[],
	options?: BlocksToMarkdownOptions,
): string {
	validateBlocksToMarkdownOptions(options);

	const parts: string[] = [];

	for (const block of blocks) {
		const rendered = renderBlockAsMarkdown(block, options).trim();
		if (rendered) parts.push(rendered);
	}

	return parts.join("\n\n");
}

function renderBlockAsMarkdown(
	block: Block,
	options?: BlocksToMarkdownOptions,
): string {
	switch (block.type) {
		case "section":
			return renderSectionBlockAsMarkdown(block, options);
		case "header":
			return `# ${block.text.text}`;
		case "context":
			return block.elements
				.map((element) =>
					element.type === "image"
						? renderImageElementAsMarkdown(element)
						: renderTextObjectAsMarkdown(element, options),
				)
				.filter(Boolean)
				.join(" ");
		case "rich_text":
			return renderRichTextBlockAsMarkdown(block, options);
		case "divider":
			return "---";
		case "image":
			return renderImageBlockAsMarkdown(block);
		case "table":
			return renderTableBlockAsMarkdown(block, options);
		default:
			return "";
	}
}

function renderSectionBlockAsMarkdown(
	block: SectionBlock,
	options?: BlocksToMarkdownOptions,
): string {
	const parts: string[] = [];

	const text = renderTextObjectAsMarkdown(block.text, options);
	if (text) parts.push(text);

	if (block.fields?.length) {
		const renderedFields = block.fields
			.map((field) => renderTextObjectAsMarkdown(field, options))
			.filter(Boolean)
			.join("\n");
		if (renderedFields) parts.push(renderedFields);
	}

	if (isImageElement(block.accessory)) {
		parts.push(renderImageElementAsMarkdown(block.accessory));
	}

	return parts.join("\n\n");
}

function renderTextObjectAsMarkdown(
	text?: TextObject | PlainTextObject,
	options?: BlocksToMarkdownOptions,
): string {
	if (!text) return "";
	return text.type === "mrkdwn"
		? convertMrkdwnToMarkdown(text.text, options)
		: text.text;
}

function renderRichTextBlockAsMarkdown(
	block: RichTextBlock,
	options?: BlocksToMarkdownOptions,
): string {
	const heading = renderRichTextHeadingAsMarkdown(block);
	if (heading) return heading;

	const rendered = block.elements
		.map((element) => renderRichTextElementAsMarkdown(element, options))
		.filter(
			(part): part is RenderedRichTextElement => part.markdown.length > 0,
		);

	if (rendered.length === 0) return "";

	let markdown = rendered[0].markdown;
	for (let index = 1; index < rendered.length; index++) {
		const previous = rendered[index - 1];
		const current = rendered[index];
		const separator =
			previous.kind === "list" && current.kind === "list" ? "\n" : "\n\n";
		markdown += separator + current.markdown;
	}

	return markdown;
}

function renderRichTextHeadingAsMarkdown(block: RichTextBlock): string {
	if (block.elements.length !== 1) return "";

	const [element] = block.elements;
	if (element.type !== "rich_text_section" || element.elements.length !== 1) {
		return "";
	}

	const [textElement] = element.elements;
	if (
		textElement.type !== "text" ||
		!textElement.style?.bold ||
		textElement.style.italic ||
		textElement.style.strike ||
		textElement.style.code
	) {
		return "";
	}

	return `### ${textElement.text}`;
}

type RenderedRichTextElement = {
	kind: "section" | "list" | "preformatted" | "quote";
	markdown: string;
};

function renderRichTextElementAsMarkdown(
	element: RichTextElement,
	options?: BlocksToMarkdownOptions,
): RenderedRichTextElement {
	switch (element.type) {
		case "rich_text_section":
			return {
				kind: "section",
				markdown: renderRichTextSectionAsMarkdown(element, options),
			};
		case "rich_text_list":
			return {
				kind: "list",
				markdown: renderRichTextListAsMarkdown(element, options),
			};
		case "rich_text_preformatted":
			return {
				kind: "preformatted",
				markdown: renderRichTextPreformattedAsMarkdown(element, options),
			};
		case "rich_text_quote":
			return {
				kind: "quote",
				markdown: renderRichTextQuoteAsMarkdown(element, options),
			};
		default:
			return {
				kind: "section",
				markdown: "",
			};
	}
}

function renderRichTextSectionAsMarkdown(
	section: RichTextSection,
	options?: BlocksToMarkdownOptions,
): string {
	return section.elements
		.map((element) => renderRichTextSectionElementAsMarkdown(element, options))
		.join("");
}

function renderRichTextListAsMarkdown(
	list: RichTextList,
	options?: BlocksToMarkdownOptions,
): string {
	const indentUnit = list.style === "ordered" ? "   " : "  ";
	const indent = indentUnit.repeat(list.indent ?? 0);
	const start = list.offset ?? 1;

	return list.elements
		.map((item, index) => {
			const marker = list.style === "ordered" ? `${start + index}. ` : "- ";
			const content = renderRichTextSectionAsMarkdown(item, options);
			return indentMultilineMarkdown(`${indent}${marker}`, content);
		})
		.join("\n");
}

function renderRichTextPreformattedAsMarkdown(
	element: RichTextPreformatted,
	options?: BlocksToMarkdownOptions,
): string {
	const text = element.elements
		.map((item) => renderRichTextSectionElementAsMarkdown(item, options))
		.join("");
	return wrapFencedCodeBlock(text);
}

function renderRichTextQuoteAsMarkdown(
	element: RichTextQuote,
	options?: BlocksToMarkdownOptions,
): string {
	return renderRichTextSectionAsMarkdown(
		{
			type: "rich_text_section",
			elements: element.elements,
		},
		options,
	)
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n");
}

function renderRichTextSectionElementAsMarkdown(
	element: RichTextSectionElement,
	options?: BlocksToMarkdownOptions,
): string {
	switch (element.type) {
		case "text":
			return applyMarkdownStyle(element.text, element.style);
		case "link": {
			const content =
				element.text && element.text.length > 0
					? `[${element.text}](<${element.url}>)`
					: element.url;
			return applyMarkdownStyle(content, element.style);
		}
		case "emoji":
			return applyMarkdownStyle(`:${element.name}:`, element.style);
		case "date": {
			const fallback =
				element.fallback ?? new Date(element.timestamp * 1000).toISOString();
			const content = `<!date^${element.timestamp}^${element.format}|${fallback}>`;
			return applyMarkdownStyle(content, element.style);
		}
		case "user":
			return applyMarkdownStyle(
				renderUserMentionAsMarkdown(element.user_id, options),
				element.style,
			);
		case "usergroup":
			return applyMarkdownStyle(
				renderUserGroupMentionAsMarkdown(element.usergroup_id, options),
				element.style,
			);
		case "team":
			return applyMarkdownStyle(
				renderTeamMentionAsMarkdown(element.team_id, options),
				element.style,
			);
		case "channel":
			return applyMarkdownStyle(
				renderChannelMentionAsMarkdown(element.channel_id, options),
				element.style,
			);
		case "broadcast":
			return applyMarkdownStyle(`<!${element.range}>`, element.style);
		case "color":
			return applyMarkdownStyle(element.value, element.style);
		default:
			return "";
	}
}

function renderImageBlockAsMarkdown(block: {
	image_url: string;
	alt_text: string;
	title?: PlainTextObject;
}): string {
	const title = block.title?.text
		? ` "${block.title.text.replace(/"/g, '\\"')}"`
		: "";
	return `![${block.alt_text}](<${block.image_url}>${title})`;
}

function renderImageElementAsMarkdown(element: ImageElement): string {
	return `![${element.alt_text}](<${element.image_url}>)`;
}

function renderTableBlockAsMarkdown(
	block: Extract<Block, { type: "table" }>,
	options?: BlocksToMarkdownOptions,
): string {
	if (block.rows.length === 0 || block.rows[0].length === 0) {
		return "";
	}

	const rows = block.rows.map(
		(row) =>
			`| ${row.map((cell) => renderTableCellAsMarkdown(cell, options)).join(" | ")} |`,
	);
	const separator = `| ${block.rows[0].map(() => "---").join(" | ")} |`;

	return [rows[0], separator, ...rows.slice(1)].join("\n");
}

function renderTableCellAsMarkdown(
	cell: RichTextBlock,
	options?: BlocksToMarkdownOptions,
): string {
	return renderRichTextBlockAsMarkdown(cell, options)
		.replace(/\|/g, "\\|")
		.replace(/\n/g, "\\n");
}

function applyMarkdownStyle(text: string, style?: RichTextStyle): string {
	if (!style) return text;

	let result = text;
	if (style.code) {
		result = wrapInlineCode(result);
	}
	if (style.bold) {
		result = `**${result}**`;
	}
	if (style.italic) {
		result = `*${result}*`;
	}
	if (style.strike) {
		result = `~${result}~`;
	}
	return result;
}

function wrapInlineCode(text: string): string {
	const fence = getBacktickFence(text, 1);
	return `${fence}${text}${fence}`;
}

function wrapFencedCodeBlock(text: string): string {
	const fence = getBacktickFence(text, 3);
	return `${fence}\n${text}\n${fence}`;
}

function getBacktickFence(text: string, minimumLength: number): string {
	const runs = text.match(/`+/g);
	const longestRun =
		runs?.reduce((max, run) => Math.max(max, run.length), 0) ?? 0;
	return "`".repeat(Math.max(minimumLength, longestRun + 1));
}

function indentMultilineMarkdown(prefix: string, text: string): string {
	const lines = text.split("\n");
	if (lines.length === 0) return prefix.trimEnd();

	const continuation = " ".repeat(prefix.length);
	return lines
		.map((line, index) =>
			index === 0 ? `${prefix}${line}` : `${continuation}${line}`,
		)
		.join("\n");
}

function convertMrkdwnToMarkdown(
	text: string,
	options?: BlocksToMarkdownOptions,
): string {
	let result = "";

	for (let index = 0; index < text.length; index++) {
		const character = text[index];

		if (character === "`") {
			const closingIndex = text.indexOf("`", index + 1);
			if (closingIndex !== -1) {
				result += wrapInlineCode(text.slice(index + 1, closingIndex));
				index = closingIndex;
				continue;
			}
		}

		if (character === "<") {
			const closingIndex = text.indexOf(">", index + 1);
			if (closingIndex !== -1) {
				result += convertAngleBracketTokenToMarkdown(
					text.slice(index, closingIndex + 1),
					options,
				);
				index = closingIndex;
				continue;
			}
		}

		if (isMrkdwnStyleMarker(character) && isValidMrkdwnStyleOpen(text, index)) {
			const closingIndex = findClosingMrkdwnStyleMarker(text, index);
			if (closingIndex !== -1) {
				const inner = convertMrkdwnToMarkdown(
					text.slice(index + 1, closingIndex),
					options,
				);
				result += wrapConvertedMrkdwnStyle(character, inner);
				index = closingIndex;
				continue;
			}
		}

		result += character;
	}

	return result;
}

function convertAngleBracketTokenToMarkdown(
	token: string,
	options?: BlocksToMarkdownOptions,
): string {
	const userMatch = token.match(/^<@([\w.-]+)>$/);
	if (userMatch) {
		return renderUserMentionAsMarkdown(userMatch[1], options);
	}

	const channelMatch = token.match(/^<#([\w.-]+)>$/);
	if (channelMatch) {
		return renderChannelMentionAsMarkdown(channelMatch[1], options);
	}

	const subteamMatch = token.match(/^<!subteam\^([\w.-]+)>$/);
	if (subteamMatch) {
		const subteamId = subteamMatch[1];
		return subteamId.startsWith("S")
			? renderUserGroupMentionAsMarkdown(subteamId, options)
			: renderTeamMentionAsMarkdown(subteamId, options);
	}

	if (token.startsWith("<!")) {
		return token;
	}

	const formattedLinkMatch = token.match(/^<([^|>]+)\|(.+)>$/);
	if (formattedLinkMatch) {
		const [, url, label] = formattedLinkMatch;
		return `[${convertMrkdwnToMarkdown(label, options)}](<${url}>)`;
	}

	const autoLinkMatch = token.match(/^<([^>]+)>$/);
	if (autoLinkMatch) {
		return autoLinkMatch[1];
	}

	return token;
}

function isMrkdwnStyleMarker(character: string): character is "*" | "_" | "~" {
	return character === "*" || character === "_" || character === "~";
}

function isValidMrkdwnStyleOpen(text: string, index: number): boolean {
	const previous = text[index - 1];
	const next = text[index + 1];
	return isMrkdwnBoundary(previous) && !isWhitespace(next);
}

function isValidMrkdwnStyleClose(text: string, index: number): boolean {
	const previous = text[index - 1];
	const next = text[index + 1];
	return !isWhitespace(previous) && isMrkdwnBoundary(next);
}

function findClosingMrkdwnStyleMarker(
	text: string,
	openingIndex: number,
): number {
	const marker = text[openingIndex];

	for (let index = openingIndex + 1; index < text.length; index++) {
		const character = text[index];

		if (character === "`") {
			const closingIndex = text.indexOf("`", index + 1);
			if (closingIndex === -1) return -1;
			index = closingIndex;
			continue;
		}

		if (character === "<") {
			const closingIndex = text.indexOf(">", index + 1);
			if (closingIndex === -1) return -1;
			index = closingIndex;
			continue;
		}

		if (character === marker && isValidMrkdwnStyleClose(text, index)) {
			return index;
		}
	}

	return -1;
}

function wrapConvertedMrkdwnStyle(
	marker: "*" | "_" | "~",
	text: string,
): string {
	if (marker === "*") return `**${text}**`;
	if (marker === "_") return `*${text}*`;
	return `~${text}~`;
}

function isMrkdwnBoundary(character: string | undefined): boolean {
	if (character === undefined) return true;
	return /[\s.,!?;:()[\]{}"'<>/-]/.test(character);
}

function isWhitespace(character: string | undefined): boolean {
	return character !== undefined && /\s/.test(character);
}

function renderUserMentionAsMarkdown(
	userId: string,
	options?: BlocksToMarkdownOptions,
): string {
	return renderNamedMention(
		options?.mentions?.users?.[userId] ??
			options?.mentions?.userGroups?.[userId] ??
			options?.mentions?.teams?.[userId],
		`<@${userId}>`,
	);
}

function renderChannelMentionAsMarkdown(
	channelId: string,
	options?: BlocksToMarkdownOptions,
): string {
	return renderNamedMention(
		options?.mentions?.channels?.[channelId],
		`<#${channelId}>`,
		"#",
	);
}

function renderUserGroupMentionAsMarkdown(
	userGroupId: string,
	options?: BlocksToMarkdownOptions,
): string {
	return renderNamedMention(
		options?.mentions?.userGroups?.[userGroupId],
		`<!subteam^${userGroupId}>`,
	);
}

function renderTeamMentionAsMarkdown(
	teamId: string,
	options?: BlocksToMarkdownOptions,
): string {
	return renderNamedMention(
		options?.mentions?.teams?.[teamId],
		`<!subteam^${teamId}>`,
	);
}

function renderNamedMention(
	name: string | undefined,
	fallback: string,
	prefix = "@",
): string {
	return name ? `${prefix}${name}` : fallback;
}

function isImageElement(element: unknown): element is ImageElement {
	if (!element || typeof element !== "object") return false;

	const accessory = element as Partial<ImageElement>;
	return (
		accessory.type === "image" &&
		typeof accessory.image_url === "string" &&
		typeof accessory.alt_text === "string"
	);
}

/**
 * Generates a lightweight plain-text fallback from a block batch.
 */
export function blocksToPlainText(blocks: Block[]): string {
	const parts: string[] = [];

	const renderTextObject = (text?: TextObject | PlainTextObject): string =>
		text?.text ?? "";

	const renderRichTextSectionElement = (
		element: RichTextSectionElement,
	): string => {
		switch (element.type) {
			case "text":
				return element.text;
			case "link":
				return element.text ?? element.url;
			case "emoji":
				return `:${element.name}:`;
			case "date":
				return (
					element.fallback ?? new Date(element.timestamp * 1000).toISOString()
				);
			case "user":
				return `<@${element.user_id}>`;
			case "usergroup":
				return `<!subteam^${element.usergroup_id}>`;
			case "team":
				return `<team:${element.team_id}>`;
			case "channel":
				return `<#${element.channel_id}>`;
			case "broadcast":
				return element.range === "here"
					? `<!here>`
					: element.range === "channel"
						? `<!channel>`
						: `<!everyone>`;
			case "color":
				return element.value;
			default:
				return "";
		}
	};

	const renderRichTextElement = (element: RichTextElement): string => {
		switch (element.type) {
			case "rich_text_section":
				return element.elements
					.map(renderRichTextSectionElement)
					.filter(Boolean)
					.join("");
			case "rich_text_list":
				return element.elements
					.map((item, idx) => {
						const marker =
							element.style === "ordered"
								? `${(element.offset ?? 1) + idx}. `
								: "- ";
						return (
							marker + item.elements.map(renderRichTextSectionElement).join("")
						);
					})
					.join("\n");
			case "rich_text_preformatted":
				return element.elements.map(renderRichTextSectionElement).join("");
			case "rich_text_quote":
				return element.elements
					.map(renderRichTextSectionElement)
					.map((line) => `> ${line}`)
					.join("\n");
			default:
				return "";
		}
	};

	const renderRichTextBlock = (block: RichTextBlock): string => {
		return block.elements.map(renderRichTextElement).filter(Boolean).join("\n");
	};

	const renderBlock = (block: Block): string => {
		switch (block.type) {
			case "section":
				return renderTextObject(block.text);
			case "header":
				return renderTextObject(block.text);
			case "context":
				return block.elements
					.map((el) => (el as TextObject).text ?? "")
					.filter(Boolean)
					.join(" ");
			case "rich_text":
				return renderRichTextBlock(block);
			case "divider":
				return "---";
			case "image":
				return block.title?.text ?? block.alt_text ?? "Image";
			case "table":
				return block.rows
					.map((row) => row.map(renderRichTextBlock).join(" | "))
					.join("\n");
			default:
				return "";
		}
	};

	for (const block of blocks) {
		const rendered = renderBlock(block).trim();
		if (rendered) parts.push(rendered);
	}

	return parts.join("\n\n");
}

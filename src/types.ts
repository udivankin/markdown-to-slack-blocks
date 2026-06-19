export type Block =
	| SectionBlock
	| HeaderBlock
	| ImageBlock
	| ContextBlock
	| DividerBlock
	| RichTextBlock
	| TableBlock
	| DataTableBlock;

export interface SectionBlock {
	type: "section";
	text?: TextObject;
	fields?: TextObject[];
	accessory?: SectionAccessory;
	block_id?: string;
}

// Narrow accessory away from any; allow known image elements plus typed fallbacks for other Block Kit accessories.
export type SectionAccessory =
	| ImageElement
	| { type: string; [key: string]: unknown };

export interface HeaderBlock {
	type: "header";
	text: PlainTextObject;
	block_id?: string;
}

export interface ImageBlock {
	type: "image";
	image_url: string;
	alt_text: string;
	title?: PlainTextObject;
	block_id?: string;
}

export interface ContextBlock {
	type: "context";
	elements: (ImageElement | TextObject)[];
	block_id?: string;
}

export interface DividerBlock {
	type: "divider";
	block_id?: string;
}

export interface RichTextBlock {
	type: "rich_text";
	elements: RichTextElement[];
	block_id?: string;
}

export type RichTextElement =
	| RichTextSection
	| RichTextList
	| RichTextPreformatted
	| RichTextQuote;

export interface RichTextSection {
	type: "rich_text_section";
	elements: RichTextSectionElement[];
}

export interface RichTextList {
	type: "rich_text_list";
	style: "bullet" | "ordered";
	indent?: number;
	offset?: number;
	border?: number;
	elements: RichTextSection[];
}

export interface RichTextPreformatted {
	type: "rich_text_preformatted";
	elements: RichTextSectionElement[];
	border?: number;
}

export interface RichTextQuote {
	type: "rich_text_quote";
	elements: RichTextSectionElement[];
	border?: number;
}

export type RichTextSectionElement =
	| RichTextText
	| RichTextLink
	| RichTextEmoji
	| RichTextDate
	| RichTextUser
	| RichTextUserGroup
	| RichTextTeam
	| RichTextChannel
	| RichTextBroadcast
	| RichTextColor;

export interface RichTextText {
	type: "text";
	text: string;
	style?: RichTextStyle;
}

export interface RichTextLink {
	type: "link";
	url: string;
	text?: string;
	unsafe?: boolean;
	style?: RichTextStyle;
}

export interface RichTextEmoji {
	type: "emoji";
	name: string;
	unicode?: string;
	style?: RichTextStyle;
}

export interface RichTextDate {
	type: "date";
	timestamp: number;
	format: string;
	url?: string;
	fallback?: string;
	style?: RichTextStyle;
}

export interface RichTextUser {
	type: "user";
	user_id: string;
	style?: RichTextStyle;
}

export interface RichTextUserGroup {
	type: "usergroup";
	usergroup_id: string;
	style?: RichTextStyle;
}

export interface RichTextTeam {
	type: "team";
	team_id: string;
	style?: RichTextStyle;
}

export interface RichTextChannel {
	type: "channel";
	channel_id: string;
	style?: RichTextStyle;
}

export interface RichTextBroadcast {
	type: "broadcast";
	range: "here" | "channel" | "everyone";
	style?: RichTextStyle;
}

export interface RichTextColor {
	type: "color";
	value: string;
	style?: RichTextStyle;
}

export interface RichTextStyle {
	bold?: boolean;
	italic?: boolean;
	strike?: boolean;
	code?: boolean;
}

export interface TableBlock {
	type: "table";
	columns?: { width?: number }[];
	rows: RichTextBlock[][]; // Rows are arrays of cells, where each cell is a RichTextBlock
	block_id?: string;
}

// TableRow and TableCell interfaces are replaced by direct structure in TableBlock

/**
 * Slack's native `data_table` block. Unlike the legacy `table` block, each cell
 * is dynamically typed based on its content:
 * - `raw_text` for plain, unstyled text
 * - `raw_number` for purely numeric values (enables Slack's number formatting/sorting)
 * - `rich_text` for anything with styling, links, mentions, emoji, etc.
 */
export interface DataTableBlock {
	type: "data_table";
	caption?: string;
	rows: DataTableCell[][];
	block_id?: string;
}

export type DataTableCell = RawTextCell | RawNumberCell | RichTextBlock;

export interface RawTextCell {
	type: "raw_text";
	text: string;
}

export interface RawNumberCell {
	type: "raw_number";
	value: number;
	text: string;
}

export interface TextObject {
	type: "mrkdwn" | "plain_text";
	text: string;
	emoji?: boolean;
	verbatim?: boolean;
}

export interface PlainTextObject {
	type: "plain_text";
	text: string;
	emoji?: boolean;
}

export interface ImageElement {
	type: "image";
	image_url: string;
	alt_text: string;
}

export interface MarkdownToBlocksOptions {
	mentions?: {
		users?: Record<string, string>; // username -> User ID
		channels?: Record<string, string>; // channel name -> Channel ID
		userGroups?: Record<string, string>; // group name -> User Group ID
		teams?: Record<string, string>; // team name -> Team ID
	};
	detectColors?: boolean; // Default true
	preferSectionBlocks?: boolean; // Default true - use section blocks for simple paragraphs
	/**
	 * Which block type to emit for Markdown tables.
	 * - `"data_table"` (default): Slack's native data table; cell types are chosen
	 *   dynamically per cell (`raw_text`, `raw_number`, or `rich_text`).
	 * - `"table"`: legacy table block where every cell is a `rich_text` block.
	 */
	tableBlockType?: "data_table" | "table";
	/**
	 * Caption applied to generated `data_table` blocks. Defaults to "Data table".
	 * Pass an empty string to omit the caption entirely.
	 */
	tableCaption?: string;
}

export interface BlocksToMarkdownOptions {
	mentions?: {
		users?: Record<string, string>; // User ID -> username
		channels?: Record<string, string>; // Channel ID -> channel name
		userGroups?: Record<string, string>; // User Group ID -> group name
		teams?: Record<string, string>; // Team ID -> team name
	};
}

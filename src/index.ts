import { parseMarkdown } from "./parser";
import type { MarkdownToBlocksOptions } from "./types";
import { validateOptions } from "./validator";

// Re-export types for consumers
export * from "./types";
export {
	blocksToPlainText,
	splitBlocks,
	splitBlocksWithText,
	SplitBlocksOptions,
	SplitBlocksResult,
} from "./splitter";

export function markdownToBlocks(
	markdown: string,
	options?: MarkdownToBlocksOptions,
) {
	validateOptions(options);
	return parseMarkdown(markdown, options);
}

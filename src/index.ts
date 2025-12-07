import { parseMarkdown } from './parser';
import { MarkdownToBlocksOptions } from './types';
import { validateOptions } from './validator';

// Re-export types for consumers
export * from './types';
export { splitBlocks, SplitBlocksOptions } from './splitter';

export function markdownToBlocks(markdown: string, options?: MarkdownToBlocksOptions) {
    validateOptions(options);
    return parseMarkdown(markdown, options);
}

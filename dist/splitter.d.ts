import { Block } from './types';
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
/**
 * Splits an array of blocks into multiple arrays that fit within Slack's limits.
 * Attempts to split at natural boundaries (between top-level blocks, rich_text elements, etc.)
 *
 * @param blocks - Array of blocks from markdownToBlocks
 * @param options - Optional configuration for limits
 * @returns Array of block arrays, each fitting within the limits
 */
export declare function splitBlocks(blocks: Block[], options?: SplitBlocksOptions): Block[][];
/**
 * Splits blocks and also returns a plain-text fallback for each batch, suitable for postMessage `text`.
 */
export declare function splitBlocksWithText(blocks: Block[], options?: SplitBlocksOptions): SplitBlocksResult[];
//# sourceMappingURL=splitter.d.ts.map
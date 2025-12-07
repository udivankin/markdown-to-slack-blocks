import {
    Block,
    RichTextBlock,
    RichTextElement,
    RichTextPreformatted,
} from './types';

export interface SplitBlocksOptions {
    /** Maximum number of blocks per message. Default: 40 */
    maxBlocks?: number;
    /** Maximum JSON character count per message. Default: 12000 */
    maxCharacters?: number;
}

const DEFAULT_MAX_BLOCKS = 40;
const DEFAULT_MAX_CHARACTERS = 12000;

/**
 * Splits an array of blocks into multiple arrays that fit within Slack's limits.
 * Attempts to split at natural boundaries (between top-level blocks, rich_text elements, etc.)
 * 
 * @param blocks - Array of blocks from markdownToBlocks
 * @param options - Optional configuration for limits
 * @returns Array of block arrays, each fitting within the limits
 */
export function splitBlocks(blocks: Block[], options?: SplitBlocksOptions): Block[][] {
    const maxBlocks = options?.maxBlocks ?? DEFAULT_MAX_BLOCKS;
    const maxChars = options?.maxCharacters ?? DEFAULT_MAX_CHARACTERS;

    if (blocks.length === 0) {
        return [[]];
    }

    // Check if everything fits in one message
    if (blocks.length <= maxBlocks && JSON.stringify(blocks).length <= maxChars) {
        return [blocks];
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

    for (const block of blocks) {
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
        if (block.type === 'rich_text') {
            const splitRichText = splitLargeRichTextBlock(block, maxBlocks, maxChars);
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
 * Splits a large RichTextBlock into smaller RichTextBlocks by splitting its elements
 */
function splitLargeRichTextBlock(block: RichTextBlock, maxBlocks: number, maxChars: number): RichTextBlock[] {
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
function splitRichTextByElements(elements: RichTextElement[], maxChars: number): RichTextBlock[] {
    const result: RichTextBlock[] = [];
    let currentElements: RichTextElement[] = [];

    const createBlock = (elems: RichTextElement[]): RichTextBlock => ({
        type: 'rich_text',
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
function splitRichTextBlockElements(block: RichTextBlock, maxChars: number): RichTextBlock[] {
    const result: RichTextBlock[] = [];

    for (const element of block.elements) {
        if (element.type === 'rich_text_preformatted') {
            // Split large code blocks by lines
            const splitPreformatted = splitPreformattedElement(element, maxChars);
            for (const splitElem of splitPreformatted) {
                result.push({
                    type: 'rich_text',
                    elements: [splitElem],
                });
            }
        } else {
            // For other element types, just wrap them as-is
            result.push({
                type: 'rich_text',
                elements: [element],
            });
        }
    }

    return result.length > 0 ? result : [block];
}

/**
 * Splits a large preformatted (code) element by lines
 */
function splitPreformattedElement(element: RichTextPreformatted, maxChars: number): RichTextPreformatted[] {
    // Get the text content
    const textElements = element.elements.filter(e => e.type === 'text');
    if (textElements.length === 0) {
        return [element];
    }

    const fullText = textElements.map(e => e.type === 'text' ? e.text : '').join('');
    const lines = fullText.split('\n');

    if (lines.length <= 1) {
        // Can't split further
        return [element];
    }

    const result: RichTextPreformatted[] = [];
    let currentLines: string[] = [];

    const createPreformatted = (text: string): RichTextPreformatted => ({
        type: 'rich_text_preformatted',
        elements: [{ type: 'text', text }],
        ...(element.border !== undefined ? { border: element.border } : {}),
    });

    const estimateSize = (text: string): number => {
        return JSON.stringify(createPreformatted(text)).length;
    };

    for (const line of lines) {
        const testText = [...currentLines, line].join('\n');

        if (estimateSize(testText) <= maxChars) {
            currentLines.push(line);
        } else {
            // Flush current lines
            if (currentLines.length > 0) {
                result.push(createPreformatted(currentLines.join('\n')));
                currentLines = [];
            }
            // Start new batch with this line
            currentLines.push(line);
        }
    }

    // Flush remaining
    if (currentLines.length > 0) {
        result.push(createPreformatted(currentLines.join('\n')));
    }

    return result.length > 0 ? result : [element];
}

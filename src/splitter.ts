import {
    Block,
    RichTextBlock,
    RichTextElement,
    RichTextSectionElement,
    RichTextPreformatted,
    SectionBlock,
    HeaderBlock,
    TextObject,
    PlainTextObject,
} from './types';

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
export function splitBlocks(blocks: Block[], options?: SplitBlocksOptions): Block[][] {
    const maxBlocks = options?.maxBlocks ?? DEFAULT_MAX_BLOCKS;
    const maxChars = options?.maxCharacters ?? DEFAULT_MAX_CHARACTERS;

    const normalizedBlocks: Block[] = [];
    for (const block of blocks) {
        if (block.type === 'section') {
            normalizedBlocks.push(...splitSectionBlock(block, DEFAULT_MAX_TEXT_SECTION_CHARACTERS));
        } else if (block.type === 'header') {
            normalizedBlocks.push(...splitHeaderBlock(block, DEFAULT_MAX_TEXT_SECTION_CHARACTERS));
        } else {
            normalizedBlocks.push(block);
        }
    }

    if (normalizedBlocks.length === 0) {
        return [[]];
    }

    // Check if everything fits in one message
    if (normalizedBlocks.length <= maxBlocks && JSON.stringify(normalizedBlocks).length <= maxChars) {
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
 * Splits blocks and also returns a plain-text fallback for each batch, suitable for postMessage `text`.
 */
export function splitBlocksWithText(blocks: Block[], options?: SplitBlocksOptions): SplitBlocksResult[] {
    const batches = splitBlocks(blocks, options);
    return batches.map(batch => ({
        text: blocksToPlainText(batch),
        blocks: batch,
    }));
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

/**
 * Splits a large SectionBlock into multiple SectionBlocks if text exceeds limit
 */
function splitSectionBlock(block: SectionBlock, maxChars: number): SectionBlock[] {
    if (!block.text || block.text.text.length <= maxChars) {
        return [block];
    }

    const chunks = chunkString(block.text.text, maxChars);
    const result: SectionBlock[] = [];

    // The first block keeps the accessory and fields, subsequent ones are just text
    chunks.forEach((chunk, index) => {
        const newBlock: SectionBlock = {
            type: 'section',
            text: {
                ...block.text!,
                text: chunk
            },
            ...(block.block_id && index === 0 ? { block_id: block.block_id } : {})
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
        type: 'header',
        text: {
            ...block.text,
            text: chunks[0]
        },
        ...(block.block_id ? { block_id: block.block_id } : {})
    });

    // Subsequent chunks become Section blocks
    for (let i = 1; i < chunks.length; i++) {
        result.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: chunks[i]
            }
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
        const newlineIndex = current.lastIndexOf('\n', limit);
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
        const spaceIndex = current.lastIndexOf(' ', limit);
        if (spaceIndex !== -1 && spaceIndex > limit * 0.8) { // Only split at space if it's somewhat close to the end, to avoid too short lines?
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
 * Generates a lightweight plain-text fallback from a block batch.
 */
function blocksToPlainText(blocks: Block[]): string {
    const parts: string[] = [];

    const renderTextObject = (text?: TextObject | PlainTextObject): string => text?.text ?? '';

    const renderRichTextSectionElement = (element: RichTextSectionElement): string => {
        switch (element.type) {
            case 'text':
                return element.text;
            case 'link':
                return element.text ?? element.url;
            case 'emoji':
                return `:${element.name}:`;
            case 'date':
                return element.fallback ?? new Date(element.timestamp * 1000).toISOString();
            case 'user':
                return `<@${element.user_id}>`;
            case 'usergroup':
                return `<!subteam^${element.usergroup_id}>`;
            case 'team':
                return `<team:${element.team_id}>`;
            case 'channel':
                return `<#${element.channel_id}>`;
            case 'broadcast':
                return element.range === 'here' ? `<!here>` : element.range === 'channel' ? `<!channel>` : `<!everyone>`;
            case 'color':
                return element.value;
            default:
                return '';
        }
    };

    const renderRichTextElement = (element: RichTextElement): string => {
        switch (element.type) {
            case 'rich_text_section':
                return element.elements.map(renderRichTextSectionElement).filter(Boolean).join('');
            case 'rich_text_list':
                return element.elements
                    .map((item, idx) => {
                        const marker = element.style === 'ordered' ? `${(element.offset ?? 1) + idx}. ` : '- ';
                        return marker + item.elements.map(renderRichTextSectionElement).join('');
                    })
                    .join('\n');
            case 'rich_text_preformatted':
                return element.elements.map(renderRichTextSectionElement).join('');
            case 'rich_text_quote':
                return element.elements.map(renderRichTextSectionElement).map(line => `> ${line}`).join('\n');
            default:
                return '';
        }
    };

    const renderRichTextBlock = (block: RichTextBlock): string => {
        return block.elements.map(renderRichTextElement).filter(Boolean).join('\n');
    };

    const renderBlock = (block: Block): string => {
        switch (block.type) {
            case 'section':
                return renderTextObject(block.text);
            case 'header':
                return renderTextObject(block.text);
            case 'context':
                return block.elements
                    .map(el => (el as TextObject).text ?? '')
                    .filter(Boolean)
                    .join(' ');
            case 'rich_text':
                return renderRichTextBlock(block);
            case 'divider':
                return '---';
            case 'image':
                return block.title?.text ?? block.alt_text ?? 'Image';
            case 'table':
                return block.rows
                    .map(row => row.map(renderRichTextBlock).join(' | '))
                    .join('\n');
            default:
                return '';
        }
    };

    for (const block of blocks) {
        const rendered = renderBlock(block).trim();
        if (rendered) parts.push(rendered);
    }

    return parts.join('\n\n');
}

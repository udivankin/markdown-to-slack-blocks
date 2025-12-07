import { describe, it, expect } from 'vitest';
import { splitBlocks } from '../src/splitter';
import { Block, RichTextBlock } from '../src/types';

describe('splitBlocks', () => {
    // Helper to create a simple rich_text block
    const createRichTextBlock = (text: string): RichTextBlock => ({
        type: 'rich_text',
        elements: [{
            type: 'rich_text_section',
            elements: [{ type: 'text', text }]
        }]
    });

    // Helper to create a code block
    const createCodeBlock = (code: string): RichTextBlock => ({
        type: 'rich_text',
        elements: [{
            type: 'rich_text_preformatted',
            elements: [{ type: 'text', text: code }]
        }]
    });

    describe('basic functionality', () => {
        it('returns single array with empty input', () => {
            const result = splitBlocks([]);
            expect(result).toEqual([[]]);
        });

        it('returns single array when under limits', () => {
            const blocks: Block[] = [
                createRichTextBlock('Hello'),
                createRichTextBlock('World'),
            ];
            const result = splitBlocks(blocks);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(blocks);
        });

        it('returns blocks unchanged when exactly at block limit', () => {
            const blocks: Block[] = Array(40).fill(null).map((_, i) =>
                createRichTextBlock(`Block ${i}`)
            );
            const result = splitBlocks(blocks);
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveLength(40);
        });
    });

    describe('block count splitting', () => {
        it('splits when exceeding block count limit', () => {
            const blocks: Block[] = Array(50).fill(null).map((_, i) =>
                createRichTextBlock(`Block ${i}`)
            );
            const result = splitBlocks(blocks);
            expect(result.length).toBeGreaterThan(1);
            // Each batch should have at most 40 blocks
            for (const batch of result) {
                expect(batch.length).toBeLessThanOrEqual(40);
            }
            // Total blocks should equal original
            const totalBlocks = result.reduce((sum, batch) => sum + batch.length, 0);
            expect(totalBlocks).toBe(50);
        });

        it('respects custom maxBlocks option', () => {
            const blocks: Block[] = Array(15).fill(null).map((_, i) =>
                createRichTextBlock(`Block ${i}`)
            );
            const result = splitBlocks(blocks, { maxBlocks: 5 });
            expect(result).toHaveLength(3);
            expect(result[0]).toHaveLength(5);
            expect(result[1]).toHaveLength(5);
            expect(result[2]).toHaveLength(5);
        });
    });

    describe('character limit splitting', () => {
        it('splits when exceeding character limit', () => {
            // Create blocks that will exceed 12k chars
            const longText = 'x'.repeat(3000);
            const blocks: Block[] = Array(10).fill(null).map(() =>
                createRichTextBlock(longText)
            );
            const result = splitBlocks(blocks);
            expect(result.length).toBeGreaterThan(1);
            // Each batch should be under the character limit
            for (const batch of result) {
                expect(JSON.stringify(batch).length).toBeLessThanOrEqual(12000);
            }
        });

        it('respects custom maxCharacters option', () => {
            const blocks: Block[] = [
                createRichTextBlock('Hello'),
                createRichTextBlock('World'),
                createRichTextBlock('Test'),
            ];
            // Set a very low character limit
            const result = splitBlocks(blocks, { maxCharacters: 200 });
            expect(result.length).toBeGreaterThanOrEqual(1);
            for (const batch of result) {
                expect(JSON.stringify(batch).length).toBeLessThanOrEqual(200);
            }
        });
    });

    describe('rich_text element splitting', () => {
        it('splits large rich_text blocks by elements', () => {
            // Create a rich_text block with multiple elements
            const largeBlock: RichTextBlock = {
                type: 'rich_text',
                elements: Array(10).fill(null).map((_, i) => ({
                    type: 'rich_text_section',
                    elements: [{ type: 'text', text: 'x'.repeat(2000) }]
                }))
            };
            const result = splitBlocks([largeBlock], { maxCharacters: 5000 });
            expect(result.length).toBeGreaterThan(1);
            // All results should be rich_text blocks
            for (const batch of result) {
                for (const block of batch) {
                    expect(block.type).toBe('rich_text');
                }
            }
        });
    });

    describe('code block splitting', () => {
        it('splits large code blocks by lines', () => {
            // Create a code block with many lines
            const lines = Array(100).fill('const x = 1;').join('\n');
            const codeBlock = createCodeBlock(lines);

            const result = splitBlocks([codeBlock], { maxCharacters: 500 });
            expect(result.length).toBeGreaterThan(1);

            // Verify each batch contains preformatted content
            for (const batch of result) {
                expect(batch.length).toBeGreaterThan(0);
                const block = batch[0] as RichTextBlock;
                expect(block.type).toBe('rich_text');
                expect(block.elements[0].type).toBe('rich_text_preformatted');
            }
        });
    });

    describe('mixed content', () => {
        it('handles mixed block types', () => {
            const blocks: Block[] = [
                { type: 'header', text: { type: 'plain_text', text: 'Title' } },
                createRichTextBlock('Paragraph'),
                { type: 'divider' },
                createCodeBlock('const x = 1;'),
                { type: 'image', image_url: 'https://example.com/img.png', alt_text: 'Image' }
            ];
            const result = splitBlocks(blocks);
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveLength(5);
        });

        it('preserves block order after splitting', () => {
            const blocks: Block[] = Array(60).fill(null).map((_, i) =>
                createRichTextBlock(`Block ${i}`)
            );
            const result = splitBlocks(blocks);

            let index = 0;
            for (const batch of result) {
                for (const block of batch) {
                    const richText = block as RichTextBlock;
                    const section = richText.elements[0];
                    if (section.type === 'rich_text_section') {
                        const textEl = section.elements[0];
                        if (textEl.type === 'text') {
                            expect(textEl.text).toBe(`Block ${index}`);
                        }
                    }
                    index++;
                }
            }
            expect(index).toBe(60);
        });
    });

    describe('edge cases', () => {
        it('handles single oversized non-rich_text block', () => {
            // Tables can't really be split, so they go through as-is
            const largeTable: Block = {
                type: 'table',
                rows: Array(100).fill(null).map(() => [
                    { type: 'rich_text', elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text: 'Cell' }] }] }
                ])
            };
            const result = splitBlocks([largeTable], { maxCharacters: 500 });
            // Should still include the block even if oversized
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result.some(batch => batch.some(b => b.type === 'table'))).toBe(true);
        });
    });
});

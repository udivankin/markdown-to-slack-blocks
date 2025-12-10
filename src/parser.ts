import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import {
    Block,
    SectionBlock,
    RichTextBlock,
    RichTextElement,
    RichTextSectionElement,
    RichTextList,
    MarkdownToBlocksOptions,
    RichTextStyle,
    RichTextText
} from './types';

export function parseMarkdown(markdown: string, options: MarkdownToBlocksOptions = {}): Block[] {
    const ast = fromMarkdown(markdown, {
        extensions: [gfm()],
        mdastExtensions: [gfmFromMarkdown()],
    });
    const blocks: Block[] = [];
    let currentRichTextElements: RichTextElement[] = [];

    const flushRichText = () => {
        if (currentRichTextElements.length > 0) {
            blocks.push({
                type: 'rich_text',
                elements: [...currentRichTextElements],
            });
            currentRichTextElements = [];
        }
    };

    for (const node of ast.children) {
        if (node.type === 'heading') {
            flushRichText();
            const text = toString(node);
            if (node.depth <= 2) {
                blocks.push({
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: text,
                    },
                });
            } else {
                // H3+ headings use section blocks when preferSectionBlocks is enabled
                if (options.preferSectionBlocks !== false) {
                    blocks.push({
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*${inlineNodesToMrkdwn(node.children, options)}*`,
                        },
                    });
                } else {
                    blocks.push({
                        type: 'rich_text',
                        elements: [
                            {
                                type: 'rich_text_section',
                                elements: [{ type: 'text', text: text, style: { bold: true } }],
                            },
                        ],
                    });
                }
            }
        } else if (node.type === 'paragraph') {
            if (node.children.length === 1 && node.children[0].type === 'image') {
                flushRichText();
                const imageNode = node.children[0];
                blocks.push({
                    type: 'image',
                    image_url: imageNode.url,
                    alt_text: imageNode.alt || 'Image',
                });
            } else {
                // Use section blocks for paragraphs when preferSectionBlocks is enabled (default)
                if (options.preferSectionBlocks !== false) {
                    flushRichText();
                    blocks.push({
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: inlineNodesToMrkdwn(node.children, options),
                        },
                    });
                } else {
                    currentRichTextElements.push({
                        type: 'rich_text_section',
                        elements: node.children.flatMap((child: any) => mapInlineNode(child, options)),
                    });
                }
            }
        } else if (node.type === 'list') {
            // Helper function to recursively process lists with proper indentation
            const processList = (listNode: any, indent: number): RichTextList[] => {
                const results: RichTextList[] = [];
                const currentListItems: { type: 'rich_text_section'; elements: RichTextSectionElement[] }[] = [];

                for (const listItem of listNode.children) {
                    // Process the paragraph content of this list item
                    const paragraphElements: RichTextSectionElement[] = listItem.children
                        .filter((child: any) => child.type === 'paragraph')
                        .flatMap((child: any) => child.children.flatMap((c: any) => mapInlineNode(c, options)));

                    if (paragraphElements.length > 0) {
                        currentListItems.push({
                            type: 'rich_text_section',
                            elements: paragraphElements,
                        });
                    }

                    // Process any nested lists (recursively)
                    const nestedLists = listItem.children.filter((child: any) => child.type === 'list');
                    if (nestedLists.length > 0) {
                        // First, push the current list with items collected so far
                        if (currentListItems.length > 0) {
                            results.push({
                                type: 'rich_text_list',
                                style: listNode.ordered ? 'ordered' : 'bullet',
                                indent,
                                elements: [...currentListItems],
                            });
                            currentListItems.length = 0; // Clear the array
                        }

                        // Process each nested list
                        for (const nestedList of nestedLists) {
                            results.push(...processList(nestedList, indent + 1));
                        }
                    }
                }

                // Push any remaining items
                if (currentListItems.length > 0) {
                    results.push({
                        type: 'rich_text_list',
                        style: listNode.ordered ? 'ordered' : 'bullet',
                        indent,
                        elements: currentListItems,
                    });
                }

                return results;
            };

            const listElements = processList(node, 0);
            for (const listElement of listElements) {
                currentRichTextElements.push(listElement);
            }
            // Start a new rich_text block after each top-level list for visual separation
            flushRichText();
        } else if (node.type === 'code') {
            currentRichTextElements.push({
                type: 'rich_text_preformatted',
                elements: [{ type: 'text', text: node.value }],
            });
            // Start a new rich_text block after code blocks for visual separation
            flushRichText();
        } else if (node.type === 'blockquote') {
            currentRichTextElements.push({
                type: 'rich_text_quote',
                elements: node.children
                    .flatMap((child: any) => {
                        if (child.type === 'paragraph') {
                            return child.children.flatMap((c: any) => mapInlineNode(c, options));
                        }
                        return [];
                    })
            });
            // Start a new rich_text block after blockquotes for visual separation
            flushRichText();
        } else if (node.type === 'thematicBreak') {
            flushRichText();
            blocks.push({ type: 'divider' });
        } else if (node.type === 'image') {
            flushRichText();
            blocks.push({
                type: 'image',
                image_url: node.url,
                alt_text: node.alt || 'Image',
            });
        } else if (node.type === 'table') {
            flushRichText();
            const rows: RichTextBlock[][] = node.children.map((row: any) => {
                return row.children.map((cell: any) => {
                    return {
                        type: 'rich_text',
                        elements: [
                            {
                                type: 'rich_text_section',
                                elements: cell.children.flatMap((c: any) => mapInlineNode(c, options)),
                            },
                        ],
                    };
                });
            });
            blocks.push({
                type: 'table',
                rows: rows,
            });
        } else if (node.type === 'html') {
            // Handle top-level HTML blocks (e.g. Slack specific tags like <!date...> starting a line)
            currentRichTextElements.push({
                type: 'rich_text_section',
                elements: processTextNode(node.value, {}, options),
            });
        }
    }

    flushRichText();
    return blocks;
}

function mapInlineNode(node: any, options: MarkdownToBlocksOptions): RichTextSectionElement[] {
    if (node.type === 'text' || node.type === 'html') {
        // Pass empty object for style, processTextNode will handle it (and not attach if empty)
        return processTextNode(node.value, {}, options);
    } else if (node.type === 'emphasis') {
        return flattenStyles(node.children, { italic: true }, options);
    } else if (node.type === 'strong') {
        return flattenStyles(node.children, { bold: true }, options);
    } else if (node.type === 'delete') {
        return flattenStyles(node.children, { strike: true }, options);
    } else if (node.type === 'inlineCode') {
        // inlineCode is text with code style
        return processTextNode(node.value, { code: true }, options);
    } else if (node.type === 'link') {
        return [{
            type: 'link',
            url: node.url,
            text: toString(node),
        }];
    } else if (node.type === 'image') {
        return [{
            type: 'link',
            url: node.url,
            text: node.alt || 'Image',
        }];
    }
    return [];
}


function flattenStyles(children: any[], style: RichTextStyle, options: MarkdownToBlocksOptions): RichTextSectionElement[] {
    const elements = children.flatMap(c => mapInlineNode(c, options));
    return elements.map(el => {
        const mergedStyle = { ...el.style, ...style };
        // If the resulting style object is empty, do not attach it
        if (Object.keys(mergedStyle).length > 0) {
            return { ...el, style: mergedStyle };
        }
        // If it was empty before and we're not adding anything (shouldn't happen here if style has keys), just return
        const { style: _, ...rest } = el;
        return rest;
    });
}

function processTextNode(text: string, style: RichTextStyle, options: MarkdownToBlocksOptions): RichTextSectionElement[] {
    // Do not parse mentions/colors inside code-styled text; treat as literal.
    if (style.code) {
        const literal: RichTextText = { type: 'text', text };
        if (Object.keys(style).length > 0) {
            literal.style = style;
        }
        return [literal];
    }
    // Regex for:
    // 1. Broadcast: <!here> | <!channel> | <!everyone>
    // 2. Mention: <@U...>
    // 3. Color: #123456
    // 4. Channel: <#C...>
    // 5. Team: <!subteam^T...>
    // 6. Date: <!date^timestamp^format|fallback> (simple approx)
    // 7. Emoji: :shortcode:
    // 8. Mapped Mention: @name
    // 9. Mapped Channel: #name

    // Groups:
    // 1. Broadcast: (<!here>|<!channel>|<!everyone>)
    // 2. Mention: (<@([\w.-]+)>)
    // 3. Color: (#[0-9a-fA-F]{6})
    // 4. Channel: (<#([\w.-]+)>)
    // 5. Team: (<!subteam\^([\w.-]+)>)
    // 6. Date: (<!date\^(\d+)\^([^|]+)\|([^>]+)>)
    // 7. Emoji: (:([\w+-]+):)
    // 8. Mapped Mention: (@([\w.-]+))
    // 9. Mapped Channel: (#([\w.-]+))

    const regex = /(<!here>|<!channel>|<!everyone>)|(<@([\w.-]+)>)|(#[0-9a-fA-F]{6})|(<#([\w.-]+)>)|(<!subteam\^([\w.-]+)>)|(<!date\^(\d+)\^([^|]+)\|([^>]+)>)|(:([\w+-]+):)|(@([\w.-]+))|(#([\w.-]+))/g;

    const elements: RichTextSectionElement[] = [];
    let lastIndex = 0;
    let match;

    const addText = (t: string) => {
        if (!t) return;
        const el: RichTextText = { type: 'text', text: t };
        if (Object.keys(style).length > 0) {
            el.style = style;
        }
        elements.push(el);
    };

    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        const index = match.index;

        if (index > lastIndex) {
            addText(text.substring(lastIndex, index));
        }

        // Apply style if it exists
        const withStyle = (obj: any) => {
            if (Object.keys(style).length > 0) {
                return { ...obj, style };
            }
            return obj;
        };

        if (match[1]) { // Broadcast: <!here>
            const range = match[1].substring(2, match[1].length - 1) as 'here' | 'channel' | 'everyone';
            elements.push(withStyle({ type: 'broadcast', range }));

        } else if (match[3]) { // Mention: <@ID>
            const userId = match[3];
            elements.push(withStyle({ type: 'user', user_id: userId }));

        } else if (match[4]) { // Color: #Hex
            if (options.detectColors !== false) {
                elements.push(withStyle({ type: 'color', value: match[4] }));
            } else {
                addText(fullMatch);
            }

        } else if (match[6]) { // Channel: <#ID>
            const channelId = match[6];
            elements.push(withStyle({ type: 'channel', channel_id: channelId }));

        } else if (match[8]) { // Team: <!subteam^ID>
            const teamId = match[8];
            elements.push(withStyle({ type: 'team', team_id: teamId }));

        } else if (match[10]) { // Date: <!date^...|...>
            const timestamp = parseInt(match[10], 10);
            const format = match[11];
            // match[12] is fallback
            elements.push(withStyle({
                type: 'date',
                timestamp,
                format,
            }));

        } else if (match[13]) { // Emoji: :name:
            const name = match[14];
            elements.push(withStyle({ type: 'emoji', name }));

        } else if (match[15]) { // Mapped Mention: @name
            const name = match[16];
            let mapped = false;

            // 1. Check Broadcasts from plain text (@here, @channel, @everyone)
            if (['here', 'channel', 'everyone'].includes(name)) {
                elements.push(withStyle({ type: 'broadcast', range: name as 'here' | 'channel' | 'everyone' }));
                mapped = true;
            }
            // 2. Check Users
            else if (options.mentions?.users && options.mentions.users[name]) {
                elements.push(withStyle({ type: 'user', user_id: options.mentions.users[name] }));
                mapped = true;
            }
            // 3. Check User Groups
            else if (options.mentions?.userGroups && options.mentions.userGroups[name]) {
                elements.push(withStyle({ type: 'usergroup', usergroup_id: options.mentions.userGroups[name] }));
                mapped = true;
            }
            // 4. Check Teams
            else if (options.mentions?.teams && options.mentions.teams[name]) {
                elements.push(withStyle({ type: 'team', team_id: options.mentions.teams[name] }));
                mapped = true;
            }

            if (!mapped) {
                addText(fullMatch);
            }

        } else if (match[17]) { // Mapped Channel: #name
            const name = match[18];
            let mapped = false;

            if (options.mentions?.channels && options.mentions.channels[name]) {
                elements.push(withStyle({ type: 'channel', channel_id: options.mentions.channels[name] }));
                mapped = true;
            }

            if (!mapped) {
                addText(fullMatch);
            }
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        addText(text.substring(lastIndex));
    }

    return elements;
}

/**
 * Convert inline markdown nodes to Slack mrkdwn format (text string).
 * Used for section blocks where we need mrkdwn text instead of rich_text elements.
 */
function inlineNodesToMrkdwn(nodes: any[], options: MarkdownToBlocksOptions): string {
    return nodes.map((node: any) => inlineNodeToMrkdwn(node, options)).join('');
}

function inlineNodeToMrkdwn(node: any, options: MarkdownToBlocksOptions): string {
    if (node.type === 'text') {
        return convertTextToMrkdwn(node.value, options);
    } else if (node.type === 'html') {
        // HTML nodes like <!date...> are passed through as-is
        return node.value;
    } else if (node.type === 'emphasis') {
        const inner = inlineNodesToMrkdwn(node.children, options);
        return `_${inner}_`;
    } else if (node.type === 'strong') {
        const inner = inlineNodesToMrkdwn(node.children, options);
        return `*${inner}*`;
    } else if (node.type === 'delete') {
        const inner = inlineNodesToMrkdwn(node.children, options);
        return `~${inner}~`;
    } else if (node.type === 'inlineCode') {
        return `\`${node.value}\``;
    } else if (node.type === 'link') {
        const text = toString(node);
        return `<${node.url}|${text}>`;
    } else if (node.type === 'image') {
        return `<${node.url}|${node.alt || 'Image'}>`;
    }
    return '';
}

/**
 * Convert text to mrkdwn format, transforming mentions where mappings exist.
 * For mentions not in the map, they are left as-is (e.g., @alex stays @alex).
 */
function convertTextToMrkdwn(text: string, options: MarkdownToBlocksOptions): string {
    // Regex to find:
    // 1. Broadcast: <!here> | <!channel> | <!everyone>
    // 2. Mention: <@ID>
    // 3. Channel: <#ID>
    // 4. Team: <!subteam^ID>
    // 5. Date: <!date^timestamp^format|fallback>
    // 6. Emoji: :shortcode:
    // 7. Mapped Mention: @name
    // 8. Mapped Channel: #name (only transform if in map or hex color)

    const regex = /(<!here>|<!channel>|<!everyone>)|(<@([\w.-]+)>)|(#[0-9a-fA-F]{6})|(<#([\w.-]+)>)|(<!subteam\^([\w.-]+)>)|(<!date\^(\d+)\^([^|]+)\|([^>]+)>)|(:([\w+-]+):)|(@([\w.-]+))|(#([\w.-]+))/g;

    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        const index = match.index;

        // Add text before the match
        if (index > lastIndex) {
            result += text.substring(lastIndex, index);
        }

        if (match[1]) { // Broadcast: <!here>
            // Already in Slack format
            result += fullMatch;

        } else if (match[3]) { // Mention: <@ID>
            // Already in Slack format
            result += fullMatch;

        } else if (match[4]) { // Color: #Hex - leave as-is (not a channel)
            result += fullMatch;

        } else if (match[6]) { // Channel: <#ID>
            // Already in Slack format
            result += fullMatch;

        } else if (match[8]) { // Team: <!subteam^ID>
            // Already in Slack format
            result += fullMatch;

        } else if (match[10]) { // Date: <!date^...|...>
            // Already in Slack format
            result += fullMatch;

        } else if (match[13]) { // Emoji: :name:
            // Already in Slack format
            result += fullMatch;

        } else if (match[15]) { // Mapped Mention: @name
            const name = match[16];

            // 1. Check Broadcasts (@here, @channel, @everyone)
            if (['here', 'channel', 'everyone'].includes(name)) {
                result += `<!${name}>`;
            }
            // 2. Check Users
            else if (options.mentions?.users && options.mentions.users[name]) {
                result += `<@${options.mentions.users[name]}>`;
            }
            // 3. Check User Groups
            else if (options.mentions?.userGroups && options.mentions.userGroups[name]) {
                result += `<!subteam^${options.mentions.userGroups[name]}>`;
            }
            // 4. Check Teams
            else if (options.mentions?.teams && options.mentions.teams[name]) {
                result += `<!subteam^${options.mentions.teams[name]}>`;
            }
            // 5. Not found - leave as-is
            else {
                result += fullMatch;
            }

        } else if (match[17]) { // Mapped Channel: #name
            const name = match[18];

            if (options.mentions?.channels && options.mentions.channels[name]) {
                result += `<#${options.mentions.channels[name]}>`;
            } else {
                // Not found - leave as-is
                result += fullMatch;
            }
        }

        lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        result += text.substring(lastIndex);
    }

    return result;
}

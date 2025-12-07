"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMarkdown = parseMarkdown;
const mdast_util_from_markdown_1 = require("mdast-util-from-markdown");
const mdast_util_to_string_1 = require("mdast-util-to-string");
const micromark_extension_gfm_1 = require("micromark-extension-gfm");
const mdast_util_gfm_1 = require("mdast-util-gfm");
function parseMarkdown(markdown, options = {}) {
    const ast = (0, mdast_util_from_markdown_1.fromMarkdown)(markdown, {
        extensions: [(0, micromark_extension_gfm_1.gfm)()],
        mdastExtensions: [(0, mdast_util_gfm_1.gfmFromMarkdown)()],
    });
    const blocks = [];
    let currentRichTextElements = [];
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
            const text = (0, mdast_util_to_string_1.toString)(node);
            if (node.depth <= 2) {
                blocks.push({
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: text,
                    },
                });
            }
            else {
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
        else if (node.type === 'paragraph') {
            if (node.children.length === 1 && node.children[0].type === 'image') {
                flushRichText();
                const imageNode = node.children[0];
                blocks.push({
                    type: 'image',
                    image_url: imageNode.url,
                    alt_text: imageNode.alt || 'Image',
                });
            }
            else {
                currentRichTextElements.push({
                    type: 'rich_text_section',
                    elements: node.children.flatMap((child) => mapInlineNode(child, options)),
                });
            }
        }
        else if (node.type === 'list') {
            // Helper function to recursively process lists with proper indentation
            const processList = (listNode, indent) => {
                const results = [];
                const currentListItems = [];
                for (const listItem of listNode.children) {
                    // Process the paragraph content of this list item
                    const paragraphElements = listItem.children
                        .filter((child) => child.type === 'paragraph')
                        .flatMap((child) => child.children.flatMap((c) => mapInlineNode(c, options)));
                    if (paragraphElements.length > 0) {
                        currentListItems.push({
                            type: 'rich_text_section',
                            elements: paragraphElements,
                        });
                    }
                    // Process any nested lists (recursively)
                    const nestedLists = listItem.children.filter((child) => child.type === 'list');
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
        }
        else if (node.type === 'code') {
            currentRichTextElements.push({
                type: 'rich_text_preformatted',
                elements: [{ type: 'text', text: node.value }],
            });
        }
        else if (node.type === 'blockquote') {
            currentRichTextElements.push({
                type: 'rich_text_quote',
                elements: node.children
                    .flatMap((child) => {
                    if (child.type === 'paragraph') {
                        return child.children.flatMap((c) => mapInlineNode(c, options));
                    }
                    return [];
                })
            });
        }
        else if (node.type === 'thematicBreak') {
            flushRichText();
            blocks.push({ type: 'divider' });
        }
        else if (node.type === 'image') {
            flushRichText();
            blocks.push({
                type: 'image',
                image_url: node.url,
                alt_text: node.alt || 'Image',
            });
        }
        else if (node.type === 'table') {
            flushRichText();
            const rows = node.children.map((row) => {
                return row.children.map((cell) => {
                    return {
                        type: 'rich_text',
                        elements: [
                            {
                                type: 'rich_text_section',
                                elements: cell.children.flatMap((c) => mapInlineNode(c, options)),
                            },
                        ],
                    };
                });
            });
            blocks.push({
                type: 'table',
                rows: rows,
            });
        }
        else if (node.type === 'html') {
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
function mapInlineNode(node, options) {
    // console.log('Node:', node.type, node.value || node);
    if (node.type === 'text' || node.type === 'html') {
        // Pass empty object for style, processTextNode will handle it (and not attach if empty)
        return processTextNode(node.value, {}, options);
    }
    else if (node.type === 'emphasis') {
        return flattenStyles(node.children, { italic: true }, options);
    }
    else if (node.type === 'strong') {
        return flattenStyles(node.children, { bold: true }, options);
    }
    else if (node.type === 'delete') {
        return flattenStyles(node.children, { strike: true }, options);
    }
    else if (node.type === 'inlineCode') {
        // inlineCode is text with code style
        return processTextNode(node.value, { code: true }, options);
    }
    else if (node.type === 'link') {
        return [{
                type: 'link',
                url: node.url,
                text: (0, mdast_util_to_string_1.toString)(node),
            }];
    }
    else if (node.type === 'image') {
        return [{
                type: 'link',
                url: node.url,
                text: node.alt || 'Image',
            }];
    }
    return [];
}
function flattenStyles(children, style, options) {
    const elements = children.flatMap(c => mapInlineNode(c, options));
    return elements.map(el => {
        const mergedStyle = { ...el.style, ...style };
        // If the resulting style object is empty, do not attach it
        if (Object.keys(mergedStyle).length > 0) {
            return { ...el, style: mergedStyle };
        }
        // If it was empty before and we're not adding anything (shouldn't happen here if style has keys), just return
        // But if el.style was undefined and style is {}, we want undefined.
        // Logic: if mergedStyle has keys, use it. Else, if el had style, keep it? No, we want to flatten.
        // Actually, if we merge {bold: true} with {}, we get {bold: true}.
        // If we merge {} with {}, we get {}. We want to avoid {}.
        const { style: _, ...rest } = el;
        return rest;
    });
}
function processTextNode(text, style, options) {
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
    // Note: JS Regex stateful global matching
    // We need to capture everything carefully.
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
    const elements = [];
    let lastIndex = 0;
    let match;
    const addText = (t) => {
        if (!t)
            return;
        const el = { type: 'text', text: t };
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
        const withStyle = (obj) => {
            if (Object.keys(style).length > 0) {
                return { ...obj, style };
            }
            return obj;
        };
        if (match[1]) { // Broadcast: <!here>
            const range = match[1].substring(2, match[1].length - 1);
            elements.push(withStyle({ type: 'broadcast', range }));
        }
        else if (match[3]) { // Mention: <@ID>
            const userId = match[3];
            elements.push(withStyle({ type: 'user', user_id: userId }));
        }
        else if (match[4]) { // Color: #Hex
            if (options.detectColors !== false) {
                elements.push(withStyle({ type: 'color', value: match[4] }));
            }
            else {
                addText(fullMatch);
            }
        }
        else if (match[6]) { // Channel: <#ID>
            const channelId = match[6];
            elements.push(withStyle({ type: 'channel', channel_id: channelId }));
        }
        else if (match[8]) { // Team: <!subteam^ID>
            const teamId = match[8];
            elements.push(withStyle({ type: 'team', team_id: teamId }));
        }
        else if (match[10]) { // Date: <!date^...|...>
            const timestamp = parseInt(match[10], 10);
            const format = match[11];
            // match[12] is fallback
            elements.push(withStyle({
                type: 'date',
                timestamp,
                format,
            }));
        }
        else if (match[13]) { // Emoji: :name:
            const name = match[14];
            elements.push(withStyle({ type: 'emoji', name }));
        }
        else if (match[15]) { // Mapped Mention: @name
            const name = match[16];
            let mapped = false;
            // 1. Check Broadcasts from plain text (@here, @channel, @everyone)
            if (['here', 'channel', 'everyone'].includes(name)) {
                elements.push(withStyle({ type: 'broadcast', range: name }));
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
        }
        else if (match[17]) { // Mapped Channel: #name
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

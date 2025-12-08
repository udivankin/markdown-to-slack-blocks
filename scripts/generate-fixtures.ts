/**
 * Regenerates test fixtures from input.md
 */
import { markdownToBlocks } from '../src/index';
import * as fs from 'fs';
import * as path from 'path';

const fixturesDir = path.join(__dirname, '..', 'tests', 'fixtures');
const mdPath = path.join(fixturesDir, 'input.md');
const markdown = fs.readFileSync(mdPath, 'utf-8');

const baseOptions = {
    mentions: {
        users: { 'jdoe': 'U12345' },
        channels: { 'general': 'C00001' },
        userGroups: { 'devs': 'S12345' },
        teams: { 'T123456': 'T123456' }
    },
    detectColors: true
};

// Generate rich_text output (preferSectionBlocks: false)
const richTextBlocks = markdownToBlocks(markdown, {
    ...baseOptions,
    preferSectionBlocks: false
});
fs.writeFileSync(
    path.join(fixturesDir, 'output_rich_text.json'),
    JSON.stringify(richTextBlocks, null, 2)
);
console.log('✓ Generated output_rich_text.json');

// Generate sections output (preferSectionBlocks: true)  
const sectionBlocks = markdownToBlocks(markdown, {
    ...baseOptions,
    preferSectionBlocks: true
});
fs.writeFileSync(
    path.join(fixturesDir, 'output_sections.json'),
    JSON.stringify(sectionBlocks, null, 2)
);
console.log('✓ Generated output_sections.json');

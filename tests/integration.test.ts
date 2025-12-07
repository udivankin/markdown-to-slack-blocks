import { describe, it, expect } from 'vitest';
import { markdownToBlocks } from '../src/index';
import * as fs from 'fs';
import * as path from 'path';

describe('Integration Test', () => {
    it('converts full_features.md to expected JSON', () => {
        const mdPath = path.join(__dirname, 'fixtures', 'input.md');
        const jsonPath = path.join(__dirname, 'fixtures', 'output.json');

        const markdown = fs.readFileSync(mdPath, 'utf-8');
        const expectedJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

        const options = {
            mentions: {
                users: { 'jdoe': 'U12345' },
                channels: { 'general': 'C00001' },
                userGroups: { 'devs': 'S12345' },
                teams: { 'T123456': 'T123456' }
            },
            detectColors: true
        };

        const result = markdownToBlocks(markdown, options);

        expect(result).toEqual(expectedJson);
    });
});

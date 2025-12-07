import { describe, it, expect } from 'vitest';
import { validateOptions } from '../src/validator';
import { MarkdownToBlocksOptions } from '../src/types';

describe('validateOptions', () => {
    it('allows valid options', () => {
        const options: MarkdownToBlocksOptions = {
            mentions: {
                users: {
                    'u1': 'U12345',
                    'u2': 'W12345',
                },
                channels: {
                    'c1': 'C12345',
                },
                userGroups: {
                    'g1': 'S12345',
                },
                teams: {
                    't1': 'T12345',
                }
            }
        };

        expect(() => validateOptions(options)).not.toThrow();
    });

    it('throws for invalid User ID', () => {
        const options: MarkdownToBlocksOptions = {
            mentions: {
                users: {
                    'bad': 'X12345', // Starts with X
                }
            }
        };
        expect(() => validateOptions(options)).toThrow(/Invalid User ID/);
    });

    it('throws for invalid User ID (non-alphanumeric)', () => {
        const options: MarkdownToBlocksOptions = {
            mentions: {
                users: {
                    'bad': 'U123-45', // Contains hyphen
                }
            }
        };
        expect(() => validateOptions(options)).toThrow(/alphanumeric/);
    });

    it('throws for invalid Channel ID', () => {
        const options: MarkdownToBlocksOptions = {
            mentions: {
                channels: {
                    'bad': 'U12345', // Starts with U
                }
            }
        };
        expect(() => validateOptions(options)).toThrow(/Invalid Channel ID/);
    });

    it('throws for invalid User Group ID', () => {
        const options: MarkdownToBlocksOptions = {
            mentions: {
                userGroups: {
                    'bad': 'G12345', // Starts with G (should be S)
                }
            }
        };
        expect(() => validateOptions(options)).toThrow(/Invalid User Group ID/);
    });

    it('throws for invalid Team ID', () => {
        const options: MarkdownToBlocksOptions = {
            mentions: {
                teams: {
                    'bad': 'S12345', // Starts with S (should be T)
                }
            }
        };
        expect(() => validateOptions(options)).toThrow(/Invalid Team ID/);
    });

    it('allows empty mentions', () => {
        const options: MarkdownToBlocksOptions = {
            mentions: {}
        };
        expect(() => validateOptions(options)).not.toThrow();
    });

    it('allows no options', () => {
        expect(() => validateOptions(undefined)).not.toThrow();
    });
});

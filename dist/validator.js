"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOptions = validateOptions;
function validateOptions(options) {
    if (!options?.mentions) {
        return;
    }
    const { users, channels, userGroups, teams } = options.mentions;
    if (users) {
        for (const [name, id] of Object.entries(users)) {
            if (!/^[UW][A-Z0-9]+$/.test(id)) {
                throw new Error(`Invalid User ID for '${name}': '${id}'. Must start with U or W and contain only alphanumeric characters.`);
            }
        }
    }
    if (channels) {
        for (const [name, id] of Object.entries(channels)) {
            if (!/^C[A-Z0-9]+$/.test(id)) {
                throw new Error(`Invalid Channel ID for '${name}': '${id}'. Must start with C and contain only alphanumeric characters.`);
            }
        }
    }
    if (userGroups) {
        for (const [name, id] of Object.entries(userGroups)) {
            if (!/^S[A-Z0-9]+$/.test(id)) {
                throw new Error(`Invalid User Group ID for '${name}': '${id}'. Must start with S and contain only alphanumeric characters.`);
            }
        }
    }
    if (teams) {
        for (const [name, id] of Object.entries(teams)) {
            if (!/^T[A-Z0-9]+$/.test(id)) {
                throw new Error(`Invalid Team ID for '${name}': '${id}'. Must start with T and contain only alphanumeric characters.`);
            }
        }
    }
}

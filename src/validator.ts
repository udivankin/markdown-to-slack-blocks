import type { BlocksToMarkdownOptions, MarkdownToBlocksOptions } from "./types";

export function validateOptions(options?: MarkdownToBlocksOptions): void {
	if (!options?.mentions) {
		return;
	}

	const { users, channels, userGroups, teams } = options.mentions;

	if (users) {
		validateIdValues(
			users,
			/^[UW][A-Z0-9]+$/,
			"User",
			(name, id) =>
				`Invalid User ID for '${name}': '${id}'. Must start with U or W and contain only alphanumeric characters.`,
		);
	}

	if (channels) {
		validateIdValues(
			channels,
			/^C[A-Z0-9]+$/,
			"Channel",
			(name, id) =>
				`Invalid Channel ID for '${name}': '${id}'. Must start with C and contain only alphanumeric characters.`,
		);
	}

	if (userGroups) {
		validateIdValues(
			userGroups,
			/^S[A-Z0-9]+$/,
			"User Group",
			(name, id) =>
				`Invalid User Group ID for '${name}': '${id}'. Must start with S and contain only alphanumeric characters.`,
		);
	}

	if (teams) {
		validateIdValues(
			teams,
			/^T[A-Z0-9]+$/,
			"Team",
			(name, id) =>
				`Invalid Team ID for '${name}': '${id}'. Must start with T and contain only alphanumeric characters.`,
		);
	}
}

export function validateBlocksToMarkdownOptions(
	options?: BlocksToMarkdownOptions,
): void {
	if (!options?.mentions) {
		return;
	}

	const { users, channels, userGroups, teams } = options.mentions;

	if (users) {
		validateIdKeys(
			users,
			/^[UW][A-Z0-9]+$/,
			(id) =>
				`Invalid User ID key '${id}'. Must start with U or W and contain only alphanumeric characters.`,
		);
	}

	if (channels) {
		validateIdKeys(
			channels,
			/^C[A-Z0-9]+$/,
			(id) =>
				`Invalid Channel ID key '${id}'. Must start with C and contain only alphanumeric characters.`,
		);
	}

	if (userGroups) {
		validateIdKeys(
			userGroups,
			/^S[A-Z0-9]+$/,
			(id) =>
				`Invalid User Group ID key '${id}'. Must start with S and contain only alphanumeric characters.`,
		);
	}

	if (teams) {
		validateIdKeys(
			teams,
			/^T[A-Z0-9]+$/,
			(id) =>
				`Invalid Team ID key '${id}'. Must start with T and contain only alphanumeric characters.`,
		);
	}
}

function validateIdValues(
	entries: Record<string, string>,
	pattern: RegExp,
	_kind: string,
	buildMessage: (name: string, id: string) => string,
): void {
	for (const [name, id] of Object.entries(entries)) {
		if (!pattern.test(id)) {
			throw new Error(buildMessage(name, id));
		}
	}
}

function validateIdKeys(
	entries: Record<string, string>,
	pattern: RegExp,
	buildMessage: (id: string) => string,
): void {
	for (const id of Object.keys(entries)) {
		if (!pattern.test(id)) {
			throw new Error(buildMessage(id));
		}
	}
}

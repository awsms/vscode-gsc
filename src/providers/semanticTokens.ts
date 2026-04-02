import * as vscode from "vscode";

import type { Stores } from "../models/Store";

export const createSemanticTokensProvider = (
	stores: Stores,
): vscode.DocumentSemanticTokensProvider => ({
	async provideDocumentSemanticTokens(document, token) {
		return await provideSemanticTokens(stores, document, token);
	},
});

export const createRangeSemanticTokensProvider = (
	stores: Stores,
): vscode.DocumentRangeSemanticTokensProvider => ({
	async provideDocumentRangeSemanticTokens(document, range, token) {
		return await provideSemanticTokens(stores, document, token, range);
	},
});

export const semanticTokensLegend = (() => {
	const types = ["function", "method", "parameter"];
	const modifiers = ["definition", "defaultLibrary", "deprecated"];
	return new vscode.SemanticTokensLegend(types, modifiers);
})();

const provideSemanticTokens = async (
	stores: Stores,
	document: vscode.TextDocument,
	token: vscode.CancellationToken,
	range?: vscode.Range,
) => {
	const builder = new vscode.SemanticTokensBuilder();
	const file = stores.gsc.getFile(document);
	if (!file) return builder.build();
	const filesystem = await stores.gsc.getFilesystem(document);
	if (token.isCancellationRequested) return;
	const script = filesystem.getScriptByFile(file);
	if (!script) return builder.build();

	const defs = await file.getCallableDefs();
	if (token.isCancellationRequested) return;
	const usages = await file.getCallableUsages();
	if (token.isCancellationRequested) return;
	const usageDefs = await script.getCallableUsageDefs();
	if (token.isCancellationRequested) return;

	const defsIterable = range ? defs.byRange.getIn(range, true) : defs.byRange;
	for (const { value: def } of defsIterable) {
		const { name, params, body } = def;
		builder.push(name.range.start.line, name.range.start.character, name.text.length, 0, 0b1);
		for (const { range } of params) {
			const length = document.offsetAt(range.end) - document.offsetAt(range.start);
			builder.push(range.start.line, range.start.character, length, 2, 0b1);
		}
		for (const { range } of body.variables.params) {
			const length = document.offsetAt(range.end) - document.offsetAt(range.start);
			builder.push(range.start.line, range.start.character, length, 2);
		}
	}

	const usagesIterable = range ? usages.getIn(range) : usages;
	for (const { value: usage } of usagesIterable) {
		const def = usageDefs.get(usage);
		if (!def) continue;
		const start = usage.name.range.start;
		const length = usage.name.text.length;
		const type = def.receiver ? 1 : 0;
		builder.push(start.line, start.character, length, type, 0);
	}

	return builder.build();
};

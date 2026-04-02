import * as vscode from "vscode";

import type { Stores } from "../models/Store";

export const createInlayHintsProvider = (stores: Stores): vscode.InlayHintsProvider => ({
	async provideInlayHints(document, queryRange, token) {
		const result: vscode.InlayHint[] = [];
		const file = stores.gsc.getFile(document);
		if (!file) return result;
		const filesystem = await stores.gsc.getFilesystem(document);
		if (token.isCancellationRequested) return;
		const script = filesystem.getScriptByFile(file);
		if (!script) return result;

		const usages = await file.getCallableUsages();
		if (token.isCancellationRequested) return;
		const defs = await script.getCallableUsageDefs();
		if (token.isCancellationRequested) return;

		for (const { range, value: usage } of queryRange ? usages.getIn(queryRange) : usages) {
			const def = defs.get(usage);
			if (!def || !def.params) continue;
			if (usage.kind !== "call") continue;
			if (range.start.isAfter(usage.paramList.range.start)) continue;
			if (range.end.isBefore(usage.paramList.range.start)) break;

			for (let i = 0; i < usage.params.length; i++) {
				if (!def.params[i]) break;
				const contentRange = usage.params.getByIndex(i)!.value.contentRange;
				if (!contentRange) continue;
				result.push({
					position: contentRange.start,
					label: `${def.params[i].name}:`,
					kind: vscode.InlayHintKind.Parameter,
					paddingRight: true,
				});
				i++;
			}
		}

		return result;
	},
});

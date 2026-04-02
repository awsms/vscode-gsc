import * as vscode from "vscode";

import type { ExtensionSettings } from "../settings";
import type { Stores } from "../models/Store";

import { createDocumentation, createUsage } from "./shared";

export const createHoverProvider = (
	stores: Stores,
	settings: ExtensionSettings,
): vscode.HoverProvider => ({
	async provideHover(document, position, token) {
		const file = stores.gsc.getFile(document);
		if (!file) return;
		const filesystem = await stores.gsc.getFilesystem(document);
		if (token.isCancellationRequested) return;
		const script = filesystem.getScriptByFile(file);
		if (!script) return;

		const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][\w]*/);
		if (!wordRange) return;

		const usages = await file.getCallableUsages();
		if (token.isCancellationRequested) return;
		const defs = await script.getCallableUsageDefs();
		if (token.isCancellationRequested) return;
		const usage = usages.getAt(position).at(-1)?.value;
		const isUsageTarget =
			usage &&
			(usage.name.range.isEqual(wordRange) || usage.path?.range.isEqual(wordRange) === true);
		if (!isUsageTarget) return;
		const def = usage && defs.get(usage);
		if (!def) return;

		const concise = settings.intelliSense.conciseMode.get(document);
		return new vscode.Hover([
			`\
\`\`\`txt
${createUsage(def)}
\`\`\``,
			createDocumentation(def, document.languageId, { concise, example: false }),
		]);
	},
});

import type { ApiRequestMethod, ApiRequestObjective } from "../objects/er-diagram/diagram-handler";

/** Color names used as hints in medium-difficulty NPC dialogue (matches METHOD_UI_COLORS). */
export const METHOD_COLOR_NAME: Record<ApiRequestMethod, string> = {
    POST: "blue",
    GET: "green",
    PUT: "yellow",
    DELETE: "red",
};

export type NpcRequestDisplayMode = "easy" | "medium" | "hard";

/**
 * Easy: technical description (includes GET/POST/PUT/DELETE).
 * Medium: natural English with the word "request" replaced by the method color name.
 * Hard: natural English only (no method or color hints).
 */
export function formatNpcRequestDialogue(
    objective: ApiRequestObjective,
    naturalEnglish: string,
    mode: NpcRequestDisplayMode,
): string {
    if (mode === "easy") {
        return objective.description;
    }
    if (mode === "hard") {
        return naturalEnglish;
    }
    const colorWord = METHOD_COLOR_NAME[objective.method];
    return naturalEnglish.replace(/\brequest\b/gi, colorWord);
}

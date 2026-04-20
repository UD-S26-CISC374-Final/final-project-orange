/** Same keys as ApiRequestMethod — kept local to avoid circular imports with diagram-handler. */
type HttpMethodKey = "GET" | "POST" | "PUT" | "DELETE";

/** Phaser stroke color for selected ER diagram table nodes (matches method). */
export const METHOD_TABLE_STROKE: Record<HttpMethodKey, number> = {
    POST: 0x1565c0,
    GET: 0x2e7d32,
    PUT: 0xf9a825,
    DELETE: 0xc62828,
};

/** Stroke when no cache method is selected (selected node still shows grey outline). */
export const NO_METHOD_TABLE_STROKE = 0x424242;

/**
 * Table modal row/field backgrounds and accents for the active request mode
 * (GET selection, PUT inline edit, row editor).
 */
export const METHOD_MODAL_SURFACE: Record<
    HttpMethodKey,
    {
        selectedStrong: string;
        surface: string;
        surfaceHover: string;
        accentText: string;
    }
> = {
    POST: {
        selectedStrong: "#1565c0",
        surface: "#e3eafc",
        surfaceHover: "#d0dbf5",
        accentText: "#0d47a1",
    },
    GET: {
        selectedStrong: "#2e7d32",
        surface: "#e8f5e9",
        surfaceHover: "#c8e6c9",
        accentText: "#1b5e20",
    },
    PUT: {
        selectedStrong: "#f9a825",
        surface: "#fff8e1",
        surfaceHover: "#ffecb3",
        accentText: "#e65100",
    },
    DELETE: {
        selectedStrong: "#c62828",
        surface: "#ffebee",
        surfaceHover: "#ffcdd2",
        accentText: "#b71c1c",
    },
};

/** Button colors for HTTP methods (POST blue, GET green, PUT yellow, DELETE red). */
export const METHOD_UI_COLORS: Record<
    HttpMethodKey,
    { background: string; text: string; selectedBackground: string }
> = {
    POST: {
        background: "#1565c0",
        text: "#ffffff",
        selectedBackground: "#0d47a1",
    },
    GET: {
        background: "#2e7d32",
        text: "#ffffff",
        selectedBackground: "#1b5e20",
    },
    PUT: {
        background: "#fdd835",
        text: "#111111",
        selectedBackground: "#f9a825",
    },
    DELETE: {
        background: "#c62828",
        text: "#ffffff",
        selectedBackground: "#b71c1c",
    },
};

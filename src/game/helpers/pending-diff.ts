/** Mirrors EntityType — kept local to avoid circular imports with diagram-handler. */
export type EntityKey =
    | "USER"
    | "PET"
    | "EMPLOYMENT"
    | "JOB"
    | "HOUSE"
    | "VEHICLE";

export type RowData = Record<string, unknown>;

export type TableStoreLike = {
    getTableForType(type: EntityKey): Map<string, unknown>;
};

export type DiffLine =
    | {
          kind: "field";
          entityType: EntityKey;
          rowId: string;
          field: string;
          label: string;
          before: unknown;
          after: unknown;
      }
    | {
          kind: "insert";
          entityType: EntityKey;
          rowId: string;
          label: string;
          row: RowData;
      }
    | {
          kind: "delete";
          entityType: EntityKey;
          rowId: string;
          label: string;
          row: RowData;
      };

function sortRows(rows: RowData[]): RowData[] {
    return [...rows].sort((a, b) =>
        String(a.id ?? "").localeCompare(String(b.id ?? "")),
    );
}

export function rowsDeepEqualToStore(
    store: TableStoreLike,
    entityType: EntityKey,
    pending: RowData[],
): boolean {
    const storeRows = Array.from(store.getTableForType(entityType).values()).map(
        (r) => r as RowData,
    );
    return (
        JSON.stringify(sortRows(pending)) === JSON.stringify(sortRows(storeRows))
    );
}

export function computePendingDiffs(
    store: TableStoreLike,
    pendingByTable: Map<EntityKey, RowData[]>,
): DiffLine[] {
    const lines: DiffLine[] = [];

    for (const [entityType, pendingRows] of pendingByTable) {
        const tableMap = store.getTableForType(entityType);
        const storeById = new Map(
            Array.from(tableMap.values()).map((r) => {
                const row = r as RowData;
                return [String(row.id ?? ""), row] as const;
            }),
        );
        const pendingIds = new Set(pendingRows.map((r) => String(r.id ?? "")));

        for (const pr of pendingRows) {
            const id = String(pr.id ?? "");
            if (!id) continue;
            const sr = storeById.get(id);
            if (!sr) {
                lines.push({
                    kind: "insert",
                    entityType,
                    rowId: id,
                    label: `${entityType}: new row ${id}`,
                    row: { ...pr },
                });
                continue;
            }
            for (const key of Object.keys(pr)) {
                if (key === "id") continue;
                const pv = pr[key];
                const sv = sr[key];
                if (JSON.stringify(pv) !== JSON.stringify(sv)) {
                    lines.push({
                        kind: "field",
                        entityType,
                        rowId: id,
                        field: key,
                        label: `${entityType} ${id}.${key}`,
                        before: sv,
                        after: pv,
                    });
                }
            }
        }

        for (const [sid, sr] of storeById) {
            if (!pendingIds.has(sid)) {
                lines.push({
                    kind: "delete",
                    entityType,
                    rowId: sid,
                    label: `${entityType}: removed row ${sid}`,
                    row: { ...(sr as RowData) },
                });
            }
        }
    }

    return lines;
}

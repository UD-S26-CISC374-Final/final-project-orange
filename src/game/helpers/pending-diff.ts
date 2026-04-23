/** Mirrors EntityType — kept local to avoid circular imports with diagram-handler. */
export type EntityKey =
    | "USER"
    | "PET"
    | "EMPLOYMENT"
    | "JOB"
    | "HOUSE"
    | "VEHICLE";

type CellValue = string | number | boolean | null;
export type RowData = Record<string, CellValue>;

export type TableStoreLike = {
    getTableForType(type: EntityKey): Map<string, RowData>;
};

export type DiffLine =
    | {
          kind: "field";
          entityType: EntityKey;
          rowId: string;
          field: string;
          label: string;
          before: CellValue | undefined;
          after: CellValue | undefined;
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

function getRowId(row: RowData): string {
    return typeof row.id === "string" ? row.id : "";
}

function sortRows(rows: RowData[]): RowData[] {
    return [...rows].sort((a, b) => getRowId(a).localeCompare(getRowId(b)));
}

export function rowsDeepEqualToStore(
    store: TableStoreLike,
    entityType: EntityKey,
    pending: RowData[],
): boolean {
    const storeRows = Array.from(store.getTableForType(entityType).values()).map(
        (row) => ({ ...row }),
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
            Array.from(tableMap.values()).map((row) => {
                return [getRowId(row), row] as const;
            }),
        );
        const pendingIds = new Set(pendingRows.map((row) => getRowId(row)));

        for (const pr of pendingRows) {
            const id = getRowId(pr);
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
                    row: { ...sr },
                });
            }
        }
    }

    return lines;
}

import type { ApiRequestMethod, EntityType } from "./diagram-handler";

type RowData = Record<string, unknown>;

type MutationKind = "none" | "insert" | "update" | "delete";

interface TableViewModalHooks {
    onFieldEdited?: () => void;
    onEditsConfirmed?: (payload: {
        entityType: EntityType;
        mutation: MutationKind;
        rows: RowData[];
    }) => void;
    onGetSelectionChanged?: (payload: {
        entityType: EntityType;
        selectedTargets: string[];
    }) => void;
}

interface TableViewShowOptions {
    allowEditing?: boolean;
    mode?: ApiRequestMethod;
}

export class TableViewModal {
    private readonly scene: Phaser.Scene;
    private readonly overlayBlocker: Phaser.GameObjects.Rectangle;
    private readonly container: Phaser.GameObjects.Container;
    private readonly background: Phaser.GameObjects.Rectangle;
    private readonly titleText: Phaser.GameObjects.Text;
    private readonly tableText: Phaser.GameObjects.Text;
    private readonly hintText: Phaser.GameObjects.Text;
    private readonly closeButton: Phaser.GameObjects.Text;
    private readonly editButton: Phaser.GameObjects.Text;
    private readonly confirmButton: Phaser.GameObjects.Text;
    private readonly addRowButton: Phaser.GameObjects.Text;
    private readonly deleteRowButton: Phaser.GameObjects.Text;
    private readonly previousPageButton: Phaser.GameObjects.Text;
    private readonly nextPageButton: Phaser.GameObjects.Text;
    private readonly pageText: Phaser.GameObjects.Text;
    private readonly editorContainer: Phaser.GameObjects.Container;
    private readonly editorObjects: Phaser.GameObjects.GameObject[] = [];
    private readonly rowEditorBlocker: Phaser.GameObjects.Rectangle;
    private readonly rowEditorContainer: Phaser.GameObjects.Container;
    private readonly rowEditorTitle: Phaser.GameObjects.Text;
    private readonly rowEditorHint: Phaser.GameObjects.Text;
    private readonly rowEditorSaveButton: Phaser.GameObjects.Text;
    private readonly rowEditorCancelButton: Phaser.GameObjects.Text;
    private readonly rowEditorObjects: Phaser.GameObjects.GameObject[] = [];
    private isEditMode = false;
    private currentEntityType?: EntityType;
    private currentMode?: ApiRequestMethod;
    private currentRows: RowData[] = [];
    private stagedRows: RowData[] = [];
    private selectedDeleteRows = new Set<number>();
    /** Keys `${rowIndex}:${column}` for field-level soft-delete (null non-id values). */
    private selectedDeleteFields = new Set<string>();
    private baseRowCount = 0;
    private selectedGetTargets = new Set<string>();
    private rowEditorVisible = false;
    private rowEditorRowIndex?: number;
    private rowEditorDraft: RowData = {};
    private rowEditorColumns: string[] = [];
    private rowEditorActiveColumn?: string;
    private canEditCurrentTable = true;
    private currentPageIndex = 0;
    private readonly rowsPerPage = 5;
    private editorScrollOffset = 0;
    private editorContentHeight = 0;
    private readonly hooks?: TableViewModalHooks;
    private readonly keyboardHandler: (event: KeyboardEvent) => void;

    constructor(scene: Phaser.Scene, hooks?: TableViewModalHooks) {
        this.scene = scene;
        this.hooks = hooks;
        this.overlayBlocker = scene.add.rectangle(
            scene.scale.width / 2,
            scene.scale.height / 2,
            scene.scale.width,
            scene.scale.height,
            0x000000,
            0.2,
        );
        this.overlayBlocker
            .setDepth(999)
            .setVisible(false)
            .setInteractive({ useHandCursor: false })
            .on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
            })
            .on("pointerup", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
            })
            .on("pointermove", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
            });
        this.rowEditorBlocker = scene.add.rectangle(
            scene.scale.width / 2,
            scene.scale.height / 2,
            scene.scale.width,
            scene.scale.height,
            0x000000,
            0.35,
        );
        this.rowEditorBlocker
            .setDepth(1001)
            .setVisible(false)
            .setInteractive({ useHandCursor: false })
            .on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
            })
            .on("pointerup", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
            })
            .on("pointermove", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
                event.stopPropagation();
            });
        this.background = scene.add.rectangle(0, 0, 760, 360, 0xffffff, 1);
        this.background.setStrokeStyle(3, 0x000000, 1);
        this.background.setOrigin(0.5);

        this.titleText = scene.add.text(-350, -158, "", {
            color: "#111",
            fontSize: "22px",
            fontStyle: "bold",
        });

        this.closeButton = scene.add
            .text(340, -160, "X", {
                color: "#b00020",
                fontSize: "24px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
            })
            .setInteractive({ useHandCursor: true });
        // Close on pointerup so the same gesture does not deliver pointerup to the ER diagram underneath.
        this.closeButton.on("pointerup", () => this.hide());

        this.editButton = scene.add
            .text(295, -160, "✎", {
                color: "#1a5fb4",
                fontSize: "24px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
            })
            .setInteractive({ useHandCursor: true });
        this.editButton.on("pointerdown", () => this.toggleEditMode());

        this.confirmButton = scene.add
            .text(196, -160, "Confirm", {
                color: "#ffffff",
                fontSize: "16px",
                fontStyle: "bold",
                backgroundColor: "#0b8f08",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true });
        this.confirmButton.on("pointerdown", () => this.confirmEdits());
        this.confirmButton.setVisible(false);

        this.addRowButton = scene.add
            .text(120, -160, "+ Row", {
                color: "#ffffff",
                fontSize: "16px",
                fontStyle: "bold",
                backgroundColor: "#1a5fb4",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true });
        this.addRowButton.on("pointerdown", () => this.addRow());
        this.addRowButton.setVisible(false);

        this.deleteRowButton = scene.add
            .text(30, -160, "- Row", {
                color: "#ffffff",
                fontSize: "16px",
                fontStyle: "bold",
                backgroundColor: "#b00020",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true });
        this.deleteRowButton.on("pointerdown", () => this.deleteActiveRow());
        this.deleteRowButton.setVisible(false);

        this.previousPageButton = scene.add
            .text(-34, 145, "←", {
                color: "#ffffff",
                fontSize: "18px",
                fontStyle: "bold",
                backgroundColor: "#555555",
                padding: { left: 10, right: 10, top: 2, bottom: 2 },
            })
            .setInteractive({ useHandCursor: true });
        this.previousPageButton.on("pointerdown", () => this.goToPreviousPage());

        this.nextPageButton = scene.add
            .text(34, 145, "→", {
                color: "#ffffff",
                fontSize: "18px",
                fontStyle: "bold",
                backgroundColor: "#555555",
                padding: { left: 10, right: 10, top: 2, bottom: 2 },
            })
            .setInteractive({ useHandCursor: true });
        this.nextPageButton.on("pointerdown", () => this.goToNextPage());

        this.pageText = scene.add.text(-140, 146, "Page 1/1", {
            color: "#111",
            fontSize: "14px",
            fontStyle: "bold",
        });

        this.tableText = scene.add.text(-350, -120, "", {
            color: "#222",
            fontSize: "14px",
            fontFamily: "monospace",
            lineSpacing: 6,
            wordWrap: { width: 700 },
        });

        this.editorContainer = scene.add.container(0, 0, []);
        this.editorContainer.setVisible(false);

        this.hintText = scene.add.text(-350, 145, "", {
            color: "#444",
            fontSize: "13px",
            fontStyle: "italic",
            wordWrap: { width: 700 },
        });

        this.container = scene.add.container(scene.scale.width / 2, scene.scale.height / 2, [
            this.background,
            this.titleText,
            this.tableText,
            this.editorContainer,
            this.hintText,
            this.confirmButton,
            this.addRowButton,
            this.deleteRowButton,
            this.previousPageButton,
            this.nextPageButton,
            this.pageText,
            this.editButton,
            this.closeButton,
        ]);
        this.container.setDepth(1000);
        this.container.setVisible(false);
        const rowEditorBackground = scene.add.rectangle(0, 0, 470, 320, 0xffffff, 1);
        rowEditorBackground.setStrokeStyle(3, 0x000000, 1);
        this.rowEditorTitle = scene.add.text(-220, -140, "", {
            color: "#111",
            fontSize: "20px",
            fontStyle: "bold",
        });
        this.rowEditorHint = scene.add.text(-220, 125, "", {
            color: "#444",
            fontSize: "12px",
            fontStyle: "italic",
            wordWrap: { width: 430 },
        });
        this.rowEditorSaveButton = scene.add
            .text(125, -140, "Save", {
                color: "#ffffff",
                fontSize: "14px",
                fontStyle: "bold",
                backgroundColor: "#0b8f08",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true });
        this.rowEditorSaveButton.on("pointerup", () => this.saveRowEditor());
        this.rowEditorCancelButton = scene.add
            .text(184, -140, "X", {
                color: "#ffffff",
                fontSize: "14px",
                fontStyle: "bold",
                backgroundColor: "#b00020",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true });
        this.rowEditorCancelButton.on("pointerup", () => this.closeRowEditor());
        this.rowEditorContainer = scene.add.container(
            scene.scale.width / 2,
            scene.scale.height / 2,
            [
                rowEditorBackground,
                this.rowEditorTitle,
                this.rowEditorHint,
                this.rowEditorSaveButton,
                this.rowEditorCancelButton,
            ],
        );
        this.rowEditorContainer.setDepth(1002);
        this.rowEditorContainer.setVisible(false);

        this.keyboardHandler = (event: KeyboardEvent) => this.onKeydown(event);
        window.addEventListener("keydown", this.keyboardHandler);
        this.scene.input.on(
            "wheel",
            (
                _pointer: Phaser.Input.Pointer,
                _gameObjects: Phaser.GameObjects.GameObject[],
                _deltaX: number,
                deltaY: number,
            ) => this.onWheel(deltaY),
        );
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener("keydown", this.keyboardHandler);
        });
    }

    show(entityType: EntityType, rows: RowData[], options?: TableViewShowOptions) {
        this.currentEntityType = entityType;
        this.canEditCurrentTable = options?.allowEditing ?? true;
        this.currentMode = options?.mode;
        this.currentRows = rows;
        this.stagedRows = rows.map((row) => ({ ...row }));
        this.selectedDeleteRows.clear();
        this.selectedDeleteFields.clear();
        this.baseRowCount = rows.length;
        this.selectedGetTargets.clear();
        this.rowEditorVisible = false;
        this.rowEditorRowIndex = undefined;
        this.rowEditorColumns = [];
        this.rowEditorDraft = {};
        this.rowEditorActiveColumn = undefined;
        this.currentPageIndex = 0;
        this.editorScrollOffset = 0;
        this.isEditMode = false;
        this.titleText.setText(`${entityType} table data`);
        this.renderTable();
        this.overlayBlocker.setVisible(true);
        this.container.setVisible(true);
    }

    hide() {
        this.currentEntityType = undefined;
        this.currentMode = undefined;
        this.currentRows = [];
        this.stagedRows = [];
        this.selectedDeleteRows.clear();
        this.selectedDeleteFields.clear();
        this.baseRowCount = 0;
        this.selectedGetTargets.clear();
        this.closeRowEditor();
        this.canEditCurrentTable = true;
        this.currentPageIndex = 0;
        this.editorScrollOffset = 0;
        this.isEditMode = false;
        this.overlayBlocker.setVisible(false);
        this.container.setVisible(false);
    }

    private buildTableText(rows: RowData[]): string {
        if (rows.length === 0) {
            return "No rows available for this table.";
        }

        const pageRows = this.getCurrentPageRows(rows);
        const columns = Array.from(
            rows.reduce((columnSet, row) => {
                for (const key of Object.keys(row)) {
                    columnSet.add(key);
                }
                return columnSet;
            }, new Set<string>()),
        );

        const headerColumns = columns.map((column) =>
            this.isReadonlyColumn(column) ? `${column} (readonly)` : column,
        );

        const widths = columns.map((column) =>
            Math.max(
                this.isReadonlyColumn(column)
                    ? `${column} (readonly)`.length
                    : column.length,
                ...rows.map((row) => String(row[column] ?? "").length),
            ),
        );

        const header = this.joinRow(headerColumns, widths);
        const separator = widths.map((width) => "-".repeat(width)).join("-+-");
        const body = pageRows.map((row) => {
            const values = columns.map((column) => String(row[column] ?? ""));
            return this.joinRow(values, widths);
        });

        return [header, separator, ...body].join("\n");
    }

    private joinRow(values: string[], widths: number[]): string {
        return values.map((value, index) => value.padEnd(widths[index], " ")).join(" | ");
    }

    private renderTable() {
        const isGetMode = this.currentMode === "GET";
        this.tableText.setVisible(!this.isEditMode && !isGetMode);
        this.editorContainer.setVisible(this.isEditMode || isGetMode);
        this.confirmButton.setVisible(this.isEditMode && !isGetMode);
        this.addRowButton.setVisible(this.isEditMode && this.currentMode === "POST");
        this.deleteRowButton.setVisible(
            this.isEditMode && this.currentMode === "DELETE",
        );
        this.editButton.setColor(this.isEditMode ? "#0b8f08" : "#1a5fb4");
        this.editButton.setAlpha(
            !this.canEditCurrentTable || this.currentMode === "GET" ? 0.5 : 1,
        );
        this.updatePaginationState();

        if (isGetMode) {
            this.renderGetSelectionRows();
        } else if (this.isEditMode) {
            this.renderEditorFields();
        } else {
            this.tableText.setText(this.buildTableText(this.currentRows));
            this.clearEditorObjects();
        }

        this.hintText.setText(
            this.isEditMode
                ? this.currentMode === "POST"
                    ? "POST mode: use + Row to open the add-item modal, then Confirm."
                    : this.currentMode === "PUT"
                      ? "PUT mode: click a row to open the edit modal with prefilled values, then Confirm."
                      : this.currentMode === "DELETE"
                        ? `DELETE mode: click a row to clear all non-id fields, or click values to clear specific fields (${this.selectedDeleteRows.size} rows, ${this.selectedDeleteFields.size} fields), then Confirm.`
                        : "Edit mode on."
                : isGetMode
                  ? `GET mode: click row or field values to stage returned data (${this.selectedGetTargets.size} selected).`
                  : this.canEditCurrentTable
                  ? "Click ✎ to edit values directly in the modal. ID fields are read-only."
                  : "Select a request type first, then reopen this table to edit data.",
        );
    }

    private toggleEditMode() {
        if (!this.currentEntityType) {
            return;
        }
        if (!this.canEditCurrentTable) {
            return;
        }
        if (this.currentMode === "GET") {
            return;
        }

        this.isEditMode = !this.isEditMode;
        this.selectedDeleteRows.clear();
        this.selectedDeleteFields.clear();
        if (!this.isEditMode) {
            this.stagedRows = this.currentRows.map((row) => ({ ...row }));
            this.editorScrollOffset = 0;
        }
        this.currentPageIndex = 0;
        this.renderTable();
    }

    private confirmEdits() {
        if (!this.isEditMode) {
            return;
        }
        const beforeRows = this.currentRows.map((row) => ({ ...row }));
        let nextRows = this.stagedRows.map((row) => ({ ...row }));
        let forcedMutation: MutationKind | undefined;
        if (
            this.currentMode === "DELETE" &&
            (this.selectedDeleteRows.size > 0 || this.selectedDeleteFields.size > 0)
        ) {
            nextRows = nextRows.map((row, index) =>
                this.applyDeleteSelectionToRow(row, index),
            );
            forcedMutation = "delete";
        }
        const afterRows = nextRows.map((row) => ({ ...row }));
        this.currentRows = nextRows.map((row) => ({ ...row }));
        this.stagedRows = nextRows.map((row) => ({ ...row }));
        const mutation = forcedMutation ?? this.detectMutation(beforeRows, afterRows);
        if (this.currentEntityType) {
            this.hooks?.onEditsConfirmed?.({
                entityType: this.currentEntityType,
                mutation,
                rows: this.currentRows.map((row) => ({ ...row })),
            });
        }
        this.isEditMode = false;
        this.selectedDeleteRows.clear();
        this.selectedDeleteFields.clear();
        this.editorScrollOffset = 0;
        this.renderTable();
    }

    private renderEditorFields() {
        this.clearEditorObjects();
        if (this.stagedRows.length === 0) {
            const emptyText = this.scene.add.text(-350, -120, "No rows available for this table.", {
                color: "#222",
                fontSize: "14px",
            });
            this.editorContainer.add(emptyText);
            this.editorObjects.push(emptyText);
            return;
        }

        const columns = Array.from(
            this.stagedRows.reduce((set, row) => {
                for (const key of Object.keys(row)) {
                    set.add(key);
                }
                return set;
            }, new Set<string>()),
        );

        const pageRows = this.getCurrentPageRows(this.stagedRows);
        const pageStart = this.currentPageIndex * this.rowsPerPage;
        let y = -120 - this.editorScrollOffset;
        for (let localIndex = 0; localIndex < pageRows.length; localIndex += 1) {
            const rowIndex = pageStart + localIndex;
            const rowMarkedForDelete = this.selectedDeleteRows.has(rowIndex);
            const rowHasFieldDeleteMarks = this.rowHasAnyFieldDeleteMark(rowIndex, columns);
            const rowPrefix =
                this.currentMode === "DELETE"
                    ? rowMarkedForDelete
                        ? "[x] "
                        : rowHasFieldDeleteMarks
                          ? "[~] "
                          : "[ ] "
                    : "";
            const rowLabel = this.scene.add.text(-350, y, `${rowPrefix}Row ${rowIndex + 1}`, {
                color: rowMarkedForDelete ? "#ffffff" : "#111",
                fontSize: "13px",
                fontStyle: "bold",
                backgroundColor: rowMarkedForDelete
                    ? "#b00020"
                    : rowHasFieldDeleteMarks
                      ? "#fff3e0"
                      : "#ffffff",
                padding: { left: 4, right: 4, top: 2, bottom: 2 },
            });
            if (this.currentMode === "PUT" && rowIndex < this.baseRowCount) {
                rowLabel
                    .setInteractive({ useHandCursor: true })
                    .on("pointerdown", () => {
                        this.openRowEditor(rowIndex);
                    });
            }
            if (this.currentMode === "DELETE") {
                rowLabel
                    .setInteractive({ useHandCursor: true })
                    .on("pointerover", () => {
                        if (!this.selectedDeleteRows.has(rowIndex)) {
                            rowLabel.setBackgroundColor("#ffe3e3");
                        }
                    })
                    .on("pointerout", () => {
                        if (!this.selectedDeleteRows.has(rowIndex)) {
                            rowLabel.setBackgroundColor(
                                this.rowHasAnyFieldDeleteMark(rowIndex, columns)
                                    ? "#fff3e0"
                                    : "#ffffff",
                            );
                        }
                    })
                    .on("pointerdown", () => {
                        this.toggleDeleteRowSelection(rowIndex);
                    });
            }
            this.editorContainer.add(rowLabel);
            this.editorObjects.push(rowLabel);
            y += 20;

            for (const column of columns) {
                const readonly = this.isReadonlyColumn(column);
                const canModifyInPlace = this.currentMode === "PUT" && rowIndex < this.baseRowCount;
                const editable = !readonly && canModifyInPlace;
                const fieldKey = `${rowIndex}:${column}`;
                const fieldMarkedForDelete =
                    this.currentMode === "DELETE" &&
                    !readonly &&
                    this.selectedDeleteFields.has(fieldKey);
                const labelText = this.scene.add.text(
                    -335,
                    y,
                    readonly ? `${column} (readonly):` : `${column}:`,
                    {
                        color: editable ? "#222" : "#666",
                        fontSize: "13px",
                    },
                );
                this.editorContainer.add(labelText);
                this.editorObjects.push(labelText);

                const value = String(this.stagedRows[rowIndex][column] ?? "");
                const deleteFieldPrefix =
                    this.currentMode === "DELETE" && !readonly && !rowMarkedForDelete
                        ? fieldMarkedForDelete
                            ? "[x] "
                            : "[ ] "
                        : "";
                const valueText = this.scene.add.text(-145, y, `${deleteFieldPrefix}${value}`, {
                    color: rowMarkedForDelete
                        ? "#ffffff"
                        : fieldMarkedForDelete
                          ? "#ffffff"
                          : editable
                            ? "#1a5fb4"
                            : "#666",
                    fontSize: "13px",
                    backgroundColor: rowMarkedForDelete
                        ? "#b00020"
                        : fieldMarkedForDelete
                          ? "#c62828"
                          : editable
                            ? "#eaf2ff"
                            : "#f1f1f1",
                    padding: { left: 4, right: 4, top: 2, bottom: 2 },
                });
                if (this.currentMode === "PUT" && rowIndex < this.baseRowCount) {
                    valueText.setInteractive({ useHandCursor: true });
                    valueText.on("pointerdown", () => {
                        this.openRowEditor(rowIndex, column);
                    });
                }
                if (this.currentMode === "DELETE" && !readonly && !rowMarkedForDelete) {
                    valueText.setInteractive({ useHandCursor: true });
                    valueText
                        .on("pointerover", () => {
                            if (!this.selectedDeleteFields.has(fieldKey)) {
                                valueText.setBackgroundColor("#ffcdd2");
                            }
                        })
                        .on("pointerout", () => {
                            if (!this.selectedDeleteFields.has(fieldKey)) {
                                valueText.setBackgroundColor("#f1f1f1");
                            }
                        })
                        .on("pointerdown", () => {
                            this.toggleDeleteFieldSelection(rowIndex, column);
                        });
                }
                this.editorContainer.add(valueText);
                this.editorObjects.push(valueText);
                y += 18;
            }

            y += 12;
        }
        this.editorContentHeight = y - (-120 - this.editorScrollOffset);
        const maxScroll = this.getMaxEditorScroll();
        if (this.editorScrollOffset > maxScroll) {
            this.editorScrollOffset = maxScroll;
            this.renderEditorFields();
        }
    }

    private clearEditorObjects() {
        for (const object of this.editorObjects) {
            object.destroy();
        }
        this.editorObjects.length = 0;
        this.editorContainer.removeAll(true);
    }

    private onKeydown(event: KeyboardEvent) {
        if (this.rowEditorVisible) {
            this.onRowEditorKeydown(event);
            return;
        }
    }

    private addRow() {
        if (
            !this.isEditMode ||
            this.currentEntityType === undefined ||
            this.currentMode !== "POST"
        ) {
            return;
        }
        this.openRowEditor();
    }

    private deleteActiveRow() {
        if (!this.isEditMode || this.currentMode !== "DELETE") {
            return;
        }
        if (this.selectedDeleteRows.size === 0 && this.selectedDeleteFields.size === 0) {
            return;
        }
        this.stagedRows = this.stagedRows.map((row, index) =>
            this.applyDeleteSelectionToRow(row, index),
        );
        this.selectedDeleteRows.clear();
        this.selectedDeleteFields.clear();
        this.clampCurrentPage(this.stagedRows);
        this.editorScrollOffset = 0;
        this.renderEditorFields();
    }

    private renderGetSelectionRows() {
        this.clearEditorObjects();
        if (this.currentRows.length === 0) {
            const emptyText = this.scene.add.text(
                -350,
                -120,
                "No rows available for this table.",
                {
                    color: "#222",
                    fontSize: "14px",
                },
            );
            this.editorContainer.add(emptyText);
            this.editorObjects.push(emptyText);
            return;
        }

        const columns = Array.from(
            this.currentRows.reduce((set, row) => {
                for (const key of Object.keys(row)) {
                    set.add(key);
                }
                return set;
            }, new Set<string>()),
        );
        const pageRows = this.getCurrentPageRows(this.currentRows);
        const pageStart = this.currentPageIndex * this.rowsPerPage;
        let y = -120;
        for (let localIndex = 0; localIndex < pageRows.length; localIndex += 1) {
            const rowIndex = pageStart + localIndex;
            const rowId = String(this.currentRows[rowIndex]?.id ?? `row-${rowIndex + 1}`);
            const rowTarget = `row:${rowId}`;
            const rowSelected = this.selectedGetTargets.has(rowTarget);
            const rowPrefix = rowSelected ? "[x] " : "[ ] ";
            const rowText = this.scene.add
                .text(-350, y, `${rowPrefix}Row ${rowIndex + 1}`, {
                    color: rowSelected ? "#ffffff" : "#111",
                    fontSize: "13px",
                    fontStyle: "bold",
                    backgroundColor: rowSelected ? "#1a5fb4" : "#dfe8ff",
                    padding: { left: 4, right: 4, top: 2, bottom: 2 },
                })
                .setInteractive({ useHandCursor: true });
            rowText
                .on("pointerover", () => {
                    if (!this.selectedGetTargets.has(rowTarget)) {
                        rowText.setBackgroundColor("#c9ddff");
                    }
                })
                .on("pointerout", () => {
                    if (!this.selectedGetTargets.has(rowTarget)) {
                        rowText.setBackgroundColor("#dfe8ff");
                    }
                });
            rowText.on("pointerdown", () => this.toggleGetTarget(rowTarget));
            this.editorContainer.add(rowText);
            this.editorObjects.push(rowText);
            y += 24;

            for (const column of columns) {
                const fieldTarget = `field:${rowId}:${column}`;
                const fieldSelected = this.selectedGetTargets.has(fieldTarget);
                const value = String(this.currentRows[rowIndex][column] ?? "");
                const fieldText = this.scene.add
                    .text(-335, y, `${column}: ${value}`, {
                        color: fieldSelected ? "#ffffff" : "#1a5fb4",
                        fontSize: "13px",
                        backgroundColor: fieldSelected ? "#1a5fb4" : "#eaf2ff",
                        padding: { left: 4, right: 4, top: 2, bottom: 2 },
                    })
                    .setInteractive({ useHandCursor: true });
                fieldText
                    .on("pointerover", () => {
                        if (!this.selectedGetTargets.has(fieldTarget)) {
                            fieldText.setBackgroundColor("#d8e9ff");
                        }
                    })
                    .on("pointerout", () => {
                        if (!this.selectedGetTargets.has(fieldTarget)) {
                            fieldText.setBackgroundColor("#eaf2ff");
                        }
                    });
                fieldText.on("pointerdown", () => this.toggleGetTarget(fieldTarget));
                this.editorContainer.add(fieldText);
                this.editorObjects.push(fieldText);
                y += 20;
            }
            y += 10;
        }
    }

    private toggleGetTarget(target: string) {
        if (this.currentMode !== "GET") {
            return;
        }
        if (this.selectedGetTargets.has(target)) {
            this.selectedGetTargets.delete(target);
        } else {
            this.selectedGetTargets.add(target);
        }
        if (this.currentEntityType) {
            this.hooks?.onGetSelectionChanged?.({
                entityType: this.currentEntityType,
                selectedTargets: Array.from(this.selectedGetTargets),
            });
        }
        this.renderGetSelectionRows();
    }

    private isReadonlyColumn(column: string): boolean {
        return column.toLowerCase().endsWith("id");
    }

    private coerceValue(nextValue: string, existingValue: unknown): unknown {
        if (typeof existingValue === "number") {
            const parsed = Number(nextValue);
            return Number.isNaN(parsed) ? existingValue : parsed;
        }
        if (typeof existingValue === "boolean") {
            return nextValue.toLowerCase() === "true";
        }
        return nextValue;
    }

    private detectMutation(beforeRows: RowData[], afterRows: RowData[]): MutationKind {
        if (afterRows.length > beforeRows.length) {
            return "insert";
        }
        if (afterRows.length < beforeRows.length) {
            return "delete";
        }
        const beforeJson = JSON.stringify(beforeRows);
        const afterJson = JSON.stringify(afterRows);
        return beforeJson === afterJson ? "none" : "update";
    }

    private buildNextId(): string {
        const allIds = [...this.currentRows, ...this.stagedRows]
            .map((row) => String(row.id ?? ""))
            .filter((id) => id.length > 0);
        let maxNumeric = 0;
        let prefix = this.getDefaultIdPrefix();
        for (const id of allIds) {
            const match = id.match(/^([a-zA-Z]+)(\d+)$/);
            if (!match) {
                continue;
            }
            prefix = match[1];
            const numeric = Number(match[2]);
            if (numeric > maxNumeric) {
                maxNumeric = numeric;
            }
        }
        return `${prefix}${maxNumeric + 1}`;
    }

    private getDefaultIdPrefix(): string {
        switch (this.currentEntityType) {
            case "USER":
                return "u";
            case "PET":
                return "p";
            case "EMPLOYMENT":
                return "e";
            case "JOB":
                return "j";
            case "HOUSE":
                return "h";
            case "VEHICLE":
                return "v";
            default:
                return "r";
        }
    }

    private updatePaginationState() {
        const rows = this.isEditMode ? this.stagedRows : this.currentRows;
        this.clampCurrentPage(rows);
        const totalPages = this.getTotalPages(rows);
        const hasMultiplePages = totalPages > 1;
        this.previousPageButton.setVisible(hasMultiplePages);
        this.nextPageButton.setVisible(hasMultiplePages);
        this.pageText.setVisible(hasMultiplePages);
        this.pageText.setText(`Page ${this.currentPageIndex + 1}/${totalPages}`);
    }

    private goToPreviousPage() {
        if (this.currentPageIndex <= 0) {
            return;
        }
        this.currentPageIndex -= 1;
        this.renderTable();
    }

    private goToNextPage() {
        const rows = this.isEditMode ? this.stagedRows : this.currentRows;
        const totalPages = this.getTotalPages(rows);
        if (this.currentPageIndex >= totalPages - 1) {
            return;
        }
        this.currentPageIndex += 1;
        this.renderTable();
    }

    private getCurrentPageRows(rows: RowData[]): RowData[] {
        const start = this.currentPageIndex * this.rowsPerPage;
        return rows.slice(start, start + this.rowsPerPage);
    }

    private getTotalPages(rows: RowData[]): number {
        return Math.max(1, Math.ceil(rows.length / this.rowsPerPage));
    }

    private clampCurrentPage(rows: RowData[]) {
        const totalPages = this.getTotalPages(rows);
        if (this.currentPageIndex > totalPages - 1) {
            this.currentPageIndex = totalPages - 1;
        }
        if (this.currentPageIndex < 0) {
            this.currentPageIndex = 0;
        }
    }

    private onWheel(deltaY: number) {
        if (!this.container.visible || !this.isEditMode || this.rowEditorVisible) {
            return;
        }
        const maxScroll = this.getMaxEditorScroll();
        if (maxScroll <= 0) {
            return;
        }
        const step = 24;
        if (deltaY > 0) {
            this.editorScrollOffset = Math.min(maxScroll, this.editorScrollOffset + step);
        } else if (deltaY < 0) {
            this.editorScrollOffset = Math.max(0, this.editorScrollOffset - step);
        }
        this.renderEditorFields();
    }

    private getMaxEditorScroll(): number {
        const viewportHeight = 230;
        return Math.max(0, this.editorContentHeight - viewportHeight);
    }

    private buildInitialRowData(): RowData {
        const referenceRow = this.stagedRows[0] ?? this.currentRows[0];
        const row: RowData = {};
        if (referenceRow) {
            for (const [column, value] of Object.entries(referenceRow)) {
                if (this.isReadonlyColumn(column)) {
                    row[column] = this.buildNextId();
                } else if (typeof value === "number") {
                    row[column] = 0;
                } else if (typeof value === "boolean") {
                    row[column] = false;
                } else {
                    row[column] = "";
                }
            }
        } else {
            row.id = this.buildNextId();
        }
        return row;
    }

    private openRowEditor(rowIndex?: number, initialColumn?: string) {
        if (!this.isEditMode || !this.currentMode) {
            return;
        }
        if (this.currentMode === "POST") {
            this.rowEditorRowIndex = undefined;
            this.rowEditorDraft = this.buildInitialRowData();
        } else if (this.currentMode === "PUT") {
            if (rowIndex === undefined || rowIndex < 0 || rowIndex >= this.baseRowCount) {
                return;
            }
            this.rowEditorRowIndex = rowIndex;
            this.rowEditorDraft = { ...this.stagedRows[rowIndex] };
        } else {
            return;
        }
        this.rowEditorColumns = Object.keys(this.rowEditorDraft);
        this.rowEditorActiveColumn =
            initialColumn && !this.isReadonlyColumn(initialColumn)
                ? initialColumn
                : this.rowEditorColumns.find((column) => !this.isReadonlyColumn(column));
        this.rowEditorVisible = true;
        this.rowEditorTitle.setText(
            this.currentMode === "POST" ? "Create New Item" : "Modify Existing Item",
        );
        this.rowEditorHint.setText(
            "Click a field to edit. ID columns are read-only. Save stages changes until request confirmation.",
        );
        this.rowEditorBlocker.setVisible(true);
        this.rowEditorContainer.setVisible(true);
        this.renderRowEditorFields();
    }

    private closeRowEditor() {
        this.rowEditorVisible = false;
        this.rowEditorRowIndex = undefined;
        this.rowEditorDraft = {};
        this.rowEditorColumns = [];
        this.rowEditorActiveColumn = undefined;
        for (const object of this.rowEditorObjects) {
            object.destroy();
        }
        this.rowEditorObjects.length = 0;
        this.rowEditorBlocker.setVisible(false);
        this.rowEditorContainer.setVisible(false);
    }

    private renderRowEditorFields() {
        for (const object of this.rowEditorObjects) {
            object.destroy();
        }
        this.rowEditorObjects.length = 0;
        let y = -102;
        for (const column of this.rowEditorColumns) {
            const readonly = this.isReadonlyColumn(column);
            const isActive = this.rowEditorActiveColumn === column;
            const label = this.scene.add.text(-220, y, readonly ? `${column} (readonly):` : `${column}:`, {
                color: readonly ? "#666" : "#222",
                fontSize: "14px",
                fontStyle: "bold",
            });
            const value = String(this.rowEditorDraft[column] ?? "");
            const valueText = this.scene.add.text(-34, y, isActive ? `${value}_` : value, {
                color: readonly ? "#666" : "#1a5fb4",
                fontSize: "14px",
                backgroundColor: readonly ? "#f1f1f1" : "#eaf2ff",
                padding: { left: 4, right: 4, top: 2, bottom: 2 },
            });
            if (!readonly) {
                valueText.setInteractive({ useHandCursor: true });
                valueText.on("pointerdown", () => {
                    this.rowEditorActiveColumn = column;
                    this.renderRowEditorFields();
                });
            }
            this.rowEditorContainer.add([label, valueText]);
            this.rowEditorObjects.push(label, valueText);
            y += 28;
        }
    }

    private onRowEditorKeydown(event: KeyboardEvent) {
        if (!this.rowEditorActiveColumn || !this.rowEditorVisible) {
            return;
        }
        const column = this.rowEditorActiveColumn;
        const existingValue = this.rowEditorDraft[column];
        const currentValue = String(this.rowEditorDraft[column] ?? "");
        if (event.key === "Backspace") {
            event.preventDefault();
            this.rowEditorDraft[column] = this.coerceValue(
                currentValue.slice(0, -1),
                existingValue,
            );
            this.renderRowEditorFields();
            return;
        }
        if (event.key === "Escape") {
            this.closeRowEditor();
            return;
        }
        if (event.key.length !== 1) {
            return;
        }
        this.rowEditorDraft[column] = this.coerceValue(
            `${currentValue}${event.key}`,
            existingValue,
        );
        this.renderRowEditorFields();
    }

    private saveRowEditor() {
        if (!this.rowEditorVisible || !this.currentMode) {
            return;
        }
        const committedRow = { ...this.rowEditorDraft };
        if (this.currentMode === "POST") {
            this.stagedRows.push(committedRow);
            this.currentPageIndex = this.getTotalPages(this.stagedRows) - 1;
        } else if (this.currentMode === "PUT") {
            if (
                this.rowEditorRowIndex === undefined ||
                this.rowEditorRowIndex < 0 ||
                this.rowEditorRowIndex >= this.stagedRows.length
            ) {
                return;
            }
            this.stagedRows[this.rowEditorRowIndex] = committedRow;
        }
        this.hooks?.onFieldEdited?.();
        this.closeRowEditor();
        this.renderEditorFields();
    }

    private toggleDeleteRowSelection(rowIndex: number) {
        if (this.currentMode !== "DELETE") {
            return;
        }
        if (this.selectedDeleteRows.has(rowIndex)) {
            this.selectedDeleteRows.delete(rowIndex);
        } else {
            this.selectedDeleteRows.add(rowIndex);
            this.purgeFieldSelectionsForRow(rowIndex);
        }
        this.renderEditorFields();
    }

    private toggleDeleteFieldSelection(rowIndex: number, column: string) {
        if (this.currentMode !== "DELETE" || this.isReadonlyColumn(column)) {
            return;
        }
        if (this.selectedDeleteRows.has(rowIndex)) {
            return;
        }
        const fieldKey = `${rowIndex}:${column}`;
        if (this.selectedDeleteFields.has(fieldKey)) {
            this.selectedDeleteFields.delete(fieldKey);
        } else {
            this.selectedDeleteFields.add(fieldKey);
        }
        this.renderEditorFields();
    }

    private purgeFieldSelectionsForRow(rowIndex: number) {
        for (const key of this.selectedDeleteFields) {
            if (key.startsWith(`${rowIndex}:`)) {
                this.selectedDeleteFields.delete(key);
            }
        }
    }

    private rowHasAnyFieldDeleteMark(rowIndex: number, columns: string[]): boolean {
        for (const column of columns) {
            if (this.isReadonlyColumn(column)) {
                continue;
            }
            if (this.selectedDeleteFields.has(`${rowIndex}:${column}`)) {
                return true;
            }
        }
        return false;
    }

    private applyDeleteSelectionToRow(row: RowData, index: number): RowData {
        if (this.selectedDeleteRows.has(index)) {
            return this.buildSoftDeletedRow(row);
        }
        const next: RowData = { ...row };
        for (const key of Object.keys(next)) {
            if (this.isReadonlyColumn(key)) {
                continue;
            }
            if (this.selectedDeleteFields.has(`${index}:${key}`)) {
                next[key] = null;
            }
        }
        return next;
    }

    private buildSoftDeletedRow(row: RowData): RowData {
        const nextRow: RowData = {};
        for (const [column, value] of Object.entries(row)) {
            if (column.toLowerCase().endsWith("id")) {
                nextRow[column] = value;
            } else {
                nextRow[column] = null;
            }
        }
        return nextRow;
    }
}

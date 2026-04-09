import type { EntityType } from "./diagram-handler";

type RowData = Record<string, unknown>;
interface EditableFieldRef {
    rowIndex: number;
    column: string;
}

type MutationKind = "none" | "insert" | "update" | "delete";

interface TableViewModalHooks {
    onFieldEdited?: () => void;
    onEditsConfirmed?: (payload: {
        entityType: EntityType;
        mutation: MutationKind;
    }) => void;
}

interface TableViewShowOptions {
    allowEditing?: boolean;
}

export class TableViewModal {
    private readonly scene: Phaser.Scene;
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
    private readonly editorContainer: Phaser.GameObjects.Container;
    private readonly editorObjects: Phaser.GameObjects.GameObject[] = [];
    private isEditMode = false;
    private currentEntityType?: EntityType;
    private currentRows: RowData[] = [];
    private stagedRows: RowData[] = [];
    private activeField?: EditableFieldRef;
    private canEditCurrentTable = true;
    private readonly hooks?: TableViewModalHooks;
    private readonly keyboardHandler: (event: KeyboardEvent) => void;

    constructor(scene: Phaser.Scene, hooks?: TableViewModalHooks) {
        this.scene = scene;
        this.hooks = hooks;
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
        this.closeButton.on("pointerdown", () => this.hide());

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
            this.editButton,
            this.closeButton,
        ]);
        this.container.setDepth(1000);
        this.container.setVisible(false);

        this.keyboardHandler = (event: KeyboardEvent) => this.onKeydown(event);
        window.addEventListener("keydown", this.keyboardHandler);
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener("keydown", this.keyboardHandler);
        });
    }

    show(entityType: EntityType, rows: RowData[], options?: TableViewShowOptions) {
        this.currentEntityType = entityType;
        this.canEditCurrentTable = options?.allowEditing ?? true;
        this.currentRows = rows;
        this.stagedRows = rows.map((row) => ({ ...row }));
        this.activeField = undefined;
        this.isEditMode = false;
        this.titleText.setText(`${entityType} table data`);
        this.renderTable();
        this.container.setVisible(true);
    }

    hide() {
        this.currentEntityType = undefined;
        this.currentRows = [];
        this.stagedRows = [];
        this.activeField = undefined;
        this.canEditCurrentTable = true;
        this.isEditMode = false;
        this.container.setVisible(false);
    }

    private buildTableText(rows: RowData[]): string {
        if (rows.length === 0) {
            return "No rows available for this table.";
        }

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
        const body = rows.map((row) => {
            const values = columns.map((column) => String(row[column] ?? ""));
            return this.joinRow(values, widths);
        });

        return [header, separator, ...body].join("\n");
    }

    private joinRow(values: string[], widths: number[]): string {
        return values.map((value, index) => value.padEnd(widths[index], " ")).join(" | ");
    }

    private renderTable() {
        this.tableText.setVisible(!this.isEditMode);
        this.editorContainer.setVisible(this.isEditMode);
        this.confirmButton.setVisible(this.isEditMode);
        this.addRowButton.setVisible(this.isEditMode);
        this.deleteRowButton.setVisible(this.isEditMode);
        this.editButton.setColor(this.isEditMode ? "#0b8f08" : "#1a5fb4");

        if (this.isEditMode) {
            this.renderEditorFields();
        } else {
            this.tableText.setText(this.buildTableText(this.currentRows));
            this.clearEditorObjects();
        }

        this.hintText.setText(
            this.isEditMode
                ? "Edit mode on. Click a value cell and type. Confirm to save. ID fields are read-only."
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

        this.isEditMode = !this.isEditMode;
        this.activeField = undefined;
        if (!this.isEditMode) {
            this.stagedRows = this.currentRows.map((row) => ({ ...row }));
        }
        this.renderTable();
    }

    private confirmEdits() {
        if (!this.isEditMode) {
            return;
        }
        const beforeRows = this.currentRows.map((row) => ({ ...row }));
        const afterRows = this.stagedRows.map((row) => ({ ...row }));
        for (let index = 0; index < this.currentRows.length; index += 1) {
            Object.assign(this.currentRows[index], this.stagedRows[index]);
        }
        if (this.currentRows.length > this.stagedRows.length) {
            this.currentRows.length = this.stagedRows.length;
        }
        if (this.stagedRows.length > this.currentRows.length) {
            for (let index = this.currentRows.length; index < this.stagedRows.length; index += 1) {
                this.currentRows.push({ ...this.stagedRows[index] });
            }
        }
        const mutation = this.detectMutation(beforeRows, afterRows);
        if (this.currentEntityType) {
            this.hooks?.onEditsConfirmed?.({
                entityType: this.currentEntityType,
                mutation,
            });
        }
        this.isEditMode = false;
        this.activeField = undefined;
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

        let y = -120;
        for (let rowIndex = 0; rowIndex < this.stagedRows.length; rowIndex += 1) {
            const rowLabel = this.scene.add.text(-350, y, `Row ${rowIndex + 1}`, {
                color: "#111",
                fontSize: "13px",
                fontStyle: "bold",
            });
            this.editorContainer.add(rowLabel);
            this.editorObjects.push(rowLabel);
            y += 20;

            for (const column of columns) {
                const readonly = this.isReadonlyColumn(column);
                const labelText = this.scene.add.text(
                    -335,
                    y,
                    readonly ? `${column} (readonly):` : `${column}:`,
                    {
                        color: readonly ? "#666" : "#222",
                        fontSize: "13px",
                    },
                );
                this.editorContainer.add(labelText);
                this.editorObjects.push(labelText);

                const value = String(this.stagedRows[rowIndex][column] ?? "");
                const isActive =
                    this.activeField?.rowIndex === rowIndex &&
                    this.activeField.column === column;
                const displayValue = isActive ? `${value}_` : value;
                const valueText = this.scene.add.text(-145, y, displayValue, {
                    color: readonly ? "#666" : "#1a5fb4",
                    fontSize: "13px",
                    backgroundColor: readonly ? "#f1f1f1" : "#eaf2ff",
                    padding: { left: 4, right: 4, top: 2, bottom: 2 },
                });
                if (!readonly) {
                    valueText.setInteractive({ useHandCursor: true });
                    valueText.on("pointerdown", () => {
                        this.activeField = { rowIndex, column };
                        this.renderEditorFields();
                    });
                }
                this.editorContainer.add(valueText);
                this.editorObjects.push(valueText);
                y += 18;
            }

            y += 12;
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
        if (!this.isEditMode || !this.activeField || !this.container.visible) {
            return;
        }

        const { rowIndex, column } = this.activeField;
        if (!this.stagedRows[rowIndex] || this.isReadonlyColumn(column)) {
            return;
        }

        const currentValue = String(this.stagedRows[rowIndex][column] ?? "");
        if (event.key === "Backspace") {
            event.preventDefault();
            const nextValue = currentValue.slice(0, -1);
            this.stagedRows[rowIndex][column] = this.coerceValue(
                nextValue,
                this.currentRows[rowIndex]?.[column],
            );
            this.hooks?.onFieldEdited?.();
            this.renderEditorFields();
            return;
        }
        if (event.key === "Escape") {
            this.activeField = undefined;
            this.renderEditorFields();
            return;
        }
        if (event.key.length !== 1) {
            return;
        }
        const nextValue = `${currentValue}${event.key}`;
        this.stagedRows[rowIndex][column] = this.coerceValue(
            nextValue,
            this.currentRows[rowIndex]?.[column],
        );
        this.hooks?.onFieldEdited?.();
        this.renderEditorFields();
    }

    private addRow() {
        if (!this.isEditMode || this.currentEntityType === undefined) {
            return;
        }
        const referenceRow = this.stagedRows[0] ?? this.currentRows[0];
        const newRow: RowData = {};
        if (referenceRow) {
            for (const [column, value] of Object.entries(referenceRow)) {
                if (column.toLowerCase() === "id") {
                    newRow[column] = this.buildNextId();
                    continue;
                }
                if (typeof value === "number") {
                    newRow[column] = 0;
                } else if (typeof value === "boolean") {
                    newRow[column] = false;
                } else {
                    newRow[column] = "";
                }
            }
        } else {
            newRow.id = this.buildNextId();
        }
        this.stagedRows.push(newRow);
        this.activeField = undefined;
        this.renderEditorFields();
    }

    private deleteActiveRow() {
        if (!this.isEditMode || !this.activeField) {
            return;
        }
        const { rowIndex } = this.activeField;
        if (rowIndex < 0 || rowIndex >= this.stagedRows.length) {
            return;
        }
        this.stagedRows.splice(rowIndex, 1);
        this.activeField = undefined;
        this.renderEditorFields();
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
        let prefix = "r";
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
}

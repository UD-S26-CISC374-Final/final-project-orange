export type ID = string;
import {
    METHOD_TABLE_STROKE,
    NO_METHOD_TABLE_STROKE,
} from "../../helpers/method-ui-colors";
import {
    TableViewModal,
    type RowData as TableRowData,
    type TableViewSavePayload,
} from "./table-view-modal";

export type EntityType =
    | "USER"
    | "PET"
    | "EMPLOYMENT"
    | "JOB"
    | "HOUSE"
    | "VEHICLE";

export interface User {
    id: ID;
    name: string;
    age: number;
    feeling: string;
    money: number;
}

export interface Pet {
    id: ID;
    species: string;
    name: string;
    age: number;
    ownerId: ID;
}

export interface Job {
    id: ID;
    title: string;
    yearlySalary: number;
    location: string;
}

export interface Employment {
    id: ID;
    userId: ID;
    jobId: ID;
}

export interface House {
    id: ID;
    ownerId: ID;
    color: string;
    listingPrice: number;
}

export interface Vehicle {
    id: ID;
    houseId: ID;
    color: string;
    year: number;
    model: string;
    price: number;
}

export interface RelationshipDef {
    fromType: EntityType;
    toType: EntityType;
    kind: "one-to-many" | "one-to-one" | "many-to-one";
    foreignKey: string;
    label: string;
}

export type ApiRequestMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequestObjective {
    method: ApiRequestMethod;
    targetType: EntityType;
    description: string;
    targetRowId?: string;
    targetField?: string;
    /** For POST: non-id columns that the new row must match (e.g. USER name/age/feeling/money). */
    expectedInsertFields?: Record<string, unknown>;
}

export interface RequestValidationResult {
    ok: boolean;
    errorCode: string;
    message: string;
    appliedEntities?: EntityType[];
    failedEntities?: Array<{
        entityType: EntityType;
        errorCode: string;
        message: string;
    }>;
}

export const REQUEST_ERROR_CODES = {
    NO_ACTIVE_REQUEST: "REQ_000",
    METHOD_NOT_SELECTED: "REQ_001",
    METHOD_MISMATCH: "REQ_002",
    NO_ACTION_TRACE: "REQ_003",
    WRONG_TARGET_TABLE: "REQ_004",
    WRONG_MUTATION_KIND: "REQ_005",
    RELATIONAL_RULE_FAILED: "REQ_006",
} as const;

export type PendingMutationOperation =
    | {
          kind: "insert";
          rowId: string;
          row: Record<string, unknown>;
      }
    | {
          kind: "delete";
          rowId: string;
      }
    | {
          kind: "update";
          rowId: string;
          changes: Record<string, unknown>;
      };

export type PendingRequestEntry =
    | {
          id: string;
          method: "GET";
          entityType: EntityType;
          summary: string;
          selectedTargets: string[];
      }
    | {
          id: string;
          method: "POST" | "PUT" | "DELETE";
          entityType: EntityType;
          summary: string;
          beforeRows: Record<string, unknown>[];
          afterRows: Record<string, unknown>[];
          operations: PendingMutationOperation[];
      };

export interface ConfirmPendingRequestCandidate {
    npcId: string;
    objective: ApiRequestObjective;
}

export interface ConfirmPendingRequestsResult {
    matched: Array<{
        pendingId: string;
        npcId: string;
        summary: string;
    }>;
    unmatched: Array<{
        pendingId: string;
        summary: string;
        reason: string;
    }>;
}

export const RELATIONSHIPS: RelationshipDef[] = [
    {
        fromType: "USER",
        toType: "PET",
        kind: "one-to-many",
        foreignKey: "ownerId",
        label: "owns",
    },
    {
        fromType: "USER",
        toType: "EMPLOYMENT",
        kind: "one-to-many",
        foreignKey: "userId",
        label: "has",
    },
    {
        fromType: "JOB",
        toType: "EMPLOYMENT",
        kind: "one-to-many",
        foreignKey: "jobId",
        label: "defines",
    },
    {
        fromType: "USER",
        toType: "HOUSE",
        kind: "one-to-one",
        foreignKey: "ownerId",
        label: "owns",
    },
    {
        fromType: "HOUSE",
        toType: "VEHICLE",
        kind: "one-to-many",
        foreignKey: "houseId",
        label: "contains",
    },
];

interface TableLayout {
    type: EntityType;
    x: number;
    y: number;
    fields: string[];
}

const TABLE_LAYOUTS: TableLayout[] = [
    {
        type: "USER",
        x: 180,
        y: 180,
        fields: ["id PK", "name", "age", "feeling", "money"],
    },
    {
        type: "PET",
        x: 470,
        y: 120,
        fields: ["id PK", "species", "name", "age", "ownerId FK"],
    },
    {
        type: "EMPLOYMENT",
        x: 470,
        y: 260,
        fields: ["id PK", "userId FK", "jobId FK"],
    },
    {
        type: "JOB",
        x: 760,
        y: 260,
        fields: ["id PK", "title", "yearlySalary", "location"],
    },
    {
        type: "HOUSE",
        x: 470,
        y: 400,
        fields: ["id PK", "ownerId FK", "color", "listingPrice"],
    },
    {
        type: "VEHICLE",
        x: 760,
        y: 400,
        fields: ["id PK", "houseId FK", "color", "year", "model", "price"],
    },
];

export class ERStore {
    users = new Map<ID, User>();
    pets = new Map<ID, Pet>();
    jobs = new Map<ID, Job>();
    employments = new Map<ID, Employment>();
    houses = new Map<ID, House>();
    vehicles = new Map<ID, Vehicle>();

    getTableForType(type: EntityType): Map<ID, unknown> {
        switch (type) {
            case "USER":
                return this.users;
            case "PET":
                return this.pets;
            case "EMPLOYMENT":
                return this.employments;
            case "JOB":
                return this.jobs;
            case "HOUSE":
                return this.houses;
            case "VEHICLE":
                return this.vehicles;
        }
    }

    validateBasicRelationalRules(): string[] {
        const errors: string[] = [];

        for (const pet of this.pets.values()) {
            if (!this.users.has(pet.ownerId)) {
                errors.push(`PET ${pet.id} has invalid ownerId ${pet.ownerId}`);
            }
        }

        for (const employment of this.employments.values()) {
            if (!this.users.has(employment.userId)) {
                errors.push(
                    `EMPLOYMENT ${employment.id} has invalid userId ${employment.userId}`,
                );
            }
            if (!this.jobs.has(employment.jobId)) {
                errors.push(
                    `EMPLOYMENT ${employment.id} has invalid jobId ${employment.jobId}`,
                );
            }
        }

        const ownerToHouseCount = new Map<ID, number>();
        for (const house of this.houses.values()) {
            if (!this.users.has(house.ownerId)) {
                errors.push(
                    `HOUSE ${house.id} has invalid ownerId ${house.ownerId}`,
                );
            }
            ownerToHouseCount.set(
                house.ownerId,
                (ownerToHouseCount.get(house.ownerId) ?? 0) + 1,
            );
        }

        for (const [ownerId, count] of ownerToHouseCount.entries()) {
            if (count > 1) {
                errors.push(
                    `USER ${ownerId} violates one-to-one with HOUSE (${count} houses)`,
                );
            }
        }

        for (const vehicle of this.vehicles.values()) {
            if (!this.houses.has(vehicle.houseId)) {
                errors.push(
                    `VEHICLE ${vehicle.id} has invalid houseId ${vehicle.houseId}`,
                );
            }
        }

        return errors;
    }
}

class EntityNodeView extends Phaser.GameObjects.Container {
    readonly entityType: EntityType;
    private bg: Phaser.GameObjects.Rectangle;
    private draggedDuringPointer = false;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        entityType: EntityType,
        fields: string[],
        onSelected: (entityType: EntityType) => void,
    ) {
        super(scene, x, y);
        this.entityType = entityType;

        this.bg = scene.add.rectangle(0, 0, 200, 120, 0xf5f5f5).setOrigin(0.5);
        const title = scene.add.text(-84, -47, entityType, {
            color: "#000",
            fontSize: "18px",
        });
        const body = scene.add.text(-84, -20, fields.join("\n"), {
            color: "#222",
            fontSize: "13px",
            backgroundColor: "#f5f5f5",
        });

        this.add([this.bg, title, body]);
        scene.add.existing(this);

        this.setDepth(10);
        this.setSize(200, 120);
        this.setInteractive({ useHandCursor: true });
        scene.input.setDraggable(this);

        this.on("pointerdown", () => {
            this.draggedDuringPointer = false;
        });
        this.on("pointerup", () => {
            if (!this.draggedDuringPointer) {
                onSelected(this.entityType);
            }
        });
    }

    setVisualState(
        isSelected: boolean,
        isHovered: boolean,
        highlightColor?: number,
    ) {
        if (!isSelected && !isHovered) {
            this.bg.setStrokeStyle(3, 0x000000, 1);
            return;
        }
        const stroke = highlightColor ?? NO_METHOD_TABLE_STROKE;
        this.bg.setStrokeStyle(isSelected ? 4 : 3, stroke, 1);
    }

    markDragged() {
        this.draggedDuringPointer = true;
    }
}

class RelationshipEdgeView {
    private graphics: Phaser.GameObjects.Graphics;
    private label: Phaser.GameObjects.Text;
    private fromNode: EntityNodeView;
    private toNode: EntityNodeView;

    constructor(
        scene: Phaser.Scene,
        fromNode: EntityNodeView,
        toNode: EntityNodeView,
        rel: RelationshipDef,
    ) {
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(2);
        this.label = scene.add.text(0, 0, rel.label, {
            color: "#444",
            fontSize: "12px",
        });
        this.label.setDepth(3);
        this.redraw();
    }

    redraw() {
        if (!this.fromNode.visible || !this.toNode.visible) {
            this.graphics.setVisible(false);
            this.label.setVisible(false);
            return;
        }

        const x1 = this.fromNode.x;
        const y1 = this.fromNode.y;
        const x2 = this.toNode.x;
        const y2 = this.toNode.y;

        this.graphics.setVisible(true);
        this.label.setVisible(true);
        this.graphics.clear();
        this.graphics.lineStyle(2, 0x444444, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
        this.graphics.strokePath();
        this.label.setPosition((x1 + x2) / 2, (y1 + y2) / 2);
    }
}

export interface ERDiagramOptions {
    x?: number;
    y?: number;
    initiallyHiddenTables?: EntityType[];
    store?: ERStore;
    /** Called when pending table edits change (for the Changes panel). */
    onPendingChange?: () => void;
}

export class ERDiagram {
    readonly store: ERStore;
    private scene: Phaser.Scene;
    private nodes = new Map<EntityType, EntityNodeView>();
    private edges: RelationshipEdgeView[] = [];
    private hiddenTables = new Set<EntityType>();
    private selectedType?: EntityType;
    private hoveredType?: EntityType;
    private xOffset: number;
    private yOffset: number;
    private tableViewModal: TableViewModal;
    private selectedRequestMethod?: ApiRequestMethod;
    private currentRequest?: ApiRequestObjective;
    private pendingRequests: PendingRequestEntry[] = [];
    private nextPendingId = 1;
    private onPendingChange?: () => void;

    constructor(scene: Phaser.Scene, options?: ERDiagramOptions) {
        this.scene = scene;
        this.store = options?.store ?? buildDefaultStore();
        this.xOffset = options?.x ?? 0;
        this.yOffset = options?.y ?? 0;

        for (const tableType of options?.initiallyHiddenTables ?? []) {
            this.hiddenTables.add(tableType);
        }

        this.onPendingChange = options?.onPendingChange;

        this.createViews();
        this.wireInteractions();
        this.tableViewModal = new TableViewModal(scene, {
            onRequestSaved: (payload) => this.savePendingRequest(payload),
        });
    }

    getPendingRequests(): PendingRequestEntry[] {
        return this.pendingRequests.map((entry) =>
            this.clonePendingEntry(entry),
        );
    }

    undoPendingRequest(pendingId: string): boolean {
        const idx = this.pendingRequests.findIndex(
            (entry) => entry.id === pendingId,
        );
        if (idx < 0) {
            return false;
        }
        const [removed] = this.pendingRequests.splice(idx, 1);
        this.syncVisibleEntityRows(new Set([removed.entityType]));
        this.onPendingChange?.();
        return true;
    }

    hasPendingChanges(): boolean {
        return this.pendingRequests.length > 0;
    }

    hasOpenModalLayer(): boolean {
        return this.tableViewModal.hasOpenLayer();
    }

    isTableModalVisible(): boolean {
        return this.tableViewModal.isVisible();
    }

    isTableRowEditorVisible(): boolean {
        return this.tableViewModal.isRowEditorVisible();
    }

    closeTopModalLayer(): boolean {
        return this.tableViewModal.closeTopLayer();
    }

    confirmPendingRequests(
        candidates: ConfirmPendingRequestCandidate[],
    ): ConfirmPendingRequestsResult {
        const matched: ConfirmPendingRequestsResult["matched"] = [];
        const unmatched: ConfirmPendingRequestsResult["unmatched"] = [];
        const matchedNpcIds = new Set<string>();
        const touchedEntities = new Set<EntityType>();

        for (const entry of this.pendingRequests) {
            let resolvedCandidate: ConfirmPendingRequestCandidate | undefined;
            let specificReason = "did not match any active NPC request";

            for (const candidate of candidates) {
                if (matchedNpcIds.has(candidate.npcId)) {
                    continue;
                }
                const reason = this.getEntryMismatchReason(
                    entry,
                    candidate.objective,
                );
                if (!reason) {
                    resolvedCandidate = candidate;
                    break;
                }
                if (this.isComparableObjective(entry, candidate.objective)) {
                    specificReason = reason;
                }
            }

            if (!resolvedCandidate) {
                unmatched.push({
                    pendingId: entry.id,
                    summary: entry.summary,
                    reason: specificReason,
                });
                touchedEntities.add(entry.entityType);
                continue;
            }

            matchedNpcIds.add(resolvedCandidate.npcId);
            if (entry.method !== "GET") {
                this.commitMutationEntry(entry);
            }
            matched.push({
                pendingId: entry.id,
                npcId: resolvedCandidate.npcId,
                summary: entry.summary,
            });
            touchedEntities.add(entry.entityType);
        }

        this.pendingRequests = [];
        this.syncVisibleEntityRows(touchedEntities);
        this.onPendingChange?.();

        return { matched, unmatched };
    }

    setSelectedRequestMethod(method: ApiRequestMethod) {
        this.selectedRequestMethod = method;
        this.refreshTableHighlightStyles();
    }

    getSelectedRequestMethod(): ApiRequestMethod | undefined {
        return this.selectedRequestMethod;
    }

    clearSelectedRequestMethod() {
        this.selectedRequestMethod = undefined;
        this.selectedType = undefined;
        this.tableViewModal.hide();
        this.refreshTableHighlightStyles();
    }

    startRequest(request: ApiRequestObjective) {
        this.currentRequest = request;
    }

    getCurrentRequest(): ApiRequestObjective | undefined {
        return this.currentRequest;
    }

    clearCurrentRequest() {
        this.currentRequest = undefined;
    }

    submitCurrentRequest(): RequestValidationResult {
        return {
            ok: false,
            errorCode: REQUEST_ERROR_CODES.NO_ACTIVE_REQUEST,
            message:
                "Legacy single-request submission is disabled. Use confirmPendingRequests().",
        };
    }

    revealTable(type: EntityType) {
        this.hiddenTables.delete(type);
        this.nodes.get(type)?.setVisible(true);
        this.redrawEdges();
    }

    hideTable(type: EntityType) {
        this.hiddenTables.add(type);
        this.nodes.get(type)?.setVisible(false);
        this.redrawEdges();
    }

    validateRules(): string[] {
        return this.store.validateBasicRelationalRules();
    }

    private createViews() {
        for (const layout of TABLE_LAYOUTS) {
            const node = new EntityNodeView(
                this.scene,
                layout.x + this.xOffset,
                layout.y + this.yOffset,
                layout.type,
                layout.fields,
                (entityType) => this.selectNode(entityType),
            );
            node.on("pointerover", () => {
                this.hoveredType = layout.type;
                this.refreshTableHighlightStyles();
            });
            node.on("pointerout", () => {
                if (this.hoveredType === layout.type) {
                    this.hoveredType = undefined;
                }
                this.refreshTableHighlightStyles();
            });
            node.setVisible(!this.hiddenTables.has(layout.type));
            this.nodes.set(layout.type, node);
        }

        for (const rel of RELATIONSHIPS) {
            const fromNode = this.nodes.get(rel.fromType);
            const toNode = this.nodes.get(rel.toType);
            if (!fromNode || !toNode) {
                continue;
            }
            this.edges.push(
                new RelationshipEdgeView(this.scene, fromNode, toNode, rel),
            );
        }

        this.redrawEdges();
    }

    private wireInteractions() {
        this.scene.input.on(
            "drag",
            (
                _pointer: Phaser.Input.Pointer,
                gameObject: Phaser.GameObjects.GameObject,
                dragX: number,
                dragY: number,
            ) => {
                if (!(gameObject instanceof EntityNodeView)) {
                    return;
                }
                gameObject.markDragged();
                gameObject.x = dragX;
                gameObject.y = dragY;
                this.redrawEdges();
            },
        );
    }

    private selectNode(entityType: EntityType) {
        if (!this.selectedRequestMethod) {
            return;
        }
        this.selectedType = entityType;
        const rows = this.getRowsForTableView(entityType);
        this.tableViewModal.show(entityType, rows, {
            allowEditing: Boolean(this.selectedRequestMethod),
            mode: this.selectedRequestMethod,
        });
        this.refreshTableHighlightStyles();
    }

    private refreshTableHighlightStyles() {
        const stroke =
            this.selectedRequestMethod ?
                METHOD_TABLE_STROKE[this.selectedRequestMethod]
            :   NO_METHOD_TABLE_STROKE;
        for (const [type, node] of this.nodes.entries()) {
            const isSelected =
                this.selectedType !== undefined && type === this.selectedType;
            const isHovered =
                this.hoveredType !== undefined && type === this.hoveredType;
            node.setVisualState(isSelected, isHovered, stroke);
        }
    }

    private redrawEdges() {
        for (const edge of this.edges) {
            edge.redraw();
        }
    }

    private cloneRows(
        rows: Record<string, unknown>[],
    ): Record<string, unknown>[] {
        return rows.map((row) => ({ ...row }));
    }

    private applyRowsToStore(
        entityType: EntityType,
        rows: Record<string, unknown>[],
    ) {
        const tableMap = this.store.getTableForType(entityType);
        tableMap.clear();
        for (const row of rows) {
            const rowId = String(row.id ?? "");
            if (!rowId) {
                continue;
            }
            tableMap.set(rowId, row);
        }
    }

    private savePendingRequest(payload: TableViewSavePayload): void {
        if (payload.method === "GET") {
            if (payload.selectedTargets.length === 0) {
                return;
            }
            this.pendingRequests.push({
                id: `pending-${this.nextPendingId++}`,
                method: "GET",
                entityType: payload.entityType,
                selectedTargets: [...payload.selectedTargets],
                summary: this.buildGetSummary(
                    payload.entityType,
                    payload.selectedTargets,
                ),
            });
            this.onPendingChange?.();
            return;
        }

        if (payload.mutation === "none") {
            return;
        }
        const operations = this.computeMutationOperations(
            payload.beforeRows,
            payload.afterRows,
        );
        if (operations.length === 0) {
            return;
        }

        this.pendingRequests.push({
            id: `pending-${this.nextPendingId++}`,
            method: payload.method,
            entityType: payload.entityType,
            summary: this.buildMutationSummary(
                payload.method,
                payload.entityType,
                operations,
            ),
            beforeRows: this.cloneRows(payload.beforeRows),
            afterRows: this.cloneRows(payload.afterRows),
            operations,
        });
        this.syncVisibleEntityRows(new Set([payload.entityType]));
        this.onPendingChange?.();
    }

    private getRowsForTableView(
        entityType: EntityType,
    ): Record<string, unknown>[] {
        let rows = this.getStoreRows(entityType);
        for (const entry of this.pendingRequests) {
            if (entry.method === "GET" || entry.entityType !== entityType) {
                continue;
            }
            rows = this.applyMutationOperationsToRows(rows, entry.operations);
        }
        return this.cloneRows(rows);
    }

    private getStoreRows(entityType: EntityType): Record<string, unknown>[] {
        return Array.from(this.store.getTableForType(entityType).values())
            .map((row) => ({ ...(row as Record<string, unknown>) }))
            .sort((a, b) =>
                String(a.id ?? "").localeCompare(String(b.id ?? "")),
            );
    }

    private computeMutationOperations(
        beforeRows: Record<string, unknown>[],
        afterRows: Record<string, unknown>[],
    ): PendingMutationOperation[] {
        const operations: PendingMutationOperation[] = [];
        const beforeById = new Map(
            beforeRows
                .map((row) => [String(row.id ?? ""), row] as const)
                .filter(([id]) => id.length > 0),
        );
        const afterById = new Map(
            afterRows
                .map((row) => [String(row.id ?? ""), row] as const)
                .filter(([id]) => id.length > 0),
        );

        for (const [rowId, afterRow] of afterById) {
            const beforeRow = beforeById.get(rowId);
            if (!beforeRow) {
                operations.push({
                    kind: "insert",
                    rowId,
                    row: { ...afterRow },
                });
                continue;
            }
            const changes: Record<string, unknown> = {};
            for (const key of Object.keys(afterRow)) {
                if (key === "id") {
                    continue;
                }
                if (
                    JSON.stringify(beforeRow[key]) !==
                    JSON.stringify(afterRow[key])
                ) {
                    changes[key] = afterRow[key];
                }
            }
            if (Object.keys(changes).length > 0) {
                operations.push({
                    kind: "update",
                    rowId,
                    changes,
                });
            }
        }

        for (const rowId of beforeById.keys()) {
            if (!afterById.has(rowId)) {
                operations.push({
                    kind: "delete",
                    rowId,
                });
            }
        }

        return operations;
    }

    private applyMutationOperationsToRows(
        rows: Record<string, unknown>[],
        operations: PendingMutationOperation[],
    ): Record<string, unknown>[] {
        const byId = new Map(
            rows
                .map((row) => [String(row.id ?? ""), { ...row }] as const)
                .filter(([id]) => id.length > 0),
        );
        for (const op of operations) {
            if (op.kind === "insert") {
                byId.set(op.rowId, { ...op.row });
                continue;
            }
            if (op.kind === "delete") {
                byId.delete(op.rowId);
                continue;
            }
            const current = byId.get(op.rowId) ?? { id: op.rowId };
            byId.set(op.rowId, {
                ...current,
                ...op.changes,
                id: op.rowId,
            });
        }
        return Array.from(byId.values()).sort((a, b) =>
            String(a.id ?? "").localeCompare(String(b.id ?? "")),
        );
    }

    private clonePendingEntry(entry: PendingRequestEntry): PendingRequestEntry {
        if (entry.method === "GET") {
            return {
                ...entry,
                selectedTargets: [...entry.selectedTargets],
            };
        }
        return {
            ...entry,
            beforeRows: this.cloneRows(entry.beforeRows),
            afterRows: this.cloneRows(entry.afterRows),
            operations: entry.operations.map((op) => {
                if (op.kind === "insert") {
                    return { ...op, row: { ...op.row } };
                }
                if (op.kind === "update") {
                    return { ...op, changes: { ...op.changes } };
                }
                return { ...op };
            }),
        };
    }

    private buildGetSummary(
        entityType: EntityType,
        selectedTargets: string[],
    ): string {
        if (selectedTargets.length === 1) {
            const label = this.formatGetSelectionToken(selectedTargets[0]);
            return `[GET] ${entityType}: ${label}`;
        }
        return `[GET] ${entityType}: ${selectedTargets.length} selections`;
    }

    private buildMutationSummary(
        method: "POST" | "PUT" | "DELETE",
        entityType: EntityType,
        operations: PendingMutationOperation[],
    ): string {
        if (operations.length === 1) {
            const op = operations[0];
            if (op.kind === "insert") {
                return `[${method}] ${entityType}: add row ${op.rowId}`;
            }
            if (op.kind === "delete") {
                return `[${method}] ${entityType}: remove row ${op.rowId}`;
            }
            const fields = Object.keys(op.changes);
            if (fields.length === 1) {
                return `[${method}] ${entityType}: ${op.rowId}.${fields[0]}`;
            }
            return `[${method}] ${entityType}: ${op.rowId} (${fields.length} fields)`;
        }
        return `[${method}] ${entityType}: ${operations.length} changes`;
    }

    private formatGetSelectionToken(token: string): string {
        if (token.startsWith("row:")) {
            return `row ${token.slice(4)}`;
        }
        if (token.startsWith("field:")) {
            const rest = token.slice(6);
            const colon = rest.indexOf(":");
            if (colon >= 0) {
                const rowId = rest.slice(0, colon);
                const field = rest.slice(colon + 1);
                return `${field} (row ${rowId})`;
            }
        }
        return token;
    }

    private getEntryMismatchReason(
        entry: PendingRequestEntry,
        objective: ApiRequestObjective,
    ): string | undefined {
        if (entry.method !== objective.method) {
            return `expected ${objective.method}, got ${entry.method}`;
        }
        if (entry.entityType !== objective.targetType) {
            return `expected ${objective.targetType}, got ${entry.entityType}`;
        }

        if (entry.method === "GET") {
            const selectedTargets = entry.selectedTargets;
            if (selectedTargets.length === 0) {
                return "GET request has no saved selections";
            }
            if (objective.targetRowId && objective.targetField) {
                const requiredToken = `field:${objective.targetRowId}:${objective.targetField}`;
                if (!selectedTargets.includes(requiredToken)) {
                    return `GET must include field ${objective.targetField} on row id ${objective.targetRowId}`;
                }
                return undefined;
            }
            if (objective.targetRowId) {
                const rowToken = `row:${objective.targetRowId}`;
                const hasRowSelection = selectedTargets.some(
                    (token) =>
                        token === rowToken ||
                        token.startsWith(`field:${objective.targetRowId}:`),
                );
                if (!hasRowSelection) {
                    return `GET must include selection for row id ${objective.targetRowId}`;
                }
                return undefined;
            }
            return undefined;
        }

        const specificError = this.validateSpecificMutationRequest(
            objective,
            entry.beforeRows,
            entry.afterRows,
        );
        return specificError;
    }

    private isComparableObjective(
        entry: PendingRequestEntry,
        objective: ApiRequestObjective,
    ): boolean {
        return (
            entry.method === objective.method &&
            entry.entityType === objective.targetType
        );
    }

    private commitMutationEntry(
        entry: Exclude<PendingRequestEntry, { method: "GET" }>,
    ): void {
        const currentRows = this.getStoreRows(entry.entityType);
        const nextRows = this.applyMutationOperationsToRows(
            currentRows,
            entry.operations,
        );
        this.applyRowsToStore(entry.entityType, nextRows);
    }

    private syncVisibleEntityRows(entityTypes: Set<EntityType>): void {
        for (const entityType of entityTypes) {
            this.tableViewModal.applyExternalRowsIfVisible(
                entityType,
                this.getRowsForTableView(entityType) as TableRowData[],
            );
        }
    }

    private validateSpecificMutationRequest(
        request: ApiRequestObjective,
        beforeRows: Record<string, unknown>[],
        afterRows: Record<string, unknown>[],
    ): string | undefined {
        if (request.method === "POST" && request.expectedInsertFields) {
            const beforeIds = new Set(
                beforeRows
                    .map((row) => String(row.id ?? ""))
                    .filter((id) => id.length > 0),
            );
            const inserted = afterRows.filter((row) => {
                const id = String(row.id ?? "");
                return id.length > 0 && !beforeIds.has(id);
            });
            if (inserted.length !== 1) {
                return "POST must add exactly one new row matching the requested details.";
            }
            const newRow = inserted[0];
            for (const [key, expected] of Object.entries(
                request.expectedInsertFields,
            )) {
                const actual = newRow[key];
                if (!this.valuesMatchInsertExpectation(actual, expected)) {
                    return `New row must have ${key} = ${String(expected)} (got ${String(actual)}).`;
                }
            }
            return undefined;
        }
        if (!request.targetRowId) {
            return undefined;
        }
        const beforeById = new Map(
            beforeRows
                .map((row) => [String(row.id ?? ""), row] as const)
                .filter(([id]) => id.length > 0),
        );
        const afterById = new Map(
            afterRows
                .map((row) => [String(row.id ?? ""), row] as const)
                .filter(([id]) => id.length > 0),
        );
        const beforeRow = beforeById.get(request.targetRowId);
        const afterRow = afterById.get(request.targetRowId);
        if (!beforeRow || !afterRow) {
            return `Target row id ${request.targetRowId} is required for this request.`;
        }

        if (request.method === "PUT") {
            if (request.targetField) {
                if (
                    beforeRow[request.targetField] ===
                    afterRow[request.targetField]
                ) {
                    return `PUT must modify ${request.targetField} on row id ${request.targetRowId}.`;
                }
                return undefined;
            }
            if (JSON.stringify(beforeRow) === JSON.stringify(afterRow)) {
                return `PUT must modify row id ${request.targetRowId}.`;
            }
            return undefined;
        }

        if (request.method === "DELETE") {
            if (request.targetField) {
                if (afterRow[request.targetField] !== null) {
                    return `DELETE must null ${request.targetField} on row id ${request.targetRowId}.`;
                }
                return undefined;
            }
            for (const key of Object.keys(afterRow)) {
                if (key.toLowerCase().endsWith("id")) {
                    continue;
                }
                if (afterRow[key] !== null) {
                    return `DELETE must null non-id values for row id ${request.targetRowId}.`;
                }
            }
        }
        return undefined;
    }

    private valuesMatchInsertExpectation(
        actual: unknown,
        expected: unknown,
    ): boolean {
        if (actual === expected) {
            return true;
        }
        if (typeof expected === "number" && typeof actual === "string") {
            const parsed = Number(actual);
            return !Number.isNaN(parsed) && parsed === expected;
        }
        if (typeof expected === "number" && typeof actual === "number") {
            return actual === expected;
        }
        return String(actual) === String(expected);
    }
}

export function buildDefaultStore(): ERStore {
    const store = new ERStore();
    store.users.set("u1", {
        id: "u1",
        name: "Alice",
        age: 22,
        feeling: "happy",
        money: 500,
    });
    store.users.set("u2", {
        id: "u2",
        name: "Bob",
        age: 30,
        feeling: "focused",
        money: 900,
    });
    store.users.set("u3", {
        id: "u3",
        name: "Carol",
        age: 28,
        feeling: "angry",
        money: 3200,
    });
    store.users.set("u4", {
        id: "u4",
        name: "David",
        age: 48,
        feeling: "87000",
        money: 1500,
    });
    store.pets.set("p1", {
        id: "p1",
        species: "dog",
        name: "Cleo",
        age: 3,
        ownerId: "u1",
    });
    store.jobs.set("j1", {
        id: "j1",
        title: "Engineer",
        yearlySalary: 95000,
        location: "Remote",
    });
    store.employments.set("e1", { id: "e1", userId: "u1", jobId: "j1" });
    store.houses.set("h1", {
        id: "h1",
        ownerId: "u1",
        color: "blue",
        listingPrice: 320000,
    });
    store.vehicles.set("v1", {
        id: "v1",
        houseId: "h1",
        color: "red",
        year: 2022,
        model: "sedan",
        price: 25000,
    });
    return store;
}

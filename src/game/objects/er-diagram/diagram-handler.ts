export type ID = string;
import { TableViewModal } from "./table-view-modal";

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
        });

        this.add([this.bg, title, body]);
        scene.add.existing(this);

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

    setSelected(isSelected: boolean) {
        this.bg.setStrokeStyle(3, isSelected ? 0xff9800 : 0x000000, 1);
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
        this.label = scene.add.text(0, 0, rel.label, {
            color: "#444",
            fontSize: "12px",
        });
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
}

export class ERDiagram {
    readonly store: ERStore;
    private scene: Phaser.Scene;
    private nodes = new Map<EntityType, EntityNodeView>();
    private edges: RelationshipEdgeView[] = [];
    private hiddenTables = new Set<EntityType>();
    private selectedType?: EntityType;
    private xOffset: number;
    private yOffset: number;
    private tableViewModal: TableViewModal;
    private selectedRequestMethod?: ApiRequestMethod;
    private currentRequest?: ApiRequestObjective;
    private actionTrace = {
        openedTables: new Set<EntityType>(),
        editCount: 0,
        getSelections: new Map<EntityType, string[]>(),
        confirmations: [] as Array<{
            entityType: EntityType;
            mutation: "none" | "insert" | "update" | "delete";
            rows: Record<string, unknown>[];
        }>,
    };

    constructor(scene: Phaser.Scene, options?: ERDiagramOptions) {
        this.scene = scene;
        this.store = options?.store ?? buildDefaultStore();
        this.xOffset = options?.x ?? 0;
        this.yOffset = options?.y ?? 0;

        for (const tableType of options?.initiallyHiddenTables ?? []) {
            this.hiddenTables.add(tableType);
        }

        this.createViews();
        this.wireInteractions();
        this.tableViewModal = new TableViewModal(scene, {
            onFieldEdited: () => {
                this.actionTrace.editCount += 1;
            },
            onGetSelectionChanged: ({ entityType, selectedTargets }) => {
                this.actionTrace.getSelections.set(entityType, selectedTargets);
            },
            onEditsConfirmed: ({ entityType, mutation, rows }) => {
                this.actionTrace.confirmations.push({ entityType, mutation, rows });
            },
        });
    }

    setSelectedRequestMethod(method: ApiRequestMethod) {
        this.selectedRequestMethod = method;
    }

    getSelectedRequestMethod(): ApiRequestMethod | undefined {
        return this.selectedRequestMethod;
    }

    clearSelectedRequestMethod() {
        this.selectedRequestMethod = undefined;
    }

    startRequest(request: ApiRequestObjective) {
        this.currentRequest = request;
        this.resetActionTrace();
    }

    getCurrentRequest(): ApiRequestObjective | undefined {
        return this.currentRequest;
    }

    submitCurrentRequest(): RequestValidationResult {
        if (!this.currentRequest) {
            return {
                ok: false,
                errorCode: REQUEST_ERROR_CODES.NO_ACTIVE_REQUEST,
                message: "No active request to submit.",
            };
        }
        if (!this.selectedRequestMethod) {
            return {
                ok: false,
                errorCode: REQUEST_ERROR_CODES.METHOD_NOT_SELECTED,
                message: "Select a request type before performing actions.",
            };
        }
        if (this.selectedRequestMethod !== this.currentRequest.method) {
            return {
                ok: false,
                errorCode: REQUEST_ERROR_CODES.METHOD_MISMATCH,
                message: `Selected ${this.selectedRequestMethod} but request requires ${this.currentRequest.method}.`,
            };
        }

        const targetType = this.currentRequest.targetType;
        const openedTarget = this.actionTrace.openedTables.has(targetType);
        let targetConfirmation:
            | {
                  entityType: EntityType;
                  mutation: "none" | "insert" | "update" | "delete";
                  rows: Record<string, unknown>[];
              }
            | undefined;
        for (let index = this.actionTrace.confirmations.length - 1; index >= 0; index -= 1) {
            const entry = this.actionTrace.confirmations[index];
            if (entry.entityType === targetType) {
                targetConfirmation = entry;
                break;
            }
        }

        switch (this.currentRequest.method) {
            case "GET":
                if (!openedTarget) {
                    return {
                        ok: false,
                        errorCode: REQUEST_ERROR_CODES.NO_ACTION_TRACE,
                        message: "Open the target table before submitting GET.",
                    };
                }
                const selectionCount =
                    this.actionTrace.getSelections.get(targetType) ?? [];
                if (selectionCount.length === 0) {
                    return {
                        ok: false,
                        errorCode: REQUEST_ERROR_CODES.NO_ACTION_TRACE,
                        message:
                            "GET request must select at least one row or field in the target table.",
                    };
                }
                if (targetConfirmation && targetConfirmation.mutation !== "none") {
                    return {
                        ok: false,
                        errorCode: REQUEST_ERROR_CODES.WRONG_MUTATION_KIND,
                        message: "GET request must not confirm table mutations.",
                    };
                }
                if (this.currentRequest.targetRowId || this.currentRequest.targetField) {
                    const requiredRow = this.currentRequest.targetRowId;
                    const requiredField = this.currentRequest.targetField;
                    const selectedTargets = this.actionTrace.getSelections.get(targetType) ?? [];
                    if (requiredRow && requiredField) {
                        const requiredToken = `field:${requiredRow}:${requiredField}`;
                        if (!selectedTargets.includes(requiredToken)) {
                            return {
                                ok: false,
                                errorCode: REQUEST_ERROR_CODES.NO_ACTION_TRACE,
                                message: `GET must include field ${requiredField} on row id ${requiredRow}.`,
                            };
                        }
                    } else if (requiredRow) {
                        const rowToken = `row:${requiredRow}`;
                        const hasRowSelection = selectedTargets.some(
                            (token) =>
                                token === rowToken || token.startsWith(`field:${requiredRow}:`),
                        );
                        if (!hasRowSelection) {
                            return {
                                ok: false,
                                errorCode: REQUEST_ERROR_CODES.NO_ACTION_TRACE,
                                message: `GET must include selection for row id ${requiredRow}.`,
                            };
                        }
                    }
                }
                break;
            case "POST":
            case "PUT":
            case "DELETE": {
                if (!targetConfirmation) {
                    return {
                        ok: false,
                        errorCode: REQUEST_ERROR_CODES.WRONG_TARGET_TABLE,
                        message: "Confirm changes on the target table before submitting.",
                    };
                }
                const expectedMutation =
                    this.currentRequest.method === "POST"
                        ? "insert"
                        : this.currentRequest.method === "PUT"
                          ? "update"
                          : "delete";
                if (targetConfirmation.mutation !== expectedMutation) {
                    return {
                        ok: false,
                        errorCode: REQUEST_ERROR_CODES.WRONG_MUTATION_KIND,
                        message: `Expected ${expectedMutation} action on ${targetType}.`,
                    };
                }
                const originalRows = Array.from(
                    this.store.getTableForType(targetType).values(),
                ).map((row) => row as Record<string, unknown>);
                const specificError = this.validateSpecificMutationRequest(
                    this.currentRequest,
                    originalRows,
                    targetConfirmation.rows,
                );
                if (specificError) {
                    return {
                        ok: false,
                        errorCode: REQUEST_ERROR_CODES.NO_ACTION_TRACE,
                        message: specificError,
                    };
                }
                const relationalErrors = this.validateRulesWithStagedRows(
                    targetType,
                    targetConfirmation.rows,
                );
                if (relationalErrors.length > 0) {
                    return {
                        ok: false,
                        errorCode: REQUEST_ERROR_CODES.RELATIONAL_RULE_FAILED,
                        message: relationalErrors[0],
                    };
                }
                break;
            }
        }
        if (
            this.currentRequest.method === "POST" ||
            this.currentRequest.method === "PUT" ||
            this.currentRequest.method === "DELETE"
        ) {
            this.applyRowsToStore(targetType, targetConfirmation?.rows ?? []);
        }

        return {
            ok: true,
            errorCode: "REQ_OK",
            message: `Request ${this.currentRequest.method} on ${targetType} completed.`,
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
        if (this.selectedType === entityType) {
            this.actionTrace.openedTables.add(entityType);
            const tableMap = this.store.getTableForType(entityType);
            const rows = Array.from(tableMap.values()).map(
                (value) => value as Record<string, unknown>,
            );
            this.tableViewModal.show(entityType, rows, {
                allowEditing: Boolean(this.selectedRequestMethod),
                mode: this.selectedRequestMethod,
            });
            return;
        }

        this.selectedType = entityType;
        this.tableViewModal.hide();
        for (const [type, node] of this.nodes.entries()) {
            node.setSelected(type === entityType);
        }
    }

    private redrawEdges() {
        for (const edge of this.edges) {
            edge.redraw();
        }
    }

    private resetActionTrace() {
        this.actionTrace.openedTables.clear();
        this.actionTrace.editCount = 0;
        this.actionTrace.getSelections.clear();
        this.actionTrace.confirmations = [];
    }

    private applyRowsToStore(entityType: EntityType, rows: Record<string, unknown>[]) {
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

    private validateRulesWithStagedRows(
        entityType: EntityType,
        stagedRows: Record<string, unknown>[],
    ): string[] {
        const tableMap = this.store.getTableForType(entityType);
        const originalRows = Array.from(tableMap.values()).map(
            (row) => row as Record<string, unknown>,
        );
        this.applyRowsToStore(entityType, stagedRows);
        const errors = this.store.validateBasicRelationalRules();
        this.applyRowsToStore(entityType, originalRows);
        return errors;
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
            for (const [key, expected] of Object.entries(request.expectedInsertFields)) {
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
                if (beforeRow[request.targetField] === afterRow[request.targetField]) {
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

    private valuesMatchInsertExpectation(actual: unknown, expected: unknown): boolean {
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

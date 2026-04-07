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
        this.tableViewModal = new TableViewModal(scene);
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
        if (this.selectedType === entityType) {
            const tableMap = this.store.getTableForType(entityType);
            const rows = Array.from(tableMap.values()).map(
                (value) => value as Record<string, unknown>,
            );
            this.tableViewModal.show(entityType, rows);
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

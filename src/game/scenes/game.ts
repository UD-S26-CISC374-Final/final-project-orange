import { EventBus } from "../event-bus";
import { Scene } from "phaser";
import { DataLoader } from "../helpers/dataloader";
import {
    ERDiagram,
    buildDefaultStore,
    type ApiRequestMethod,
    type ApiRequestObjective,
    type RequestValidationResult,
    type EntityType,
} from "../objects/er-diagram/diagram-handler";
import { QueueManager, type QueueEntry } from "../helpers/queue-manager";
import { QueuePanel } from "../objects/npc-queue/queue-panel";
import { NPCDialogueModal } from "../objects/npc-queue/npc-dialogue-modal";

export class MainGame extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    private erDiagram?: ERDiagram;
    private queueManager?: QueueManager;
    private queuePanel?: QueuePanel;
    private dialogueModal?: NPCDialogueModal;
    private score = 0;
    private unlockOrder: EntityType[] = [
        "PET",
        "HOUSE",
        "JOB",
        "VEHICLE",
        "EMPLOYMENT",
    ];
    private unlockIndex = 0;
    private readonly requestMethods: ApiRequestMethod[] = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
    ];
    private methodButtons = new Map<
        ApiRequestMethod,
        Phaser.GameObjects.Text
    >();
    private requestText?: Phaser.GameObjects.Text;
    private requestKindText?: Phaser.GameObjects.Text;
    private statusText?: Phaser.GameObjects.Text;

    constructor() {
        super("MainGame");
    }

    create() {
        // load the background grid
        const grid = new DataLoader(this);
        grid.buildGrid(this.scale.width, this.scale.height);
        grid.loadGameComponents(this);

        const store = buildDefaultStore();

        this.erDiagram = new ERDiagram(this, {
            store,
            initiallyHiddenTables: [
                "PET",
                "HOUSE",
                "JOB",
                "VEHICLE",
                "EMPLOYMENT",
            ],
        });

        this.queueManager = new QueueManager(store);
        this.queueManager.init();

        this.dialogueModal = new NPCDialogueModal(this, (entry) => {
            const correct = this.queueManager!.submitAnswer(entry);
            if (correct) this.addScore(entry);
            return correct;
        });

        this.queuePanel = new QueuePanel(
            this,
            this.queueManager,
            (entry) => this.dialogueModal!.show(entry),
        );

        // used for debugging until new tables are unlocked via difficulty increase
        this.add
            .text(24, 18, "Press SPACE to unlock next table", {
                color: "#111",
                fontSize: "18px",
                backgroundColor: "#ffffff",
                padding: { x: 8, y: 6 },
            })
            .setDepth(10);

        this.input.keyboard?.on("keydown-UP", () => {
            if (
                !this.erDiagram ||
                this.unlockIndex >= this.unlockOrder.length
            ) {
                return;
            }
            this.erDiagram.revealTable(this.unlockOrder[this.unlockIndex]);
            this.unlockIndex += 1;
        });

        this.createRequestHud();
        this.advanceToNextRequest();

        EventBus.emit("current-scene-ready", this);
    }

    private addScore(entry: QueueEntry) {
        const points = this.queueManager!.getPointValue(entry);
        this.score += points;
        console.log(`${this.score}`);
        this.queuePanel!.draw();
    }

    update() {}

    changeScene() {
        this.scene.start("GameOver");
    }

    private createRequestHud() {
        this.requestText = this.add
            .text(24, 68, "Request: --", {
                color: "#111",
                fontSize: "18px",
                backgroundColor: "#ffffff",
                padding: { x: 8, y: 6 },
            })
            .setDepth(10);

        this.statusText = this.add
            .text(24, 102, "Status: waiting for action", {
                color: "#111",
                fontSize: "16px",
                backgroundColor: "#ffffff",
                padding: { x: 8, y: 6 },
            })
            .setDepth(10);

        const { width, height } = this.scale;
        const inventoryWidth = Math.floor(width * 0.5);
        const inventoryHeight = 120;
        const hiddenBottomPx = 24;
        const inventoryX = (width - inventoryWidth) / 2 + 100;
        const inventoryY = height - inventoryHeight + hiddenBottomPx;

        this.requestKindText = this.add
            .text(inventoryX + 18, inventoryY + 18, "Cache Method: --", {
                color: "#111",
                fontSize: "16px",
                fontStyle: "bold",
            })
            .setDepth(10);

        let x = inventoryX + 18;
        const y = inventoryY + 52;
        for (const method of this.requestMethods) {
            const button = this.add
                .text(x, y, method, {
                    color: "#ffffff",
                    fontSize: "16px",
                    backgroundColor: "#444444",
                    padding: { x: 8, y: 6 },
                })
                .setDepth(10)
                .setInteractive({ useHandCursor: true });
            button.on("pointerdown", () => this.selectMethod(method));
            this.methodButtons.set(method, button);
            x += 82;
        }

        const submitButton = this.add
            .text(inventoryX + inventoryWidth - 184, inventoryY - 42, "Confirm Request", {
                color: "#ffffff",
                fontSize: "16px",
                fontStyle: "bold",
                backgroundColor: "#0b8f08",
                padding: { x: 10, y: 7 },
            })
            .setDepth(10)
            .setInteractive({ useHandCursor: true });
        submitButton.on("pointerdown", () => this.submitRequest());
    }

    private selectMethod(method: ApiRequestMethod) {
        this.erDiagram?.setSelectedRequestMethod(method);
        for (const [value, button] of this.methodButtons.entries()) {
            button.setBackgroundColor(value === method ? "#1a5fb4" : "#444444");
        }
        this.requestKindText?.setText(`Cache Method: ${method}`);
        this.setStatus(`Selected ${method}.`, "#1a5fb4");
    }

    private submitRequest() {
        if (!this.erDiagram) {
            return;
        }
        const result = this.erDiagram.submitCurrentRequest();
        this.renderSubmitResult(result);
        if (result.ok) {
            this.advanceToNextRequest();
        }
    }

    private renderSubmitResult(result: RequestValidationResult) {
        if (result.ok) {
            this.setStatus(`${result.errorCode}: ${result.message}`, "#0b8f08");
            return;
        }
        this.setStatus(`${result.errorCode}: ${result.message}`, "#b00020");
    }

    private advanceToNextRequest() {
        if (!this.erDiagram) {
            return;
        }
        this.erDiagram.clearSelectedRequestMethod();
        this.requestKindText?.setText("Cache Method: --");
        for (const button of this.methodButtons.values()) {
            button.setBackgroundColor("#444444");
        }
        const method =
            this.requestMethods[
                Math.floor(Math.random() * this.requestMethods.length)
            ];
        const request = this.buildComplexRequest(method, 0);
        this.erDiagram.startRequest(request);
        if (this.requestText) {
            this.requestText.setText(`Request: ${request.description}`);
        }
        this.setStatus(
            "Choose request type, perform action, then submit.",
            "#111",
        );
    }

    /**
     * Every objective is specific (row id, field, and/or exact insert values) — no generic `METHOD TABLE` prompts.
     */
    private buildComplexRequest(
        method: ApiRequestMethod,
        depth: number,
    ): ApiRequestObjective {
        if (depth > 24) {
            return this.buildPostObjective("USER");
        }
        if (method === "POST") {
            const targetType = this.pickVisibleTable();
            return this.buildPostObjective(targetType);
        }
        const targetType =
            method === "PUT"
                ? this.pickVisibleTableWithPutEligibleRow()
                : this.pickVisibleTableWithRows();
        const tableMap = this.erDiagram?.store.getTableForType(targetType);
        const rows = Array.from(tableMap?.values() ?? []).map(
            (row) => row as Record<string, unknown>,
        );
        const rowIds = rows
            .map((row) => String(row.id ?? ""))
            .filter((id) => id.length > 0);
        if (rowIds.length === 0) {
            return this.buildComplexRequest(method, depth + 1);
        }
        const targetRowId = rowIds[Math.floor(Math.random() * rowIds.length)];
        const targetRow = rows.find(
            (row) => String(row.id ?? "") === targetRowId,
        ) as Record<string, unknown> | undefined;
        const nonPkFields = Object.keys(targetRow ?? {}).filter(
            (key) => key.toLowerCase() !== "id",
        );
        const editableForPut = nonPkFields.filter(
            (key) => !key.toLowerCase().endsWith("id"),
        );
        const targetFieldGet =
            nonPkFields.length > 0
                ? nonPkFields[
                      Math.floor(Math.random() * nonPkFields.length)
                  ]
                : undefined;
        const targetFieldDelete =
            editableForPut.length > 0
                ? editableForPut[
                      Math.floor(Math.random() * editableForPut.length)
                  ]
                : undefined;
        const targetFieldPut =
            editableForPut.length > 0
                ? editableForPut[
                      Math.floor(Math.random() * editableForPut.length)
                  ]
                : undefined;

        if (method === "PUT") {
            if (!targetFieldPut) {
                return this.buildComplexRequest(method, depth + 1);
            }
            return {
                method,
                targetType,
                targetRowId,
                targetField: targetFieldPut,
                description: `PUT ${targetType}: change row id ${targetRowId}, column "${targetFieldPut}" to a new value`,
            };
        }
        if (method === "GET") {
            if (targetFieldGet) {
                const variants = [
                    `GET ${targetType}: fetch row id ${targetRowId}, field "${targetFieldGet}"`,
                    `GET ${targetType}: return ${targetFieldGet} where id = ${targetRowId}`,
                ];
                return {
                    method,
                    targetType,
                    targetRowId,
                    targetField: targetFieldGet,
                    description:
                        variants[Math.floor(Math.random() * variants.length)],
                };
            }
            return {
                method,
                targetType,
                targetRowId,
                description: `GET ${targetType}: read entire row with id ${targetRowId} (select row or any field)`,
            };
        }
        if (method === "DELETE") {
            if (targetFieldDelete && Math.random() < 0.55) {
                return {
                    method,
                    targetType,
                    targetRowId,
                    targetField: targetFieldDelete,
                    description: `DELETE ${targetType}: clear (null) row id ${targetRowId}, field "${targetFieldDelete}" only`,
                };
            }
            return {
                method,
                targetType,
                targetRowId,
                description: `DELETE ${targetType}: soft-delete row id ${targetRowId} (null all non-id columns)`,
            };
        }
        return this.buildPostObjective(this.pickVisibleTable());
    }

    private buildPostObjective(targetType: EntityType): ApiRequestObjective {
        if (targetType === "USER") {
            const expectedInsertFields = this.pickRandomUserInsertFields();
            const { name, age, feeling, money } = expectedInsertFields;
            return {
                method: "POST",
                targetType,
                expectedInsertFields: {
                    name,
                    age,
                    feeling,
                    money,
                },
                description: `POST USER: insert row with name "${name}", age ${age}, feeling "${feeling}", money ${money}`,
            };
        }
        if (targetType === "PET") {
            const ownerId = Math.random() < 0.5 ? "u1" : "u2";
            const species = ["dog", "cat", "bird", "rabbit"][
                Math.floor(Math.random() * 4)
            ];
            const names = ["Milo", "Luna", "Zoe", "Finn", "Nova"];
            const name = names[Math.floor(Math.random() * names.length)];
            const age = 1 + Math.floor(Math.random() * 15);
            return {
                method: "POST",
                targetType,
                expectedInsertFields: { species, name, age, ownerId },
                description: `POST PET: add species "${species}", name "${name}", age ${age}, ownerId ${ownerId}`,
            };
        }
        if (targetType === "JOB") {
            const titles = ["Analyst", "Designer", "Teacher", "Nurse", "Pilot"];
            const locs = ["NYC", "Toronto", "Austin", "Remote", "London"];
            const title = titles[Math.floor(Math.random() * titles.length)];
            const yearlySalary = 45000 + Math.floor(Math.random() * 80000);
            const location = locs[Math.floor(Math.random() * locs.length)];
            return {
                method: "POST",
                targetType,
                expectedInsertFields: { title, yearlySalary, location },
                description: `POST JOB: insert title "${title}", yearlySalary ${yearlySalary}, location "${location}"`,
            };
        }
        if (targetType === "EMPLOYMENT") {
            const userId = Math.random() < 0.5 ? "u1" : "u2";
            const jobId = "j1";
            return {
                method: "POST",
                targetType,
                expectedInsertFields: { userId, jobId },
                description: `POST EMPLOYMENT: link userId ${userId} to jobId ${jobId}`,
            };
        }
        if (targetType === "HOUSE") {
            // Default world has HOUSE h1 for u1; use u2 to satisfy one-to-one when adding another house.
            const ownerId = "u2";
            const colors = ["green", "tan", "white", "brick"];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const listingPrice = 150000 + Math.floor(Math.random() * 400000);
            return {
                method: "POST",
                targetType,
                expectedInsertFields: { ownerId, color, listingPrice },
                description: `POST HOUSE: add ownerId ${ownerId}, color "${color}", listingPrice ${listingPrice}`,
            };
        }
        if (targetType === "VEHICLE") {
            const houseId = "h1";
            const colors = ["silver", "black", "white", "blue"];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const year = 2018 + Math.floor(Math.random() * 7);
            const models = ["suv", "coupe", "truck", "hatchback"];
            const model = models[Math.floor(Math.random() * models.length)];
            const price = 8000 + Math.floor(Math.random() * 42000);
            return {
                method: "POST",
                targetType,
                expectedInsertFields: {
                    houseId,
                    color,
                    year,
                    model,
                    price,
                },
                description: `POST VEHICLE: houseId ${houseId}, color "${color}", year ${year}, model "${model}", price ${price}`,
            };
        }
        return this.buildPostObjective("USER");
    }

    /** Pick a visible table that has at least one row (for GET/PUT/DELETE). */
    private pickVisibleTableWithRows(): EntityType {
        const available = this.listVisibleTableTypes();
        const withRows = available.filter((type) => {
            const map = this.erDiagram?.store.getTableForType(type);
            return map && map.size > 0;
        });
        if (withRows.length === 0) {
            return "USER";
        }
        return withRows[Math.floor(Math.random() * withRows.length)];
    }

    /**
     * PUT can only change columns the modal treats as editable (not *id except primary id).
     * Skip tables like EMPLOYMENT where every non-PK column is a foreign key id.
     */
    private pickVisibleTableWithPutEligibleRow(): EntityType {
        const available = this.listVisibleTableTypes();
        const eligible = available.filter((type) =>
            this.tableHasPutEligibleColumn(type),
        );
        if (eligible.length === 0) {
            return "USER";
        }
        return eligible[Math.floor(Math.random() * eligible.length)];
    }

    private tableHasPutEligibleColumn(type: EntityType): boolean {
        const map = this.erDiagram?.store.getTableForType(type);
        if (!map || map.size === 0) {
            return false;
        }
        for (const row of map.values()) {
            const record = row as Record<string, unknown>;
            const hasEditable = Object.keys(record).some((key) => {
                if (key.toLowerCase() === "id") {
                    return false;
                }
                return !key.toLowerCase().endsWith("id");
            });
            if (hasEditable) {
                return true;
            }
        }
        return false;
    }

    private listVisibleTableTypes(): EntityType[] {
        const available: EntityType[] = ["USER"];
        for (let index = 0; index < this.unlockIndex; index += 1) {
            available.push(this.unlockOrder[index]);
        }
        return available;
    }

    private pickRandomUserInsertFields(): {
        name: string;
        age: number;
        feeling: string;
        money: number;
    } {
        const names = [
            "Sam",
            "Jordan",
            "Riley",
            "Casey",
            "Morgan",
            "Quinn",
            "Avery",
            "Skyler",
        ];
        const feelings = [
            "curious",
            "calm",
            "excited",
            "tired",
            "hopeful",
            "grateful",
            "focused",
        ];
        const name = names[Math.floor(Math.random() * names.length)];
        const feeling = feelings[Math.floor(Math.random() * feelings.length)];
        const age = 18 + Math.floor(Math.random() * 48);
        const money = 100 + Math.floor(Math.random() * 9900);
        return { name, age, feeling, money };
    }

    private pickVisibleTable(): EntityType {
        const available: EntityType[] = ["USER"];
        for (let index = 0; index < this.unlockIndex; index += 1) {
            available.push(this.unlockOrder[index]);
        }
        return available[Math.floor(Math.random() * available.length)];
    }

    private setStatus(text: string, color: string) {
        if (!this.statusText) {
            return;
        }
        this.statusText.setText(`Status: ${text}`);
        this.statusText.setColor(color);
    }
}

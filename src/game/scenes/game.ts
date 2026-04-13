import { EventBus } from "../event-bus";
import { Scene } from "phaser";
import { DataLoader } from "../helpers/dataloader";
import {
    ERDiagram,
    buildDefaultStore,
    type ApiRequestMethod,
    type EntityType,
} from "../objects/er-diagram/diagram-handler";
import { METHOD_UI_COLORS } from "../helpers/method-ui-colors";
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
    private requestKindText?: Phaser.GameObjects.Text;
    /** Queue entry whose objective is active (for bottom-bar Confirm without using the modal). */
    private activeNpcEntry?: QueueEntry;

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

        this.dialogueModal = new NPCDialogueModal(this);

        this.queuePanel = new QueuePanel(
            this,
            this.queueManager,
            (entry) => {
                this.activeNpcEntry = entry;
                this.erDiagram!.startRequest(entry.question.objective);
                this.dialogueModal!.show(entry);
            },
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
            const colors = METHOD_UI_COLORS[method];
            const button = this.add
                .text(x, y, method, {
                    color: colors.text,
                    fontSize: "16px",
                    backgroundColor: colors.background,
                    padding: { x: 8, y: 6 },
                })
                .setDepth(10)
                .setInteractive({ useHandCursor: true });
            button.on("pointerdown", () => this.selectMethod(method));
            this.methodButtons.set(method, button);
            this.styleMethodButton(method, false);
            x += 90;
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

    private styleMethodButton(method: ApiRequestMethod, selected: boolean) {
        const button = this.methodButtons.get(method);
        if (!button) {
            return;
        }
        const colors = METHOD_UI_COLORS[method];
        button.setStyle({
            fontSize: selected ? "18px" : "16px",
            fontStyle: selected ? "bold" : "normal",
            color: colors.text,
            backgroundColor: selected
                ? colors.selectedBackground
                : colors.background,
            padding: selected ? { x: 12, y: 8 } : { x: 8, y: 6 },
            stroke: selected ? "#ffffff" : "#000000",
            strokeThickness: selected ? 6 : 0,
        });
        button.setDepth(selected ? 12 : 10);
    }

    private selectMethod(method: ApiRequestMethod) {
        this.erDiagram?.setSelectedRequestMethod(method);
        for (const m of this.requestMethods) {
            this.styleMethodButton(m, m === method);
        }
        this.requestKindText?.setText(`Cache Method: ${method}`);
    }

    private submitRequest() {
        if (!this.erDiagram || !this.activeNpcEntry) {
            return;
        }
        const result = this.erDiagram.submitCurrentRequest();
        if (!result.ok) {
            return;
        }
        const entry = this.activeNpcEntry;
        this.activeNpcEntry = undefined;

        this.queuePanel!.flashNpcSuccess(entry.npc.id, () => {
            this.queueManager!.completeNpcEntry(entry);
            this.addScore(entry);
            this.resetAfterNpcRequest();
            this.dialogueModal?.hide();
        });
    }

    private resetAfterNpcRequest() {
        if (!this.erDiagram) {
            return;
        }
        this.erDiagram.clearCurrentRequest();
        this.erDiagram.clearSelectedRequestMethod();
        this.requestKindText?.setText("Cache Method: --");
        for (const m of this.requestMethods) {
            this.styleMethodButton(m, false);
        }
    }
}

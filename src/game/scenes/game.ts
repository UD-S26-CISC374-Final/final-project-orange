import { EventBus } from "../event-bus";
import { Scene } from "phaser";
import { DataLoader } from "../helpers/dataloader";
import {
    ERDiagram,
    buildDefaultStore,
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

        this.add
            .text(24, 18, "Press SPACE to unlock next table", {
                color: "#111",
                fontSize: "18px",
                backgroundColor: "#ffffff",
                padding: { x: 8, y: 6 },
            })
            .setDepth(10);

        this.input.keyboard?.on("keydown-SPACE", () => {
            if (
                !this.erDiagram ||
                this.unlockIndex >= this.unlockOrder.length
            ) {
                return;
            }
            this.erDiagram.revealTable(this.unlockOrder[this.unlockIndex]);
            this.unlockIndex += 1;
        });

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
}

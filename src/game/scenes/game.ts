import { EventBus } from "../event-bus";
import { Scene } from "phaser";
import { DataLoader } from "../helpers/dataloader";
import {
    ERDiagram,
    type EntityType,
} from "../objects/er-diagram/diagram-handler";

export class MainGame extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    private erDiagram?: ERDiagram;
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

        this.erDiagram = new ERDiagram(this, {
            initiallyHiddenTables: [
                "PET",
                "HOUSE",
                "JOB",
                "VEHICLE",
                "EMPLOYMENT",
            ],
        });

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

    update() {}

    changeScene() {
        this.scene.start("GameOver");
    }
}

import { EventBus } from "../event-bus";
import { Scene } from "phaser";
import { DataLoader } from "../helpers/dataloader";
import {
    ERDiagram,
    type ApiRequestMethod,
    type ApiRequestObjective,
    type RequestValidationResult,
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
    private readonly requestMethods: ApiRequestMethod[] = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
    ];
    private methodButtons = new Map<ApiRequestMethod, Phaser.GameObjects.Text>();
    private requestText?: Phaser.GameObjects.Text;
    private statusText?: Phaser.GameObjects.Text;

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

        // used for debugging until new tables are unlocked via difficulty increase
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

        this.createRequestHud();
        this.advanceToNextRequest();

        EventBus.emit("current-scene-ready", this);
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

        let x = 24;
        const y = 138;
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
            .text(24, 174, "Submit Request", {
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
        for (const button of this.methodButtons.values()) {
            button.setBackgroundColor("#444444");
        }
        const method =
            this.requestMethods[
                Math.floor(Math.random() * this.requestMethods.length)
            ];
        const targetType = this.pickVisibleTable();
        const request: ApiRequestObjective = {
            method,
            targetType,
            description: `${method} ${targetType}`,
        };
        this.erDiagram.startRequest(request);
        if (this.requestText) {
            this.requestText.setText(`Request: ${request.description}`);
        }
        this.setStatus("Choose request type, perform action, then submit.", "#111");
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

import { EventBus } from "../event-bus";
import { Scene } from "phaser";
import { DataLoader } from "../helpers/dataloader";
import {
    ERDiagram,
    buildDefaultStore,
    type ApiRequestMethod,
    type ConfirmPendingRequestCandidate,
    type EntityType,
} from "../objects/er-diagram/diagram-handler";
import { METHOD_UI_COLORS } from "../helpers/method-ui-colors";
import { QueueManager, type QueueEntry } from "../helpers/queue-manager";
import { QueuePanel } from "../objects/npc-queue/queue-panel";
import { NPCDialogueModal } from "../objects/npc-queue/npc-dialogue-modal";
import { PendingRequestsPanel } from "../objects/pending-requests-panel";

export class MainGame extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    private erDiagram?: ERDiagram;
    private queueManager?: QueueManager;
    private queuePanel?: QueuePanel;
    private dialogueModal?: NPCDialogueModal;
    private pendingRequestsPanel?: PendingRequestsPanel;
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
        {
            container: Phaser.GameObjects.Container;
            box: Phaser.GameObjects.Rectangle;
            label: Phaser.GameObjects.Text;
        }
    >();
    private requestKindText?: Phaser.GameObjects.Text;
    private submitButton?: Phaser.GameObjects.Text;
    private methodHotkeyHandler?: (event: KeyboardEvent) => void;
    private failureFlashOverlay?: Phaser.GameObjects.Rectangle;

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
            onPendingChange: () => {
                this.pendingRequestsPanel?.refresh();
                this.updateConfirmButtonState();
            },
        });

        this.pendingRequestsPanel = new PendingRequestsPanel(
            this,
            this.scale.width - 272,
            72,
            this.erDiagram,
        );

        this.queueManager = new QueueManager(store);
        this.queueManager.init();

        this.dialogueModal = new NPCDialogueModal(this);

        this.queuePanel = new QueuePanel(this, this.queueManager, (entry) => {
            this.dialogueModal!.show(entry);
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
        this.createFailureFlashOverlay();

        EventBus.emit("current-scene-ready", this);
    }

    private addScore(entry: QueueEntry) {
        const points = this.queueManager!.getPointValue(entry);
        this.score += points;
        console.log(`${this.score}`);
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

        const infoButton = this.add
            .text(inventoryX + inventoryWidth - 48, inventoryY + 10, "ⓘ", {
                color: "#111",
                fontSize: "22px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
                padding: { x: 8, y: 5 },
            })
            .setDepth(11)
            .setInteractive({ useHandCursor: true });
        infoButton.setStroke("#333333", 2);

        const infoBox = this.add
            .text(
                inventoryX + 20,
                inventoryY - 22,
                "Pro Tip: Use number keys to select request types",
                {
                    color: "#111",
                    fontSize: "15px",
                    backgroundColor: "#fff7cc",
                    padding: { x: 10, y: 8 },
                },
            )
            .setDepth(11)
            .setVisible(false);
        infoBox.setStroke("#8a6d3b", 2);
        infoButton.on("pointerdown", () => {
            infoBox.setVisible(true);
            this.time.delayedCall(2200, () => infoBox.setVisible(false));
        });

        let x = inventoryX + 18;
        const y = inventoryY + 52;
        for (let index = 0; index < this.requestMethods.length; index += 1) {
            const method = this.requestMethods[index];
            const colors = METHOD_UI_COLORS[method];
            const buttonWidth = 86;
            const buttonHeight = 34;
            const buttonBox = this.add.rectangle(
                buttonWidth / 2,
                buttonHeight / 2,
                buttonWidth,
                buttonHeight,
                this.toColorNumber(colors.background),
                1,
            );
            const buttonLabel = this.add.text(
                buttonWidth / 2,
                buttonHeight / 2,
                `${index + 1}. ${method}`,
                {
                    color: colors.text,
                    fontSize: "15px",
                    fontStyle: "bold",
                },
            );
            buttonLabel.setOrigin(0.5);
            const buttonContainer = this.add
                .container(x, y, [buttonBox, buttonLabel])
                .setDepth(10)
                .setSize(buttonWidth, buttonHeight);
            const hitArea = this.add
                .rectangle(
                    buttonWidth / 2,
                    buttonHeight / 2,
                    buttonWidth,
                    buttonHeight,
                    0x000000,
                    0,
                )
                .setInteractive({ useHandCursor: true });
            hitArea.on("pointerup", () => this.selectMethod(method));
            buttonContainer.add(hitArea);
            this.methodButtons.set(method, {
                container: buttonContainer,
                box: buttonBox,
                label: buttonLabel,
            });
            this.styleMethodButton(method, false);
            x += 96;
        }
        this.bindMethodHotkeys();

        this.submitButton = this.add
            .text(
                inventoryX + inventoryWidth - 184,
                inventoryY - 42,
                "Confirm Request(s)",
                {
                    color: "#ffffff",
                    fontSize: "16px",
                    fontStyle: "bold",
                    backgroundColor: "#0b8f08",
                    padding: { x: 10, y: 7 },
                },
            )
            .setDepth(10)
            .setInteractive({ useHandCursor: true });
        this.submitButton.on("pointerdown", () => this.submitRequest());
        this.updateConfirmButtonState();
    }

    private styleMethodButton(method: ApiRequestMethod, selected: boolean) {
        const button = this.methodButtons.get(method);
        if (!button) {
            return;
        }
        const colors = METHOD_UI_COLORS[method];
        button.box.setFillStyle(
            this.toColorNumber(
                selected ? colors.selectedBackground : colors.background,
            ),
            1,
        );
        if (selected) {
            button.box.setStrokeStyle(4, 0x000000, 1);
        } else {
            button.box.setStrokeStyle();
        }
        button.label.setStyle({
            fontSize: selected ? "16px" : "15px",
            fontStyle: "bold",
            color: colors.text,
        });
        button.container.setDepth(selected ? 12 : 10);
    }

    private selectMethod(method: ApiRequestMethod) {
        this.erDiagram?.setSelectedRequestMethod(method);
        for (const m of this.requestMethods) {
            this.styleMethodButton(m, m === method);
        }
        this.requestKindText?.setText(`Cache Method: ${method}`);
    }

    private submitRequest() {
        if (!this.erDiagram) {
            return;
        }
        if (!this.erDiagram.hasPendingChanges()) {
            this.flashFailureOverlay();
            return;
        }
        const queueSnapshot = [...this.queueManager!.getQueue()];
        const candidates: ConfirmPendingRequestCandidate[] = queueSnapshot.map(
            (entry) => ({
                npcId: entry.npc.id,
                objective: entry.question.objective,
            }),
        );
        const result = this.erDiagram.confirmPendingRequests(candidates);

        if (result.unmatched.length > 0) {
            this.flashFailureOverlay();
            for (const unmatched of result.unmatched) {
                console.warn(
                    `Pending request "${unmatched.summary}" did not match any active NPC request: ${unmatched.reason}`,
                );
            }
        }

        if (result.matched.length === 0) {
            return;
        }

        const matchedNpcIds = Array.from(
            new Set(result.matched.map((match) => match.npcId)),
        );
        const queueByNpcId = new Map(
            queueSnapshot.map((entry) => [entry.npc.id, entry] as const),
        );
        let remainingAnimations = matchedNpcIds.length;
        const onSuccessComplete = () => {
            remainingAnimations -= 1;
            if (remainingAnimations <= 0) {
                this.queuePanel!.draw();
            }
        };

        for (const npcId of matchedNpcIds) {
            const entry = queueByNpcId.get(npcId);
            if (!entry) {
                onSuccessComplete();
                continue;
            }
            this.queuePanel!.flashNpcSuccess(npcId, () => {
                this.queueManager!.completeNpcEntry(entry);
                this.addScore(entry);
                onSuccessComplete();
            });
        }
    }

    private updateConfirmButtonState() {
        if (!this.submitButton) {
            return;
        }
        const canConfirm = Boolean(this.erDiagram?.hasPendingChanges());
        this.submitButton.setStyle({
            backgroundColor: canConfirm ? "#0b8f08" : "#8a8a8a",
            color: canConfirm ? "#ffffff" : "#e4e4e4",
        });
        this.submitButton.setAlpha(canConfirm ? 1 : 0.75);
        if (canConfirm) {
            this.submitButton.setInteractive({ useHandCursor: true });
        } else {
            this.submitButton.disableInteractive();
        }
    }

    private createFailureFlashOverlay() {
        this.failureFlashOverlay = this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0xff0000,
                0.45,
            )
            .setDepth(2000)
            .setVisible(false)
            .setScrollFactor(0);
    }

    private flashFailureOverlay() {
        if (!this.failureFlashOverlay) {
            return;
        }
        this.failureFlashOverlay.setAlpha(0.45).setVisible(true);
        this.tweens.killTweensOf(this.failureFlashOverlay);
        this.tweens.add({
            targets: this.failureFlashOverlay,
            alpha: 0,
            duration: 220,
            ease: "Quad.easeOut",
            onComplete: () => {
                this.failureFlashOverlay?.setVisible(false);
            },
        });
    }

    private bindMethodHotkeys() {
        if (!this.input.keyboard || this.methodHotkeyHandler) {
            return;
        }
        this.methodHotkeyHandler = (event: KeyboardEvent) => {
            if (event.repeat) {
                return;
            }
            const method = this.methodForDigit(event.key, event.code);
            if (method) {
                this.selectMethod(method);
            }
        };
        this.input.keyboard.on("keydown", this.methodHotkeyHandler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (!this.input.keyboard || !this.methodHotkeyHandler) {
                return;
            }
            this.input.keyboard.off("keydown", this.methodHotkeyHandler);
            this.methodHotkeyHandler = undefined;
        });
    }

    private methodForDigit(
        key: string,
        code?: string,
    ): ApiRequestMethod | undefined {
        if (code === "Numpad1") {
            return "GET";
        }
        if (code === "Numpad2") {
            return "POST";
        }
        if (code === "Numpad3") {
            return "PUT";
        }
        if (code === "Numpad4") {
            return "DELETE";
        }
        switch (key) {
            case "1":
                return "GET";
            case "2":
                return "POST";
            case "3":
                return "PUT";
            case "4":
                return "DELETE";
            default:
                return undefined;
        }
    }

    private toColorNumber(hexColor: string): number {
        return Phaser.Display.Color.HexStringToColor(hexColor).color;
    }
}

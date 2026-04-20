import { EventBus } from "../event-bus";
import { Scene } from "phaser";
import { DataLoader } from "../helpers/dataloader";
import {
    ERDiagram,
    buildDefaultStore,
    type ApiRequestMethod,
    type ConfirmPendingRequestCandidate,
} from "../objects/er-diagram/diagram-handler";
import { METHOD_UI_COLORS } from "../helpers/method-ui-colors";
import { QueueManager, type QueueEntry } from "../helpers/queue-manager";
import { QueuePanel } from "../objects/npc-queue/queue-panel";
import { NPCDialogueModal } from "../objects/npc-queue/npc-dialogue-modal";
import { PendingRequestsPanel } from "../objects/pending-requests-panel";

const TIMEOUT_DRAIN_SECONDS = 90;
const TIMEOUT_REWARD_PER_CORRECT = 0.06;
const TIMEOUT_PENALTY_PER_INCORRECT = 0.08;
const TIMEOUT_BAR_HEIGHT = 210;
const TIMEOUT_BAR_WIDTH = 20;
const TIMEOUT_BAR_X = 22;
const TIMEOUT_BAR_Y = 54;

export class MainGame extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    private erDiagram?: ERDiagram;
    private queueManager?: QueueManager;
    private queuePanel?: QueuePanel;
    private dialogueModal?: NPCDialogueModal;
    private pendingRequestsPanel?: PendingRequestsPanel;
    private score = 0;
    private completedRequestCount = 0;
    private timeoutNormalized = 1;
    private timeoutTrack?: Phaser.GameObjects.Rectangle;
    private timeoutFill?: Phaser.GameObjects.Rectangle;
    private timeoutPreviewOutline?: Phaser.GameObjects.Rectangle;
    private gameOverTriggered = false;
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

        this.createTimeoutHud();
        this.createRequestHud();
        this.createFailureFlashOverlay();

        EventBus.emit("current-scene-ready", this);
    }

    private addScore(entry: QueueEntry) {
        const points = this.queueManager!.getPointValue(entry);
        this.score += points;
        console.log(`${this.score}`);
    }

    update(_time: number, delta: number) {
        if (this.gameOverTriggered) {
            return;
        }
        const elapsedSeconds = delta / 1000;
        const drainedValue = elapsedSeconds / TIMEOUT_DRAIN_SECONDS;
        this.setTimeoutNormalized(this.timeoutNormalized - drainedValue);
    }

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
        if (this.gameOverTriggered || !this.erDiagram) {
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
            this.flashFailureOverlaySeries(result.unmatched.length);
            for (const unmatched of result.unmatched) {
                console.warn(
                    `Pending request "${unmatched.summary}" did not match any active NPC request: ${unmatched.reason}`,
                );
            }
        }

        if (result.matched.length === 0) {
            return;
        }

        this.completedRequestCount += result.matched.length;
        this.applyTimeoutRewardSeries(result.matched.length);

        const matchedNpcIds = Array.from(
            new Set(result.matched.map((match) => match.npcId)),
        );
        const queueByNpcId = new Map(
            queueSnapshot.map((entry) => [entry.npc.id, entry] as const),
        );
        let remainingAnimations = matchedNpcIds.length;
        const onSuccessComplete = () => {
            if (this.gameOverTriggered) {
                return;
            }
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
            this.queuePanel!.flashNpcSuccess(
                npcId,
                this.successStatusCodeForMethod(entry.question.objective.method),
                () => {
                    if (this.gameOverTriggered) {
                        onSuccessComplete();
                        return;
                    }
                    this.queueManager!.completeNpcEntry(entry);
                    this.addScore(entry);
                    onSuccessComplete();
                },
            );
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

    private createTimeoutHud() {
        this.add
            .text(TIMEOUT_BAR_X, 24, "Timeout", {
                color: "#111",
                fontSize: "15px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
                padding: { x: 6, y: 4 },
            })
            .setDepth(31);

        this.timeoutTrack = this.add
            .rectangle(
                TIMEOUT_BAR_X,
                TIMEOUT_BAR_Y,
                TIMEOUT_BAR_WIDTH,
                TIMEOUT_BAR_HEIGHT,
                0x0f172a,
                0.2,
            )
            .setOrigin(0, 0)
            .setDepth(30);
        this.timeoutTrack.setStrokeStyle(2, 0x0f172a, 0.9);

        this.timeoutFill = this.add
            .rectangle(
                TIMEOUT_BAR_X,
                TIMEOUT_BAR_Y,
                TIMEOUT_BAR_WIDTH,
                TIMEOUT_BAR_HEIGHT,
                0x3bbf6b,
                1,
            )
            .setOrigin(0, 0)
            .setDepth(31);

        this.timeoutPreviewOutline = this.add
            .rectangle(
                TIMEOUT_BAR_X - 2,
                TIMEOUT_BAR_Y,
                TIMEOUT_BAR_WIDTH + 4,
                TIMEOUT_BAR_HEIGHT,
                0xffffff,
                0,
            )
            .setOrigin(0, 0)
            .setDepth(32)
            .setVisible(false);
        this.timeoutPreviewOutline.setStrokeStyle(2, 0x2f6fff, 1);

        this.syncTimeoutBarFill(this.timeoutNormalized);
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

    private flashFailureOverlaySeries(count: number) {
        for (let index = 0; index < count; index += 1) {
            this.time.delayedCall(index * 260, () => {
                if (this.gameOverTriggered) {
                    return;
                }
                this.flashFailureOverlay();
                this.applyTimeoutBurst(-TIMEOUT_PENALTY_PER_INCORRECT);
            });
        }
    }

    private applyTimeoutRewardSeries(count: number) {
        for (let index = 0; index < count; index += 1) {
            this.time.delayedCall(index * 110, () => {
                if (this.gameOverTriggered) {
                    return;
                }
                this.applyTimeoutBurst(TIMEOUT_REWARD_PER_CORRECT);
            });
        }
    }

    private setTimeoutNormalized(nextValue: number) {
        if (this.gameOverTriggered) {
            return;
        }
        const clamped = Phaser.Math.Clamp(nextValue, 0, 1);
        if (clamped === this.timeoutNormalized) {
            return;
        }
        this.timeoutNormalized = clamped;
        this.syncTimeoutBarFill(clamped);
        this.checkForTimeoutGameOver();
    }

    private applyTimeoutBurst(delta: number) {
        if (this.gameOverTriggered) {
            return;
        }
        const previous = this.timeoutNormalized;
        const next = Phaser.Math.Clamp(previous + delta, 0, 1);
        if (next === previous) {
            return;
        }
        this.timeoutNormalized = next;
        this.syncTimeoutBarFill(next);
        this.playTimeoutPreview(previous, next);
        this.checkForTimeoutGameOver();
    }

    private checkForTimeoutGameOver() {
        if (this.gameOverTriggered || this.timeoutNormalized > 0) {
            return;
        }
        this.gameOverTriggered = true;
        this.scene.start("GameOver");
    }

    private syncTimeoutBarFill(value: number) {
        if (!this.timeoutFill) {
            return;
        }
        const geometry = this.timeoutGeometryFor(value);
        if (geometry.height <= 0) {
            this.timeoutFill.setVisible(false);
            return;
        }
        this.timeoutFill.setVisible(true);
        this.timeoutFill.setY(geometry.y);
        this.timeoutFill.setDisplaySize(TIMEOUT_BAR_WIDTH, geometry.height);
    }

    private playTimeoutPreview(fromValue: number, toValue: number) {
        if (!this.timeoutPreviewOutline) {
            return;
        }
        const fromGeometry = this.timeoutGeometryFor(fromValue);
        const toGeometry = this.timeoutGeometryFor(toValue);
        const preview = this.timeoutPreviewOutline;
        this.tweens.killTweensOf(preview);
        preview
            .setVisible(true)
            .setAlpha(0.95)
            .setY(fromGeometry.y)
            .setDisplaySize(TIMEOUT_BAR_WIDTH + 4, Math.max(2, fromGeometry.height));
        this.tweens.add({
            targets: preview,
            y: toGeometry.y,
            displayHeight: Math.max(2, toGeometry.height),
            alpha: 0,
            duration: 190,
            ease: "Quad.easeOut",
            onComplete: () => {
                preview.setVisible(false);
            },
        });
    }

    private timeoutGeometryFor(value: number): { y: number; height: number } {
        const clamped = Phaser.Math.Clamp(value, 0, 1);
        const fillHeight = TIMEOUT_BAR_HEIGHT * clamped;
        return {
            y: TIMEOUT_BAR_Y + (TIMEOUT_BAR_HEIGHT - fillHeight),
            height: fillHeight,
        };
    }

    private successStatusCodeForMethod(method: ApiRequestMethod): string {
        if (method === "POST") {
            return "201";
        }
        if (method === "DELETE") {
            return "204";
        }
        return "200";
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

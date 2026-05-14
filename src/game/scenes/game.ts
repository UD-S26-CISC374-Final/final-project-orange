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
import {
    DevLevelShortcut,
    isDevLevelIndex,
} from "../helpers/dev-level-shortcut";
import {
    ensureGameplayMusic,
    hasUnlockedGameplayMusic,
    playRequestFailureSound,
    playRequestSuccessSound,
    unlockGameplayMusic,
} from "../helpers/audio";
import {
    ENDLESS_MODE_DEFINITION,
    LEVEL_DEFINITIONS,
    type LevelDefinition,
} from "../constants/level_requests";

const TIMEOUT_DRAIN_SECONDS = 120;
const REQUEST_TIMEOUT_DRAIN_SECONDS: Record<ApiRequestMethod, number> = {
    GET: 120,
    DELETE: 120,
    PUT: 150,
    POST: 180,
};
const TIMEOUT_REWARD_PER_CORRECT = 0.06;
const TIMEOUT_PENALTY_PER_INCORRECT = 0.08;
const TIMEOUT_BOSS_REWARD = 100;
const TIMEOUT_BAR_HEIGHT = 210;
const TIMEOUT_BAR_WIDTH = 20;
const TIMEOUT_BAR_X = 22;
const TIMEOUT_BAR_Y = 54;
const BOSS_SCORE_THRESHOLD = 30;
const MAX_CONTINUES = 3;
const ALL_TABLES: EntityType[] = [
    "USER",
    "PET",
    "HOUSE",
    "JOB",
    "EMPLOYMENT",
    "VEHICLE",
];

type MainGameStartData = {
    startInEndlessMode?: boolean;
    startLevelIndex?: number;
};

export class MainGame extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    private erDiagram?: ERDiagram;
    private queueManager?: QueueManager;
    private queuePanel?: QueuePanel;
    private dialogueModal?: NPCDialogueModal;
    private pendingRequestsPanel?: PendingRequestsPanel;
    private score = 0;
    private lastBossSpawnScore = 0;
    private scoreText?: Phaser.GameObjects.Text;
    private completedRequestCount = 0;
    private continuesUsed = 0;
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
            marker: Phaser.GameObjects.Text;
        }
    >();
    private requestKindText?: Phaser.GameObjects.Text;
    private submitButton?: Phaser.GameObjects.Text;
    private methodHotkeyHandler?: (event: KeyboardEvent) => void;
    private methodHotkeyReleaseHandler?: (event: KeyboardEvent) => void;
    private enterHoldTimeoutId?: number;
    private enterKeyDown = false;
    private enterHoldTriggered = false;
    private failureFlashOverlay?: Phaser.GameObjects.Rectangle;
    private bossSuccessOverlay?: Phaser.GameObjects.Rectangle;
    private bossSuccessText?: Phaser.GameObjects.Text;
    private gameActive = false;
    private startCountdownTimer?: Phaser.Time.TimerEvent;
    private startCountdownEnterHandler?: (event: KeyboardEvent) => void;
    private startCountdownOverlay?: Phaser.GameObjects.Rectangle;
    private startCountdownText?: Phaser.GameObjects.Text;
    private startCountdownIntroText?: Phaser.GameObjects.Text;
    private levelIntroToast?: Phaser.GameObjects.Container;
    private levelIntroToastTimer?: Phaser.Time.TimerEvent;
    private currentLevelIndex = 0;
    private currentLevel?: LevelDefinition;
    private endlessModeActive = false;
    private levelText?: Phaser.GameObjects.Text;
    private tutorialHintText?: Phaser.GameObjects.Text;
    private tutorialHighlight?: Phaser.GameObjects.Graphics;
    private tutorialCoachKey = "";
    private availableRequestMethods = new Set<ApiRequestMethod>(["GET"]);
    private introducedRequestMethods = new Set<ApiRequestMethod>();
    private methodIntroHighlights = new Set<ApiRequestMethod>();
    private selectedRequestTypeBackground?: Phaser.GameObjects.Rectangle;
    private selectedRequestTypeAccent?: Phaser.GameObjects.Rectangle;
    private selectedRequestTypeLabel?: Phaser.GameObjects.Text;
    private selectedRequestTypeValue?: Phaser.GameObjects.Text;
    private levelOverlayObjects: Phaser.GameObjects.GameObject[] = [];
    private startInEndlessMode = false;
    private startLevelIndex?: number;
    private activeRequestEntry?: QueueEntry;
    private timedRequestEntry?: QueueEntry;
    private activeRequestContainer?: Phaser.GameObjects.Container;
    private activeRequestBackground?: Phaser.GameObjects.Rectangle;
    private activeRequestTitleText?: Phaser.GameObjects.Text;
    private activeRequestBodyText?: Phaser.GameObjects.Text;

    constructor() {
        super("MainGame");
    }

    init(data?: MainGameStartData) {
        const requestedLevelIndex = data?.startLevelIndex;
        this.startInEndlessMode = data?.startInEndlessMode === true;
        this.startLevelIndex =
            isDevLevelIndex(requestedLevelIndex) ? requestedLevelIndex : (
                undefined
            );
    }

    create() {
        this.resetRuntimeState();
        if (hasUnlockedGameplayMusic(this)) {
            ensureGameplayMusic(this);
        }
        new DevLevelShortcut(this, (levelIndex) =>
            this.startDevLevel(levelIndex),
        );
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
            152,
            this.erDiagram,
        );

        this.queueManager = new QueueManager(store);
        this.configureInitialMode();

        this.dialogueModal = new NPCDialogueModal(this);

        this.queuePanel = new QueuePanel(this, this.queueManager, (entry) => {
            this.setActiveRequest(entry);
            this.startTimedRequestIfNeeded(entry);
            this.dialogueModal!.show(entry);
        });

        this.createTimeoutHud();
        this.createScoreHud();
        this.createLevelHud();
        this.createSelectedRequestTypeHud();
        this.createActiveRequestHud();
        this.createRequestHud();
        this.createFailureFlashOverlay();
        this.createBossSuccessOverlay();
        this.refreshLevelHud();
        this.syncActiveRequestAfterQueueChange();
        this.startGameCountdown();

        EventBus.emit("current-scene-ready", this);
    }

    private resetRuntimeState() {
        this.erDiagram = undefined;
        this.queueManager = undefined;
        this.queuePanel = undefined;
        this.dialogueModal = undefined;
        this.pendingRequestsPanel = undefined;
        this.score = 0;
        this.lastBossSpawnScore = 0;
        this.completedRequestCount = 0;
        this.continuesUsed = 0;
        this.timeoutNormalized = 1;
        this.gameOverTriggered = false;
        this.gameActive = false;
        this.currentLevelIndex = 0;
        this.currentLevel = undefined;
        this.endlessModeActive = false;
        this.availableRequestMethods = new Set<ApiRequestMethod>(["GET"]);
        this.introducedRequestMethods = new Set<ApiRequestMethod>();
        this.methodIntroHighlights = new Set<ApiRequestMethod>();
        this.methodButtons.clear();
        this.levelOverlayObjects = [];
        this.activeRequestEntry = undefined;
        this.timedRequestEntry = undefined;
        this.tutorialCoachKey = "";
        this.clearEnterHoldTimer();
        this.clearLevelIntroToast();
    }

    private configureInitialMode() {
        if (this.startInEndlessMode) {
            this.activateEndlessMode(false);
            return;
        }
        if (this.startLevelIndex !== undefined) {
            this.activateLevel(this.startLevelIndex, false);
            return;
        }
        this.activateLevel(0, false);
    }

    private startDevLevel(levelIndex: number) {
        if (!isDevLevelIndex(levelIndex)) {
            return;
        }
        this.scene.start("MainGame", { startLevelIndex: levelIndex });
    }

    private activateLevel(levelIndex: number, startCountdown: boolean) {
        const level = LEVEL_DEFINITIONS[levelIndex];
        if (!this.queueManager) {
            return;
        }
        this.clearLevelOverlay();
        this.clearTutorialHint();
        this.currentLevelIndex = levelIndex;
        this.currentLevel = level;
        this.endlessModeActive = false;
        this.gameActive = false;
        this.timedRequestEntry = undefined;
        this.erDiagram?.clearSelectedRequestMethod();
        this.requestKindText?.setText("Cache Method: --");
        this.updateSelectedRequestTypeHud(undefined);
        this.applyUnlockedTables(level.unlockedTables);
        this.setAvailableRequestMethods(
            level.requests.map((request) => request.objective.method),
        );
        this.queueManager.startFixedLevel(
            level.requests,
            this.difficultyForLevel(level),
            { shuffle: level.mode !== "tutorial" },
        );
        this.syncActiveRequestAfterQueueChange();
        this.setTimeoutNormalized(1);
        this.queuePanel?.draw();
        this.refreshLevelHud();
        this.updateConfirmButtonState();
        if (startCountdown) {
            this.startGameCountdown();
        }
    }

    private activateEndlessMode(startCountdown: boolean) {
        if (!this.queueManager) {
            return;
        }
        this.clearLevelOverlay();
        this.clearTutorialHint();
        this.currentLevel = undefined;
        this.endlessModeActive = true;
        this.gameActive = false;
        this.timedRequestEntry = undefined;
        this.erDiagram?.clearSelectedRequestMethod();
        this.requestKindText?.setText("Cache Method: --");
        this.updateSelectedRequestTypeHud(undefined);
        this.applyUnlockedTables(ENDLESS_MODE_DEFINITION.unlockedTables);
        this.setAvailableRequestMethods(ENDLESS_MODE_DEFINITION.requestMethods);
        this.queueManager.startEndlessMode();
        this.syncActiveRequestAfterQueueChange();
        this.setTimeoutNormalized(1);
        this.queuePanel?.draw();
        this.refreshLevelHud();
        this.updateConfirmButtonState();
        if (startCountdown) {
            this.startGameCountdown();
        }
    }

    private difficultyForLevel(level: LevelDefinition): 1 | 2 | 3 {
        if (level.id === "tutorial" || level.id === "level-1") {
            return 1;
        }
        if (
            level.id === "level-2" ||
            level.id === "level-3" ||
            level.id === "level-4"
        ) {
            return 2;
        }
        return 3;
    }

    private applyUnlockedTables(unlockedTables: EntityType[]) {
        const unlocked = new Set(unlockedTables);
        for (const table of ALL_TABLES) {
            if (unlocked.has(table)) {
                this.erDiagram?.revealTable(table);
            } else {
                this.erDiagram?.hideTable(table);
            }
        }
    }

    private setAvailableRequestMethods(methods: ApiRequestMethod[]) {
        this.availableRequestMethods = new Set(methods);
        for (const method of this.availableRequestMethods) {
            if (!this.introducedRequestMethods.has(method)) {
                this.introducedRequestMethods.add(method);
                this.methodIntroHighlights.add(method);
            }
        }
        const selected = this.erDiagram?.getSelectedRequestMethod();
        if (selected && !this.availableRequestMethods.has(selected)) {
            this.erDiagram?.clearSelectedRequestMethod();
            this.requestKindText?.setText("Cache Method: --");
            this.updateSelectedRequestTypeHud(undefined);
        }
        for (const method of this.requestMethods) {
            this.styleMethodButton(method, method === selected);
        }
    }

    private getActiveTimeoutDrainSeconds(): number | undefined {
        if (this.endlessModeActive) {
            return ENDLESS_MODE_DEFINITION.timerRuns ?
                    TIMEOUT_DRAIN_SECONDS
                :   undefined;
        }
        if (this.currentLevel?.mode !== "fixed" || !this.timedRequestEntry) {
            return undefined;
        }
        const timedRequestStillQueued = this.queueManager
            ?.getQueue()
            .some((entry) => this.isSameQueueEntry(entry, this.timedRequestEntry!));
        if (!timedRequestStillQueued) {
            this.timedRequestEntry = undefined;
            return undefined;
        }
        return REQUEST_TIMEOUT_DRAIN_SECONDS[
            this.timedRequestEntry.question.objective.method
        ];
    }

    private shouldTimerRun(): boolean {
        return this.getActiveTimeoutDrainSeconds() !== undefined;
    }

    private shouldRewardTimeOnCorrect(): boolean {
        return (
            this.endlessModeActive &&
            ENDLESS_MODE_DEFINITION.rewardTimeOnCorrect
        );
    }

    private checkFixedLevelCompletion() {
        if (
            this.endlessModeActive ||
            !this.currentLevel ||
            !this.queueManager?.isFixedLevelComplete()
        ) {
            return;
        }
        this.showLevelCompleteOverlay();
    }

    private refreshTutorialCoach() {
        if (
            this.currentLevel?.mode !== "tutorial" ||
            this.endlessModeActive ||
            this.levelOverlayObjects.length > 0
        ) {
            this.clearTutorialHint();
            return;
        }

        if (!this.activeRequestEntry) {
            const firstEntry = this.queueManager?.getQueue()[0];
            this.setTutorialCoach(
                firstEntry ?
                    `Click ${firstEntry.npc.name}'s NPC card so you can read what they need.`
                :   "Click an NPC card so you can read what they need.",
                firstEntry ?
                    this.queuePanel?.getCardBounds(firstEntry.npc.id)
                :   undefined,
                "click-npc",
            );
            return;
        }

        if (this.erDiagram?.hasPendingChanges()) {
            this.setTutorialCoach(
                `Beautiful, the response is staged. Click Confirm Request(s) to send it back to ${this.activeRequestEntry.npc.name}.`,
                this.submitButton?.getBounds(),
                "confirm",
            );
            return;
        }

        const tutorialMethod = this.activeRequestEntry.question.objective.method;
        const tutorialGetTarget = this.getTutorialGetTarget();

        if (this.erDiagram?.isTableModalVisible()) {
            if (tutorialMethod === "GET" && tutorialGetTarget) {
                if (this.erDiagram.hasStagedGetTarget(tutorialGetTarget)) {
                    this.setTutorialCoach(
                        "Perfect. That checkmark means the requested field is selected. Press Return or click Save in this table window.",
                        this.erDiagram.getTableModalSaveButtonBounds(),
                        "save-get",
                    );
                    return;
                }
                const targetBounds =
                    this.erDiagram.getGetTargetBounds(tutorialGetTarget);
                if (targetBounds) {
                    this.setTutorialCoach(
                        "Now choose the exact data to return. Click the requested field in this row.",
                        targetBounds,
                        "select-get-field",
                    );
                    return;
                }
                const pageDirection =
                    this.erDiagram.getGetTargetPageDirection(tutorialGetTarget);
                const pageButtonBounds =
                    pageDirection === -1 ?
                        this.erDiagram.getTableModalPreviousPageButtonBounds()
                    :   this.erDiagram.getTableModalNextPageButtonBounds();
                this.setTutorialCoach(
                    pageDirection === -1 ?
                        "The requested row is on an earlier page. Click the left arrow inside the table modal."
                    :   "The requested row is on another page. Click the right arrow inside the table modal.",
                    pageButtonBounds,
                    "switch-table-page",
                );
                return;
            }
            return;
        }

        if (this.erDiagram?.getSelectedRequestMethod() !== tutorialMethod) {
            this.setTutorialCoach(
                `Select ${tutorialMethod}, because this request needs that cache method.`,
                this.methodButtons.get(tutorialMethod)?.container.getBounds(),
                `select-${tutorialMethod.toLowerCase()}`,
            );
            return;
        }

        this.setTutorialCoach(
            `${tutorialMethod} is selected. Click the USER table to find the requested row.`,
            this.erDiagram.getEntityNodeBounds("USER"),
            "open-user",
        );
    }

    private setTutorialCoach(
        message: string,
        targetBounds: Phaser.Geom.Rectangle | undefined,
        key: string,
    ) {
        if (!this.tutorialHintText) {
            this.tutorialHintText = this.add
                .text(this.scale.width / 2, 286, "", {
                    color: "#111111",
                    fontSize: "16px",
                    fontStyle: "bold",
                    backgroundColor: "#fff7cc",
                    padding: { x: 12, y: 8 },
                    align: "center",
                    wordWrap: { width: 680 },
                })
                .setDepth(3001)
                .setOrigin(0.5, 0)
                .setScrollFactor(0);
            this.tutorialHintText.setStroke("#8a6d3b", 2);
        }
        this.tutorialHintText.setY(this.tutorialCoachYFor(key));
        if (this.tutorialCoachKey !== key) {
            this.tutorialCoachKey = key;
            this.tutorialHintText.setText(message);
        }
        this.tutorialHintText.setVisible(true);
        this.drawTutorialHighlight(targetBounds);
    }

    private tutorialCoachYFor(key: string): number {
        if (
            key === "select-get-field" ||
            key === "save-get" ||
            key === "switch-table-page"
        ) {
            return 82;
        }
        return 286;
    }

    private getTutorialGetTarget(): string | undefined {
        const objective = this.activeRequestEntry?.question.objective;
        if (
            objective?.method !== "GET" ||
            !objective.targetRowId ||
            !objective.targetField
        ) {
            return undefined;
        }
        return `field:${objective.targetRowId}:${objective.targetField}`;
    }

    private drawTutorialHighlight(targetBounds?: Phaser.Geom.Rectangle) {
        if (!this.tutorialHighlight) {
            this.tutorialHighlight = this.add.graphics();
            this.tutorialHighlight.setDepth(3002);
            this.tutorialHighlight.setScrollFactor(0);
        }
        this.tutorialHighlight.clear();
        if (!targetBounds) {
            this.tutorialHighlight.setVisible(false);
            return;
        }
        const pad = 8;
        this.tutorialHighlight.setVisible(true);
        this.tutorialHighlight.lineStyle(5, 0xffd23f, 1);
        this.tutorialHighlight.strokeRoundedRect(
            targetBounds.x - pad,
            targetBounds.y - pad,
            targetBounds.width + pad * 2,
            targetBounds.height + pad * 2,
            8,
        );
        this.tutorialHighlight.lineStyle(2, 0x111111, 0.85);
        this.tutorialHighlight.strokeRoundedRect(
            targetBounds.x - pad - 3,
            targetBounds.y - pad - 3,
            targetBounds.width + pad * 2 + 6,
            targetBounds.height + pad * 2 + 6,
            10,
        );
    }

    private clearTutorialHint() {
        this.tutorialCoachKey = "";
        this.tutorialHintText?.destroy();
        this.tutorialHintText = undefined;
        this.tutorialHighlight?.destroy();
        this.tutorialHighlight = undefined;
    }

    private showLevelCompleteOverlay() {
        if (!this.currentLevel || this.levelOverlayObjects.length > 0) {
            return;
        }
        this.gameActive = false;
        this.input.enabled = true;
        this.updateConfirmButtonState();
        this.clearTutorialHint();
        this.timedRequestEntry = undefined;
        this.setActiveRequest(undefined);
        if (this.currentLevel.mode === "tutorial") {
            unlockGameplayMusic(this);
        }

        const overlay = this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.45,
            )
            .setDepth(2600)
            .setScrollFactor(0);
        const titleText =
            this.currentLevelIndex >= LEVEL_DEFINITIONS.length - 1 ?
                "All Levels Complete"
            :   `${this.currentLevel.title} Complete`;
        const title = this.add
            .text(this.scale.width / 2, this.scale.height / 2 - 92, titleText, {
                color: "#ffffff",
                fontSize: "44px",
                fontStyle: "bold",
                stroke: "#111111",
                strokeThickness: 7,
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(2601)
            .setScrollFactor(0);
        this.levelOverlayObjects.push(overlay, title);

        if (this.currentLevelIndex < LEVEL_DEFINITIONS.length - 1) {
            const nextLevel = LEVEL_DEFINITIONS[this.currentLevelIndex + 1];
            const subtitle = this.add
                .text(
                    this.scale.width / 2,
                    this.scale.height / 2 - 34,
                    `Next: ${nextLevel.title}`,
                    {
                        color: "#ffffff",
                        fontSize: "22px",
                        fontStyle: "bold",
                        align: "center",
                    },
                )
                .setOrigin(0.5)
                .setDepth(2601)
                .setScrollFactor(0);
            const continueButton = this.createOverlayButton(
                this.scale.width / 2,
                this.scale.height / 2 + 36,
                "Continue",
                () => this.activateLevel(this.currentLevelIndex + 1, true),
            );
            this.levelOverlayObjects.push(subtitle, continueButton);
            return;
        }

        const subtitle = this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2 - 34,
                "Choose your next run.",
                {
                    color: "#ffffff",
                    fontSize: "22px",
                    fontStyle: "bold",
                    align: "center",
                },
            )
            .setOrigin(0.5)
            .setDepth(2601)
            .setScrollFactor(0);
        const startOverButton = this.createOverlayButton(
            this.scale.width / 2 - 116,
            this.scale.height / 2 + 42,
            "Start Over",
            () => this.scene.start("MainGame"),
        );
        const endlessButton = this.createOverlayButton(
            this.scale.width / 2 + 126,
            this.scale.height / 2 + 42,
            "Endless Mode",
            () => this.activateEndlessMode(true),
        );
        this.levelOverlayObjects.push(subtitle, startOverButton, endlessButton);
    }

    private showTimeoutGameOverOverlay() {
        if (this.levelOverlayObjects.length > 0) {
            return;
        }
        this.gameActive = false;
        this.input.enabled = true;
        this.updateConfirmButtonState();
        this.clearTutorialHint();
        this.clearLevelIntroToast();
        while (this.closeTopModalIfOpen()) {
            // Close stacked modal layers so the game-over overlay owns the screen.
        }
        this.timedRequestEntry = undefined;
        this.setActiveRequest(undefined);

        const overlay = this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.78,
            )
            .setDepth(4000)
            .setScrollFactor(0)
            .setInteractive();
        const title = this.add
            .text(this.scale.width / 2, this.scale.height / 2 - 88, "Game Over", {
                color: "#ffffff",
                fontSize: "58px",
                fontStyle: "bold",
                stroke: "#111111",
                strokeThickness: 9,
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(4001)
            .setScrollFactor(0);

        const remainingContinues = Math.max(0, MAX_CONTINUES - this.continuesUsed);
        const continueButton =
            remainingContinues > 0 ?
                this.createOverlayButton(
                    this.scale.width / 2 - 124,
                    this.scale.height / 2 + 28,
                    `Continue (${remainingContinues} left)`,
                    () => this.continueCurrentRun(),
                )
            :   this.createDisabledOverlayButton(
                    this.scale.width / 2 - 124,
                    this.scale.height / 2 + 28,
                    "Continue (0 left)",
                );
        const startOverButton = this.createOverlayButton(
            this.scale.width / 2 + 134,
            this.scale.height / 2 + 28,
            "Start Over",
            () => this.scene.start("MainGame", { startLevelIndex: 1 }),
        );
        continueButton.setDepth(4001);
        startOverButton.setDepth(4001);

        this.levelOverlayObjects.push(overlay, title, continueButton, startOverButton);
    }

    private continueCurrentRun() {
        if (this.continuesUsed >= MAX_CONTINUES) {
            return;
        }
        this.continuesUsed += 1;
        this.gameOverTriggered = false;
        this.clearLevelOverlay();
        if (this.endlessModeActive) {
            this.activateEndlessMode(true);
            return;
        }
        this.activateLevel(this.currentLevelIndex, true);
    }

    private createOverlayButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
    ): Phaser.GameObjects.Text {
        const button = this.add
            .text(x, y, label, {
                color: "#ffffff",
                fontSize: "22px",
                fontStyle: "bold",
                backgroundColor: "#0b8f08",
                padding: { x: 18, y: 10 },
            })
            .setOrigin(0.5)
            .setDepth(2601)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });
        button.setStroke("#063f05", 3);
        button.on("pointerdown", onClick);
        return button;
    }

    private createDisabledOverlayButton(
        x: number,
        y: number,
        label: string,
    ): Phaser.GameObjects.Text {
        const button = this.add
            .text(x, y, label, {
                color: "#d1d5db",
                fontSize: "22px",
                fontStyle: "bold",
                backgroundColor: "#6b7280",
                padding: { x: 18, y: 10 },
            })
            .setOrigin(0.5)
            .setDepth(2601)
            .setScrollFactor(0);
        button.setStroke("#374151", 3);
        return button;
    }

    private clearLevelOverlay() {
        for (const object of this.levelOverlayObjects) {
            object.destroy();
        }
        this.levelOverlayObjects = [];
    }

    private addScore(entry: QueueEntry) {
        const points = this.queueManager!.getPointValue(entry);
        this.score += points;
        this.updateScoreHud();
        this.checkBossSpawn();
    }

    private checkBossSpawn() {
        if (!this.queueManager || !this.queuePanel) return;
        if (!this.endlessModeActive) return;
        if (this.queueManager.hasBossInQueue()) return;

        const scoresSinceLastBoss = this.score - this.lastBossSpawnScore;
        if (scoresSinceLastBoss >= BOSS_SCORE_THRESHOLD) {
            this.lastBossSpawnScore = this.score;
            this.queueManager.spawnBoss();
            this.queuePanel.draw();
        }
    }

    update(_time: number, delta: number) {
        if (this.gameOverTriggered || !this.gameActive) {
            return;
        }
        this.refreshTutorialCoach();
        const activeDrainSeconds = this.getActiveTimeoutDrainSeconds();
        if (activeDrainSeconds === undefined) {
            return;
        }
        const elapsedSeconds = delta / 1000;
        const drainedValue = elapsedSeconds / activeDrainSeconds;
        this.setTimeoutNormalized(this.timeoutNormalized - drainedValue);
    }

    changeScene() {
        this.scene.start("GameOver");
    }

    private createRequestHud() {
        const { width, height } = this.scale;
        const inventoryWidth = Math.floor(width * 0.62);
        const inventoryHeight = 156;
        const hiddenBottomPx = 18;
        const inventoryX = width - inventoryWidth - 20;
        const inventoryY = height - inventoryHeight + hiddenBottomPx;

        const cachePanel = this.add
            .rectangle(
                inventoryX,
                inventoryY,
                inventoryWidth,
                inventoryHeight,
                0xf8fafc,
                0.96,
            )
            .setOrigin(0, 0)
            .setDepth(9);
        cachePanel.setStrokeStyle(3, 0x111111, 0.92);

        this.requestKindText = this.add
            .text(inventoryX + 18, inventoryY + 18, "Cache Method: --", {
                color: "#111",
                fontSize: "20px",
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

        let x = inventoryX + 20;
        const y = inventoryY + 64;
        for (let index = 0; index < this.requestMethods.length; index += 1) {
            const method = this.requestMethods[index];
            const colors = METHOD_UI_COLORS[method];
            const buttonWidth = 118;
            const buttonHeight = 48;
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
                    fontSize: "18px",
                    fontStyle: "bold",
                },
            );
            buttonLabel.setOrigin(0.5);
            const selectedMarker = this.add
                .text(buttonWidth - 16, 8, "✓", {
                    color: colors.text,
                    fontSize: "20px",
                    fontStyle: "bold",
                    stroke: "#111111",
                    strokeThickness: 3,
                })
                .setOrigin(0.5)
                .setVisible(false);
            const buttonContainer = this.add
                .container(x, y, [buttonBox, buttonLabel, selectedMarker])
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
                marker: selectedMarker,
            });
            this.styleMethodButton(method, false);
            x += 128;
        }
        this.bindMethodHotkeys();

        this.submitButton = this.add
            .text(
                inventoryX + inventoryWidth - 184,
                inventoryY - 42,
                "Confirm Request(s)",
                {
                    color: "#ffffff",
                    fontSize: "18px",
                    fontStyle: "bold",
                    backgroundColor: "#0b8f08",
                    padding: { x: 12, y: 8 },
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
        const available = this.availableRequestMethods.has(method);
        const colors = METHOD_UI_COLORS[method];
        const introHighlighted =
            available && this.methodIntroHighlights.has(method);
        button.box.setFillStyle(
            this.toColorNumber(
                selected && available ?
                    colors.selectedBackground
                :   colors.background,
            ),
            available ? 1 : 0.45,
        );
        if (selected && available) {
            button.box.setStrokeStyle(7, 0x000000, 1);
        } else if (introHighlighted) {
            button.box.setStrokeStyle(6, 0xffd23f, 1);
        } else {
            button.box.setStrokeStyle();
        }
        button.label.setStyle({
            fontSize: selected && available ? "20px" : "18px",
            fontStyle: "bold",
            color: available ? colors.text : "#666666",
        });
        button.marker.setVisible(selected && available);
        button.container.setAlpha(available ? 1 : 0.45);
        button.container.setDepth(
            selected && available ? 12
            : introHighlighted ? 11
            : 10,
        );
        button.container.setScale(
            selected && available ? 1.05
            : introHighlighted ? 1.04
            : 1,
        );
    }

    private selectMethod(method: ApiRequestMethod) {
        if (!this.gameActive || this.gameOverTriggered) {
            return;
        }
        if (
            this.currentLevel?.mode === "tutorial" &&
            !this.activeRequestEntry
        ) {
            this.flashFailureOverlay();
            this.refreshTutorialCoach();
            return;
        }
        if (!this.availableRequestMethods.has(method)) {
            this.flashFailureOverlay();
            return;
        }
        this.methodIntroHighlights.delete(method);
        this.erDiagram?.setSelectedRequestMethod(method);
        for (const m of this.requestMethods) {
            this.styleMethodButton(m, m === method);
        }
        this.requestKindText?.setText(`Cache Method: ${method}`);
        this.updateSelectedRequestTypeHud(method);
    }

    private submitRequest() {
        if (!this.gameActive || this.gameOverTriggered || !this.erDiagram) {
            return;
        }
        if (!this.erDiagram.hasPendingChanges()) {
            playRequestFailureSound(this);
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
            for (let index = 0; index < result.unmatched.length; index += 1) {
                this.time.delayedCall(index * 260, () => {
                    if (!this.gameOverTriggered) {
                        playRequestFailureSound(this);
                    }
                });
            }
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

        for (let index = 0; index < result.matched.length; index += 1) {
            this.time.delayedCall(index * 110, () => {
                if (!this.gameOverTriggered) {
                    playRequestSuccessSound(this);
                }
            });
        }
        this.completedRequestCount += result.matched.length;
        if (this.shouldRewardTimeOnCorrect()) {
            this.applyTimeoutRewardSeries(result.matched.length);
        }
        this.refreshLevelHud();

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
                this.syncActiveRequestAfterQueueChange();
                this.queuePanel!.draw();
                this.refreshLevelHud();
                this.checkFixedLevelCompletion();
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
                this.successStatusCodeForMethod(
                    entry.question.objective.method,
                ),
                () => {
                    if (this.gameOverTriggered) {
                        onSuccessComplete();
                        return;
                    }
                    const wasBoss = entry.isBoss === true;
                    this.queueManager!.completeNpcEntry(entry);
                    this.addScore(entry);

                    if (wasBoss) {
                        this.onBossDefeated();
                    }

                    onSuccessComplete();
                },
            );
        }
    }

    private onBossDefeated() {
        if (!this.endlessModeActive) {
            return;
        }
        // 1. increase difficulty FIRST so resetQueue picks new questions at new difficulty
        this.queueManager!.increaseDifficulty();

        // 2. reset queue so all NPCs get fresh questions at the new difficulty
        this.queueManager!.resetQueue();

        // 3. reveal tables based on how many bosses have been defeated
        const bossCount = this.queueManager!.getBossCount();
        if (bossCount === 1) {
            this.erDiagram!.revealTable("PET");
            this.erDiagram!.revealTable("HOUSE");
        } else if (bossCount === 2) {
            this.erDiagram!.revealTable("JOB");
            this.erDiagram!.revealTable("VEHICLE");
            this.erDiagram!.revealTable("EMPLOYMENT");
        }

        // 4. big timeout refill
        this.applyTimeoutBurst(TIMEOUT_BOSS_REWARD);

        // 5. flash gold overlay
        this.flashBossSuccessOverlay();
    }

    private createBossSuccessOverlay() {
        this.bossSuccessOverlay = this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0xffaa00,
                0.35,
            )
            .setDepth(2000)
            .setVisible(false)
            .setScrollFactor(0);

        this.bossSuccessText = this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2,
                "BOSS DEFEATED!\n+Time Refill",
                {
                    color: "#ffffff",
                    fontSize: "48px",
                    fontStyle: "bold",
                    stroke: "#aa5500",
                    strokeThickness: 8,
                    align: "center",
                },
            )
            .setOrigin(0.5)
            .setDepth(2001)
            .setVisible(false)
            .setScrollFactor(0);
    }

    private flashBossSuccessOverlay() {
        if (!this.bossSuccessOverlay || !this.bossSuccessText) return;

        this.bossSuccessOverlay.setAlpha(0.35).setVisible(true);
        this.bossSuccessText.setAlpha(1).setVisible(true).setScale(0.8);

        this.tweens.killTweensOf(this.bossSuccessOverlay);
        this.tweens.killTweensOf(this.bossSuccessText);

        this.tweens.add({
            targets: this.bossSuccessText,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 300,
            ease: "Sine.easeOut",
        });

        this.time.delayedCall(1200, () => {
            this.tweens.add({
                targets: [this.bossSuccessOverlay, this.bossSuccessText],
                alpha: 0,
                duration: 400,
                ease: "Quad.easeOut",
                onComplete: () => {
                    this.bossSuccessOverlay?.setVisible(false);
                    this.bossSuccessText?.setVisible(false);
                },
            });
        });
    }

    private updateConfirmButtonState() {
        if (!this.submitButton) {
            return;
        }
        const canConfirm = Boolean(
            this.gameActive && this.erDiagram?.hasPendingChanges(),
        );
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

    private createScoreHud() {
        this.scoreText = this.add
            .text(this.scale.width - 16, 14, "", {
                color: "#111",
                fontSize: "18px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
                padding: { x: 10, y: 5 },
            })
            .setDepth(31)
            .setOrigin(1, 0);

        this.updateScoreHud();
    }

    private createLevelHud() {
        this.levelText = this.add
            .text(this.scale.width - 16, 50, "", {
                color: "#111",
                fontSize: "16px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
                padding: { x: 10, y: 5 },
            })
            .setDepth(31)
            .setOrigin(1, 0);
    }

    private createSelectedRequestTypeHud() {
        const panelWidth = 172;
        const panelHeight = 74;
        const x = 58;
        const y = this.scale.height / 2 - panelHeight / 2;

        this.selectedRequestTypeBackground = this.add
            .rectangle(0, 0, panelWidth, panelHeight, 0xffffff, 0.96)
            .setOrigin(0, 0);
        this.selectedRequestTypeBackground.setStrokeStyle(3, 0x424242, 0.9);

        this.selectedRequestTypeAccent = this.add
            .rectangle(0, 0, 12, panelHeight, 0x9ca3af, 1)
            .setOrigin(0, 0);

        this.selectedRequestTypeLabel = this.add
            .text(24, 12, "Request Type", {
                color: "#111111",
                fontSize: "13px",
                fontStyle: "bold",
            })
            .setOrigin(0, 0);

        this.selectedRequestTypeValue = this.add
            .text(24, 35, "--", {
                color: "#4b5563",
                fontSize: "25px",
                fontStyle: "bold",
            })
            .setOrigin(0, 0);

        this.add
            .container(x, y, [
                this.selectedRequestTypeBackground,
                this.selectedRequestTypeAccent,
                this.selectedRequestTypeLabel,
                this.selectedRequestTypeValue,
            ])
            .setDepth(31)
            .setScrollFactor(0);
    }

    private updateSelectedRequestTypeHud(method?: ApiRequestMethod) {
        if (
            !this.selectedRequestTypeBackground ||
            !this.selectedRequestTypeAccent ||
            !this.selectedRequestTypeValue
        ) {
            return;
        }
        if (!method) {
            this.selectedRequestTypeBackground.setStrokeStyle(3, 0x424242, 0.9);
            this.selectedRequestTypeAccent.setFillStyle(0x9ca3af, 1);
            this.selectedRequestTypeValue.setText("--");
            this.selectedRequestTypeValue.setStyle({ color: "#4b5563" });
            return;
        }
        const colors = METHOD_UI_COLORS[method];
        const methodColor = this.toColorNumber(colors.background);
        this.selectedRequestTypeBackground.setStrokeStyle(4, methodColor, 1);
        this.selectedRequestTypeAccent.setFillStyle(methodColor, 1);
        this.selectedRequestTypeValue.setText(method);
        this.selectedRequestTypeValue.setStyle({ color: colors.selectedBackground });
    }

    private createActiveRequestHud() {
        const panelWidth = 590;
        this.activeRequestBackground = this.add
            .rectangle(0, 0, panelWidth, 62, 0xffffff, 0.96)
            .setOrigin(0.5, 0);
        this.activeRequestBackground.setStrokeStyle(3, 0x111111, 0.9);

        this.activeRequestTitleText = this.add
            .text(-panelWidth / 2 + 14, 8, "", {
                color: "#111111",
                fontSize: "14px",
                fontStyle: "bold",
            })
            .setOrigin(0, 0);

        this.activeRequestBodyText = this.add
            .text(-panelWidth / 2 + 14, 30, "", {
                color: "#222222",
                fontSize: "12px",
                fontFamily: "monospace",
                wordWrap: { width: panelWidth - 28 },
            })
            .setOrigin(0, 0);

        this.activeRequestContainer = this.add
            .container(358, 8, [
                this.activeRequestBackground,
                this.activeRequestTitleText,
                this.activeRequestBodyText,
            ])
            .setDepth(3000)
            .setVisible(false)
            .setScrollFactor(0);
        this.updateActiveRequestHud();
    }

    private updateScoreHud() {
        this.scoreText?.setText(`Score: ${this.score}`);
    }

    private refreshLevelHud() {
        if (!this.levelText) {
            return;
        }
        if (this.endlessModeActive) {
            this.levelText.setText("Endless Mode");
            return;
        }
        if (!this.currentLevel || !this.queueManager) {
            this.levelText.setText("");
            return;
        }
        const progress = this.queueManager.getFixedLevelProgress();
        this.levelText.setText(
            `${this.currentLevel.title}: ${progress.completed}/${progress.total}`,
        );
    }

    private setActiveRequest(entry?: QueueEntry) {
        this.activeRequestEntry = entry;
        this.updateActiveRequestHud();
    }

    private startTimedRequestIfNeeded(entry: QueueEntry) {
        if (
            this.endlessModeActive ||
            this.currentLevel?.mode !== "fixed" ||
            this.gameOverTriggered
        ) {
            return;
        }
        this.timedRequestEntry = entry;
    }

    private syncActiveRequestAfterQueueChange() {
        if (!this.queueManager) {
            this.setActiveRequest(undefined);
            this.timedRequestEntry = undefined;
            return;
        }
        const queue = this.queueManager.getQueue();
        if (
            this.timedRequestEntry &&
            !queue.some((entry) =>
                this.isSameQueueEntry(entry, this.timedRequestEntry!),
            )
        ) {
            this.timedRequestEntry = undefined;
        }
        const activeEntry = this.activeRequestEntry;
        if (activeEntry) {
            const activeStillQueued = queue.some((entry) =>
                this.isSameQueueEntry(entry, activeEntry),
            );
            if (activeStillQueued) {
                this.updateActiveRequestHud();
                return;
            }
        }
        this.setActiveRequest(undefined);
    }

    private isSameQueueEntry(a: QueueEntry, b: QueueEntry): boolean {
        if (a.requestId || b.requestId) {
            return a.requestId === b.requestId;
        }
        return a.npc.id === b.npc.id;
    }

    private updateActiveRequestHud() {
        if (
            !this.activeRequestContainer ||
            !this.activeRequestTitleText ||
            !this.activeRequestBodyText
        ) {
            return;
        }
        if (!this.activeRequestEntry) {
            this.activeRequestContainer.setVisible(false);
            return;
        }
        this.activeRequestTitleText.setText(
            `Active request: ${this.activeRequestEntry.npc.name} [${this.activeRequestEntry.npc.id}]`,
        );
        this.activeRequestBodyText.setText(
            this.activeRequestEntry.question.naturalDialogue ||
                this.activeRequestEntry.question.dialogue,
        );
        this.activeRequestContainer.setVisible(true);
        this.activeRequestContainer.setDepth(3000);
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
                if (this.shouldTimerRun()) {
                    this.applyTimeoutBurst(-TIMEOUT_PENALTY_PER_INCORRECT);
                }
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
        this.showTimeoutGameOverOverlay();
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
            .setDisplaySize(
                TIMEOUT_BAR_WIDTH + 4,
                Math.max(2, fromGeometry.height),
            );
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
        if (
            !this.input.keyboard ||
            this.methodHotkeyHandler ||
            this.methodHotkeyReleaseHandler
        ) {
            return;
        }
        this.methodHotkeyHandler = (event: KeyboardEvent) => {
            if (event.defaultPrevented) {
                return;
            }
            if (!this.gameActive || this.gameOverTriggered) {
                return;
            }
            if (!event.repeat && event.key === "Escape") {
                if (this.closeTopModalIfOpen()) {
                    event.preventDefault();
                }
                return;
            }
            if (this.hasOpenModal()) {
                return;
            }
            if (this.isEnterKey(event)) {
                if (event.repeat || this.enterKeyDown) {
                    return;
                }
                this.enterKeyDown = true;
                this.enterHoldTriggered = false;
                this.clearEnterHoldTimer();
                this.enterHoldTimeoutId = window.setTimeout(() => {
                    this.enterHoldTimeoutId = undefined;
                    if (
                        !this.enterKeyDown ||
                        this.enterHoldTriggered ||
                        this.gameOverTriggered ||
                        this.hasOpenModal()
                    ) {
                        return;
                    }
                    if (!this.erDiagram?.hasPendingChanges()) {
                        return;
                    }
                    this.enterHoldTriggered = true;
                    this.submitRequest();
                }, 1000);
                return;
            }
            if (event.repeat) {
                return;
            }
            const method = this.methodForDigit(event.key, event.code);
            if (method) {
                this.selectMethod(method);
            }
        };
        this.methodHotkeyReleaseHandler = (event: KeyboardEvent) => {
            if (!this.isEnterKey(event)) {
                return;
            }
            this.enterKeyDown = false;
            this.enterHoldTriggered = false;
            this.clearEnterHoldTimer();
        };
        this.input.keyboard.on("keydown", this.methodHotkeyHandler);
        this.input.keyboard.on("keyup", this.methodHotkeyReleaseHandler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.clearEnterHoldTimer();
            if (this.startCountdownTimer) {
                this.startCountdownTimer.remove(false);
                this.startCountdownTimer = undefined;
            }
            this.clearStartCountdownOverlay();
            this.clearLevelIntroToast();
            if (!this.input.keyboard) {
                return;
            }
            if (this.methodHotkeyHandler) {
                this.input.keyboard.off("keydown", this.methodHotkeyHandler);
            }
            if (this.methodHotkeyReleaseHandler) {
                this.input.keyboard.off(
                    "keyup",
                    this.methodHotkeyReleaseHandler,
                );
            }
            this.methodHotkeyHandler = undefined;
            this.methodHotkeyReleaseHandler = undefined;
        });
    }

    private startGameCountdown() {
        this.clearStartCountdownOverlay();
        if (this.currentLevel?.mode === "tutorial") {
            this.gameActive = true;
            this.input.enabled = true;
            this.updateConfirmButtonState();
            this.refreshLevelHud();
            this.showLevelIntroToast();
            this.refreshTutorialCoach();
            return;
        }

        this.clearTutorialHint();
        this.gameActive = false;
        this.updateConfirmButtonState();
        this.input.enabled = true;

        this.startCountdownOverlay = this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.35,
            )
            .setDepth(2500)
            .setScrollFactor(0)
            .setInteractive();

        if (this.currentLevel?.intro) {
            this.startCountdownIntroText = this.add
                .text(
                    this.scale.width / 2,
                    this.scale.height / 2 - 134,
                    `${this.currentLevel.title}\n${this.currentLevel.intro}`,
                    {
                        color: "#ffffff",
                        fontSize: "21px",
                        fontStyle: "bold",
                        stroke: "#111111",
                        strokeThickness: 5,
                        align: "center",
                        wordWrap: {
                            width: Math.min(760, this.scale.width - 48),
                        },
                    },
                )
                .setOrigin(0.5)
                .setDepth(2501)
                .setScrollFactor(0);
        }

        this.startCountdownText = this.add
            .text(this.scale.width / 2, this.scale.height / 2 + 56, "", {
                color: "#ffffff",
                fontSize: "30px",
                fontStyle: "bold",
                stroke: "#111111",
                strokeThickness: 6,
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(2501)
            .setScrollFactor(0);

        this.showCountdownStartPrompt();
        this.waitForCountdownStartInput();
    }

    private waitForCountdownStartInput() {
        this.clearStartCountdownEnterHandler();
        if (!this.input.keyboard) {
            this.beginStartCountdownTicks();
            return;
        }
        this.startCountdownEnterHandler = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                event.repeat ||
                !this.isEnterKey(event)
            ) {
                return;
            }
            event.preventDefault();
            this.beginStartCountdownTicks();
        };
        this.input.keyboard.on("keydown", this.startCountdownEnterHandler);
    }

    private beginStartCountdownTicks() {
        if (!this.startCountdownText) {
            return;
        }
        this.clearStartCountdownEnterHandler();
        this.input.enabled = false;

        let secondsRemaining = 3;
        this.showCountdownText(`${secondsRemaining}`, false);
        this.startCountdownTimer = this.time.addEvent({
            delay: 1000,
            repeat: 2,
            callback: () => {
                secondsRemaining -= 1;
                if (secondsRemaining > 0) {
                    this.showCountdownText(`${secondsRemaining}`, false);
                    return;
                }
                this.startGameplayPhase();
            },
        });
    }

    private showCountdownStartPrompt() {
        if (!this.startCountdownText) {
            return;
        }
        this.startCountdownText.setText("Press Enter to Start Countdown");
        this.startCountdownText.setStyle({
            color: "#ffffff",
            fontSize: "30px",
            fontStyle: "bold",
            stroke: "#111111",
            strokeThickness: 6,
            align: "center",
        });
        this.startCountdownText.setScale(1);
        this.startCountdownText.setAlpha(1);
        this.tweens.killTweensOf(this.startCountdownText);
        this.tweens.add({
            targets: this.startCountdownText,
            alpha: 0.62,
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    private showCountdownText(text: string, isRush: boolean) {
        if (!this.startCountdownText) {
            return;
        }
        this.startCountdownText.setText(text);
        this.startCountdownText.setStyle({
            color: isRush ? "#ffe066" : "#ffffff",
            fontSize: isRush ? "108px" : "140px",
            fontStyle: "bold",
            stroke: "#111111",
            strokeThickness: 10,
        });
        this.startCountdownText.setScale(0.78);
        this.startCountdownText.setAlpha(1);
        this.tweens.killTweensOf(this.startCountdownText);
        this.tweens.add({
            targets: this.startCountdownText,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 260,
            ease: "Sine.easeOut",
        });
    }

    private startGameplayPhase() {
        this.startCountdownTimer = undefined;
        this.gameActive = true;
        this.input.enabled = true;
        this.updateConfirmButtonState();
        this.refreshLevelHud();
        this.showCountdownText("RUSH!", true);
        this.time.delayedCall(650, () => {
            this.clearStartCountdownOverlay();
        });
    }

    private showLevelIntroToast() {
        const level = this.currentLevel;
        if (!level?.intro) {
            return;
        }
        this.clearLevelIntroToast();

        const toastWidth = Math.min(760, this.scale.width - 48);
        const text = this.add
            .text(0, 0, `${level.title}\n${level.intro}`, {
                color: "#ffffff",
                fontSize: "17px",
                fontStyle: "bold",
                align: "center",
                wordWrap: { width: toastWidth - 28 },
            })
            .setOrigin(0.5);
        const toastHeight = Math.max(72, text.height + 24);
        const background = this.add
            .rectangle(0, 0, toastWidth, toastHeight, 0x111111, 0.88)
            .setStrokeStyle(2, 0xffffff, 0.8);
        this.levelIntroToast = this.add
            .container(this.scale.width / 2, 108, [background, text])
            .setDepth(3004)
            .setScrollFactor(0);
        this.levelIntroToastTimer = this.time.delayedCall(4200, () => {
            if (!this.levelIntroToast) {
                return;
            }
            this.tweens.add({
                targets: this.levelIntroToast,
                alpha: 0,
                duration: 280,
                ease: "Quad.easeOut",
                onComplete: () => this.clearLevelIntroToast(),
            });
        });
    }

    private clearLevelIntroToast() {
        this.levelIntroToastTimer?.remove(false);
        this.levelIntroToastTimer = undefined;
        this.levelIntroToast?.destroy();
        this.levelIntroToast = undefined;
    }

    private clearStartCountdownOverlay() {
        this.clearStartCountdownEnterHandler();
        if (this.startCountdownTimer) {
            this.startCountdownTimer.remove(false);
            this.startCountdownTimer = undefined;
        }
        if (this.startCountdownText) {
            this.tweens.killTweensOf(this.startCountdownText);
        }
        if (this.startCountdownIntroText) {
            this.tweens.killTweensOf(this.startCountdownIntroText);
        }
        this.startCountdownText?.destroy();
        this.startCountdownText = undefined;
        this.startCountdownIntroText?.destroy();
        this.startCountdownIntroText = undefined;
        this.startCountdownOverlay?.destroy();
        this.startCountdownOverlay = undefined;
    }

    private clearStartCountdownEnterHandler() {
        if (!this.startCountdownEnterHandler || !this.input.keyboard) {
            this.startCountdownEnterHandler = undefined;
            return;
        }
        this.input.keyboard.off("keydown", this.startCountdownEnterHandler);
        this.startCountdownEnterHandler = undefined;
    }

    private clearEnterHoldTimer() {
        if (this.enterHoldTimeoutId === undefined) {
            return;
        }
        window.clearTimeout(this.enterHoldTimeoutId);
        this.enterHoldTimeoutId = undefined;
    }

    private isEnterKey(event: KeyboardEvent): boolean {
        return event.key === "Enter" || event.code === "NumpadEnter";
    }

    private hasOpenModal(): boolean {
        return Boolean(
            this.dialogueModal?.isVisible() ||
            this.erDiagram?.hasOpenModalLayer(),
        );
    }

    private closeTopModalIfOpen(): boolean {
        if (this.erDiagram?.isTableRowEditorVisible()) {
            return this.erDiagram.closeTopModalLayer();
        }
        if (this.dialogueModal?.isVisible()) {
            this.dialogueModal.hide();
            return true;
        }
        if (this.erDiagram?.isTableModalVisible()) {
            return this.erDiagram.closeTopModalLayer();
        }
        return false;
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

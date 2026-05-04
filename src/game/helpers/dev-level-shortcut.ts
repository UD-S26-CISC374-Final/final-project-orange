import { LEVEL_DEFINITIONS } from "../constants/level_requests";

// if you're reading this, then congratulations! you have found the secret dev level shortcut code 🥳
// that being said, you should probably just play the game, especially if you actually want to learn

const DEV_LEVEL_HOLD_MS = 1000;
const DEV_MODIFIER_KEYS = ["b", "j", "p"] as const;

type DevModifierKey = (typeof DEV_MODIFIER_KEYS)[number];

export function isDevLevelIndex(
    levelIndex: number | undefined,
): levelIndex is number {
    return (
        levelIndex !== undefined &&
        levelIndex > 0 &&
        levelIndex < LEVEL_DEFINITIONS.length
    );
}

export class DevLevelShortcut {
    private readonly scene: Phaser.Scene;
    private readonly onLevelSelected: (levelIndex: number) => void;
    private readonly heldModifiers = new Set<DevModifierKey>();
    private readonly heldLevelIndices = new Set<number>();
    private readonly keydownHandler: (event: KeyboardEvent) => void;
    private readonly keyupHandler: (event: KeyboardEvent) => void;
    private readonly shutdownHandler: () => void;
    private holdTimeoutId?: number;
    private pendingLevelIndex?: number;
    private lastPressedLevelIndex?: number;
    private triggered = false;
    private destroyed = false;

    constructor(
        scene: Phaser.Scene,
        onLevelSelected: (levelIndex: number) => void,
    ) {
        this.scene = scene;
        this.onLevelSelected = onLevelSelected;
        this.keydownHandler = (event: KeyboardEvent) => this.onKeydown(event);
        this.keyupHandler = (event: KeyboardEvent) => this.onKeyup(event);
        this.shutdownHandler = () => this.destroy();
        this.bind();
    }

    private bind() {
        this.scene.input.keyboard?.on("keydown", this.keydownHandler);
        this.scene.input.keyboard?.on("keyup", this.keyupHandler);
        this.scene.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            this.shutdownHandler,
        );
    }

    private destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.cancelHold();
        this.scene.input.keyboard?.off("keydown", this.keydownHandler);
        this.scene.input.keyboard?.off("keyup", this.keyupHandler);
        this.scene.events.off(
            Phaser.Scenes.Events.SHUTDOWN,
            this.shutdownHandler,
        );
    }

    private onKeydown(event: KeyboardEvent) {
        const modifier = modifierFromEvent(event);
        const levelIndex = levelIndexFromEvent(event);

        if (modifier) {
            this.heldModifiers.add(modifier);
        }
        if (levelIndex !== undefined) {
            this.heldLevelIndices.add(levelIndex);
            this.lastPressedLevelIndex = levelIndex;
        }
        if (modifier || levelIndex !== undefined) {
            this.refreshHold(event);
        }
    }

    private onKeyup(event: KeyboardEvent) {
        const modifier = modifierFromEvent(event);
        const levelIndex = levelIndexFromEvent(event);

        if (modifier) {
            this.heldModifiers.delete(modifier);
        }
        if (levelIndex !== undefined) {
            this.heldLevelIndices.delete(levelIndex);
            if (this.lastPressedLevelIndex === levelIndex) {
                this.lastPressedLevelIndex = undefined;
            }
        }
        if (modifier || levelIndex !== undefined) {
            this.refreshHold(event);
        }
    }

    private refreshHold(event: KeyboardEvent) {
        const levelIndex = this.getHeldLevelIndex();
        if (!this.hasRequiredModifiers() || levelIndex === undefined) {
            this.triggered = false;
            this.cancelHold();
            return;
        }

        event.preventDefault();
        if (this.triggered) {
            return;
        }
        if (
            this.holdTimeoutId !== undefined &&
            this.pendingLevelIndex === levelIndex
        ) {
            return;
        }

        this.cancelHold();
        this.pendingLevelIndex = levelIndex;
        this.holdTimeoutId = window.setTimeout(() => {
            this.holdTimeoutId = undefined;
            if (
                this.destroyed ||
                this.triggered ||
                this.pendingLevelIndex === undefined ||
                !this.comboIsHeldFor(this.pendingLevelIndex)
            ) {
                return;
            }
            this.triggered = true;
            this.onLevelSelected(this.pendingLevelIndex);
        }, DEV_LEVEL_HOLD_MS);
    }

    private cancelHold() {
        if (this.holdTimeoutId !== undefined) {
            window.clearTimeout(this.holdTimeoutId);
            this.holdTimeoutId = undefined;
        }
        this.pendingLevelIndex = undefined;
    }

    private getHeldLevelIndex(): number | undefined {
        if (
            this.lastPressedLevelIndex !== undefined &&
            this.heldLevelIndices.has(this.lastPressedLevelIndex)
        ) {
            return this.lastPressedLevelIndex;
        }
        for (const levelIndex of this.heldLevelIndices) {
            return levelIndex;
        }
        return undefined;
    }

    private hasRequiredModifiers(): boolean {
        return DEV_MODIFIER_KEYS.every((key) => this.heldModifiers.has(key));
    }

    private comboIsHeldFor(levelIndex: number): boolean {
        return (
            this.hasRequiredModifiers() && this.heldLevelIndices.has(levelIndex)
        );
    }
}

function modifierFromEvent(event: KeyboardEvent): DevModifierKey | undefined {
    const key = event.key.toLowerCase();
    if (key === "b" || event.code === "KeyB") {
        return "b";
    }
    if (key === "j" || event.code === "KeyJ") {
        return "j";
    }
    if (key === "p" || event.code === "KeyP") {
        return "p";
    }
    return undefined;
}

function levelIndexFromEvent(event: KeyboardEvent): number | undefined {
    const digit = digitFromEvent(event.key, event.code);
    if (digit === undefined) {
        return undefined;
    }
    return isDevLevelIndex(digit) ? digit : undefined;
}

function digitFromEvent(key: string, code: string): number | undefined {
    if (/^[1-9]$/.test(key)) {
        return Number(key);
    }
    if (/^Digit[1-9]$/.test(code)) {
        return Number(code.slice("Digit".length));
    }
    if (/^Numpad[1-9]$/.test(code)) {
        return Number(code.slice("Numpad".length));
    }
    return undefined;
}

import Phaser from "phaser";
import { QueueManager, type QueueEntry } from "../../helpers/queue-manager";

const SPRITE_HEIGHT = 120;
const GAP = 16;
const CARD_W = 100;
const CARD_H = SPRITE_HEIGHT + 10;
const LABEL_HEIGHT = 26;
const SECTION_W = (CARD_W * 3) + (GAP * 2) + 32;
const SECTION_H = CARD_H + LABEL_HEIGHT + 16;

export class QueuePanel extends Phaser.GameObjects.Container {
    private queueManager: QueueManager;
    private cards: Phaser.GameObjects.Container[] = [];
    private portraitByNpcId = new Map<string, Phaser.GameObjects.Image>();
    private cardByNpcId = new Map<string, Phaser.GameObjects.Container>();
    private bubbleByNpcId = new Map<string, Phaser.GameObjects.Container>();
    private onSelect: (entry: QueueEntry) => void;
    readonly panelX: number;
    readonly panelY: number;
    readonly panelH: number;

    constructor(
        scene: Phaser.Scene,
        queueManager: QueueManager,
        onSelect: (entry: QueueEntry) => void,
    ) {
        const panelX = 10;
        const panelY = scene.scale.height - SECTION_H;
        super(scene, panelX, panelY);

        this.queueManager = queueManager;
        this.onSelect = onSelect;
        this.panelX = panelX;
        this.panelY = panelY;
        this.panelH = SECTION_H;

        const sectionBg = scene.add.rectangle(
            0, 0, SECTION_W, SECTION_H,
            0xfafafa, 1,
        ).setOrigin(0, 0);
        sectionBg.setStrokeStyle(2, 0x333333, 1);
        this.add(sectionBg);

        const label = scene.add.text(10, 6, "Waiting Queue", {
            color: "#111",
            fontSize: "15px",
            fontStyle: "bold",
        });
        this.add(label);

        scene.add.existing(this);
        this.setDepth(5);
        this.draw();
    }

    draw() {
        this.bubbleByNpcId.forEach((bubble) => {
            this.scene.tweens.killTweensOf(bubble);
        });
        this.cards.forEach(c => c.destroy());
        this.cards = [];
        this.portraitByNpcId.clear();
        this.cardByNpcId.clear();
        this.bubbleByNpcId.clear();

        const queue = this.queueManager.getQueue();

        queue.forEach((entry, index) => {
            const cardX = 12 + index * (CARD_W + GAP);
            const cardY = LABEL_HEIGHT + 6;
            const card = this.buildCard(entry, cardX, cardY);
            this.cards.push(card);
            this.add(card);
        });
    }

    private buildCard(
        entry: QueueEntry,
        cardX: number,
        cardY: number,
    ): Phaser.GameObjects.Container {
        const card = this.scene.add.container(cardX, cardY);
        const isBoss = entry.isBoss === true;

        const bgColor = isBoss ? 0xfff8e1 : 0xffffff;
        const borderColor = isBoss ? 0xcc3300 : 0x333333;
        const borderWidth = isBoss ? 3 : 1.5;

        const cardBg = this.scene.add.rectangle(
            0, 0, CARD_W, CARD_H,
            bgColor, 1,
        ).setOrigin(0, 0);
        cardBg.setStrokeStyle(borderWidth, borderColor, 1);
        card.add(cardBg);

        const name = this.scene.add.text(
            CARD_W / 2, 5,
            entry.npc.name,
            {
                color: isBoss ? "#cc3300" : "#111",
                fontSize: "11px",
                fontStyle: "bold",
                fontFamily: "monospace",
            },
        ).setOrigin(0.5, 0);
        card.add(name);

        const portrait = this.scene.add.image(
            CARD_W / 2,
            18 + SPRITE_HEIGHT / 2,
            "npc",
        );
        const scaleToFit = Math.min(
            CARD_W / portrait.width,
            SPRITE_HEIGHT / portrait.height,
        );
        portrait.setScale(scaleToFit);
        if (isBoss) {
            portrait.setTint(0xff9944);
        }
        this.portraitByNpcId.set(entry.npc.id, portrait);
        this.cardByNpcId.set(entry.npc.id, card);
        card.add(portrait);

        const idTag = this.scene.add.text(
            CARD_W / 2,
            18 + SPRITE_HEIGHT * 0.72,
            `[${entry.npc.id}]`,
            {
                color: "#111111",
                fontSize: "10px",
                fontStyle: "bold",
                fontFamily: "monospace",
                stroke: "#ffffff",
                strokeThickness: 2,
            },
        ).setOrigin(0.5, 0.5);
        card.add(idTag);

        this.showNpcBubble(
            entry.npc.id,
            card,
            portrait.x + 30,
            portrait.y - 50,
            isBoss,
        );

        const hitArea = this.scene.add
            .rectangle(0, 0, CARD_W, CARD_H, 0x000000, 0)
            .setOrigin(0);
        hitArea.setInteractive({ useHandCursor: true });

        const hoverColor = isBoss ? 0xffe0cc : 0xeef2ff;
        hitArea.on("pointerover", () => cardBg.setFillStyle(hoverColor, 1));
        hitArea.on("pointerout", () => cardBg.setFillStyle(bgColor, 1));
        hitArea.on("pointerup", () => this.onSelect(entry));

        card.add(hitArea);
        return card;
    }

    private showNpcBubble(
        npcId: string,
        card: Phaser.GameObjects.Container,
        x: number,
        y: number,
        isBoss: boolean,
    ): void {
        const bubbleColor = isBoss ? 0xff4400 : 0xffffff;
        const textColor = isBoss ? "#ffffff" : "#222222";
        const strokeColor = isBoss ? 0xcc2200 : 0x222222;
        const bubbleText = isBoss ? "!!!" : "...";

        const bubbleBg = this.scene.add
            .ellipse(x, y, 34, 22, bubbleColor, 0.95)
            .setStrokeStyle(2, strokeColor, 1);
        const bubbleTxt = this.scene.add
            .text(x, y - 1, bubbleText, {
                color: textColor,
                fontSize: "16px",
                fontStyle: "bold",
            })
            .setOrigin(0.5);
        const bubble = this.scene.add.container(0, 0, [bubbleBg, bubbleTxt]);
        card.add(bubble);
        this.bubbleByNpcId.set(npcId, bubble);

        this.scene.tweens.add({
            targets: bubble,
            y: -3,
            duration: isBoss ? 250 : 450,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    flashNpcSuccess(npcId: string, statusCode: string, onComplete?: () => void): void {
        const portrait = this.portraitByNpcId.get(npcId);
        if (!portrait) { onComplete?.(); return; }
        const scene = this.scene;
        this.showStatusCodePop(npcId, statusCode);
        portrait.setTint(0x55ff66);
        scene.time.delayedCall(100, () => {
            portrait.clearTint();
            scene.time.delayedCall(50, () => {
                portrait.setTint(0x44ee55);
                scene.time.delayedCall(100, () => {
                    portrait.clearTint();
                    onComplete?.();
                });
            });
        });
    }

    private showStatusCodePop(npcId: string, statusCode: string): void {
        const card = this.cardByNpcId.get(npcId);
        const portrait = this.portraitByNpcId.get(npcId);
        if (!card || !portrait) return;
        const statusText = this.scene.add
            .text(portrait.x, portrait.y - 8, statusCode, {
                color: "#00a349",
                fontSize: "24px",
                fontStyle: "bold",
                stroke: "#ffffff",
                strokeThickness: 6,
            })
            .setOrigin(0.5)
            .setAlpha(0.95);
        card.add(statusText);
        this.scene.tweens.add({
            targets: statusText,
            y: statusText.y - 26,
            alpha: 0,
            duration: 240,
            ease: "Quad.easeOut",
            onComplete: () => statusText.destroy(),
        });
    }

    flashNpcFailure(npcId: string, onComplete?: () => void): void {
        const portrait = this.portraitByNpcId.get(npcId);
        if (!portrait) { onComplete?.(); return; }
        const scene = this.scene;
        portrait.setTint(0xff4444);
        scene.time.delayedCall(120, () => {
            portrait.clearTint();
            scene.time.delayedCall(60, () => {
                portrait.setTint(0xdd2222);
                scene.time.delayedCall(120, () => {
                    portrait.clearTint();
                    onComplete?.();
                });
            });
        });
    }
}
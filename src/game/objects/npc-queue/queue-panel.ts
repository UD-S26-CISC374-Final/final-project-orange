import Phaser from "phaser";
import { QueueManager, type QueueEntry } from "../../helpers/queue-manager";

const SPRITE_WIDTH = 90;
const SPRITE_HEIGHT = 130;
const GAP = 24;

export class QueuePanel extends Phaser.GameObjects.Container {
    private queueManager: QueueManager;
    private cards: Phaser.GameObjects.Container[] = [];
    private portraitByNpcId = new Map<string, Phaser.GameObjects.Image>();
    private cardByNpcId = new Map<string, Phaser.GameObjects.Container>();
    private bubbleByNpcId = new Map<string, Phaser.GameObjects.Container>();
    private onSelect: (entry: QueueEntry) => void;

    constructor(
        scene: Phaser.Scene,
        queueManager: QueueManager,
        onSelect: (entry: QueueEntry) => void,
    ) {
        super(scene, 16, scene.scale.height - SPRITE_HEIGHT - 70);

        this.queueManager = queueManager;
        this.onSelect = onSelect;

        scene.add.existing(this);
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
            const cardX = index * (SPRITE_WIDTH + GAP);
            const card = this.buildCard(entry, cardX);
            this.cards.push(card);
            this.add(card);
        });
    }

    private buildCard(entry: QueueEntry, cardX: number): Phaser.GameObjects.Container {
        const card = this.scene.add.container(cardX, 0);

        const name = this.scene.add.text(SPRITE_WIDTH / 2, 0, entry.npc.name, {
            color: "#111111",
            fontSize: "12px",
            fontStyle: "bold",
            backgroundColor: "#ffffff",
            padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 1);
        card.add(name);

        const portrait = this.scene.add.image(SPRITE_WIDTH / 2, SPRITE_HEIGHT / 2 + 24, "npc");
        portrait.setDisplaySize(SPRITE_WIDTH, SPRITE_HEIGHT);
        this.portraitByNpcId.set(entry.npc.id, portrait);
        this.cardByNpcId.set(entry.npc.id, card);
        card.add(portrait);

        this.showNpcBubble(entry.npc.id, card, portrait.x + 26, portrait.y - 58);

        const hitArea = this.scene.add
            .rectangle(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT + 20, 0x000000, 0)
            .setOrigin(0);
        hitArea.setInteractive({ useHandCursor: true });

        hitArea.on("pointerup", () => {
            this.onSelect(entry);
        });

        card.add(hitArea);
        return card;
    }

    private showNpcBubble(
        npcId: string,
        card: Phaser.GameObjects.Container,
        x: number,
        y: number,
    ): void {
        const bubbleBg = this.scene.add
            .ellipse(x, y, 34, 22, 0xffffff, 0.95)
            .setStrokeStyle(2, 0x222222, 1);
        const bubbleText = this.scene.add
            .text(x, y - 1, "...", {
                color: "#222222",
                fontSize: "16px",
                fontStyle: "bold",
            })
            .setOrigin(0.5);
        const bubble = this.scene.add.container(0, 0, [bubbleBg, bubbleText]);
        card.add(bubble);
        this.bubbleByNpcId.set(npcId, bubble);

        this.scene.tweens.add({
            targets: bubble,
            y: -3,
            duration: 450,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    /**
     * Brief green tint on the NPC portrait (call before removing them from the queue).
     */
    flashNpcSuccess(npcId: string, statusCode: string, onComplete?: () => void): void {
        const portrait = this.portraitByNpcId.get(npcId);
        if (!portrait) {
            onComplete?.();
            return;
        }
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
        if (!card || !portrait) {
            return;
        }
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
            onComplete: () => {
                statusText.destroy();
            },
        });
    }

    /** Brief red tint when a request submission was rejected. */
    flashNpcFailure(npcId: string, onComplete?: () => void): void {
        const portrait = this.portraitByNpcId.get(npcId);
        if (!portrait) {
            onComplete?.();
            return;
        }
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

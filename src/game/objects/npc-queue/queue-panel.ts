import Phaser from "phaser";
import { QueueManager, type QueueEntry } from "../../helpers/queue-manager";

const SPRITE_WIDTH = 90;
const SPRITE_HEIGHT = 130;
const GAP = 24;

export class QueuePanel extends Phaser.GameObjects.Container {
    private queueManager: QueueManager;
    private cards: Phaser.GameObjects.Container[] = [];
    private portraitByNpcId = new Map<string, Phaser.GameObjects.Image>();
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
        this.cards.forEach(c => c.destroy());
        this.cards = [];
        this.portraitByNpcId.clear();

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
        card.add(portrait);

        const hitArea = this.scene.add
            .rectangle(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT + 20, 0x000000, 0)
            .setOrigin(0);
        hitArea.setInteractive({ useHandCursor: true });

        hitArea.on("pointerover", () => {
            name.setStyle({ color: "#2f6fff" });
            portrait.setAlpha(0.8);
        });

        hitArea.on("pointerout", () => {
            name.setStyle({ color: "#111111" });
            portrait.setAlpha(1);
        });

        hitArea.on("pointerup", () => {
            this.onSelect(entry);
        });

        card.add(hitArea);
        return card;
    }

    /**
     * Brief green tint on the NPC portrait (call before removing them from the queue).
     */
    flashNpcSuccess(npcId: string, onComplete?: () => void): void {
        const portrait = this.portraitByNpcId.get(npcId);
        if (!portrait) {
            onComplete?.();
            return;
        }
        const scene = this.scene;
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

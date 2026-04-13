import Phaser from "phaser";
import { type QueueEntry } from "../../helpers/queue-manager";

export class NPCDialogueModal {
    private readonly scene: Phaser.Scene;
    private readonly container: Phaser.GameObjects.Container;
    private readonly background: Phaser.GameObjects.Rectangle;
    private readonly nameText: Phaser.GameObjects.Text;
    private readonly dialogueText: Phaser.GameObjects.Text;
    private readonly confirmButton: Phaser.GameObjects.Text;
    private readonly closeButton: Phaser.GameObjects.Text;
    private readonly resultText: Phaser.GameObjects.Text;
    private currentEntry?: QueueEntry;
    private onConfirm: (entry: QueueEntry) => boolean;

    constructor(scene: Phaser.Scene, onConfirm: (entry: QueueEntry) => boolean) {
        this.scene = scene;
        this.onConfirm = onConfirm;

        this.background = scene.add.rectangle(0, 0, 560, 280, 0xffffff, 1);
        this.background.setStrokeStyle(3, 0x000000, 1);
        this.background.setOrigin(0.5);

        this.nameText = scene.add.text(-260, -120, "", {
            color: "#111111",
            fontSize: "22px",
            fontStyle: "bold",
        });

        this.closeButton = scene.add
            .text(250, -122, "X", {
                color: "#b00020",
                fontSize: "24px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
            })
            .setInteractive({ useHandCursor: true });
        this.closeButton.on("pointerdown", () => this.hide());

        this.dialogueText = scene.add.text(-260, -70, "", {
            color: "#222222",
            fontSize: "15px",
            fontFamily: "monospace",
            lineSpacing: 6,
            wordWrap: { width: 520 },
        });

        this.resultText = scene.add.text(-260, 80, "", {
            color: "#0b8f08",
            fontSize: "13px",
            fontStyle: "italic",
        });

        this.confirmButton = scene.add
            .text(100, 78, "Done! Check it", {
                color: "#ffffff",
                fontSize: "16px",
                fontStyle: "bold",
                backgroundColor: "#0b8f08",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true });
        this.confirmButton.on("pointerdown", () => this.handleConfirm());

        this.container = scene.add.container(
            scene.scale.width / 2,
            scene.scale.height / 2,
            [
                this.background,
                this.nameText,
                this.closeButton,
                this.dialogueText,
                this.resultText,
                this.confirmButton,
            ],
        );
        this.container.setDepth(1000);
        this.container.setVisible(false);
    }

    show(entry: QueueEntry) {
        this.currentEntry = entry;
        this.resultText.setText("");
        this.nameText.setText(entry.npc.name);
        this.dialogueText.setText(`"${entry.question.dialogue}"`);
        this.container.setVisible(true);
    }

    hide() {
        this.currentEntry = undefined;
        this.container.setVisible(false);
    }

    private handleConfirm() {
        if (!this.currentEntry) return;

        const correct = this.onConfirm(this.currentEntry);

        if (correct) {
            this.resultText.setColor("#0b8f08");
            this.resultText.setText("✓ Correct! Great job.");
            this.scene.time.delayedCall(1000, () => this.hide());
        } else {
            this.resultText.setColor("#b00020");
            this.resultText.setText("✗ Not quite. Check the tables and try again!");
        }
    }
}
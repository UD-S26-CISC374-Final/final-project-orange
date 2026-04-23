import Phaser from "phaser";
import { type QueueEntry } from "../../helpers/queue-manager";

export class NPCDialogueModal {
    private readonly container: Phaser.GameObjects.Container;
    private readonly background: Phaser.GameObjects.Rectangle;
    private readonly nameText: Phaser.GameObjects.Text;
    private readonly dialogueText: Phaser.GameObjects.Text;
    private readonly closeButton: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.background = scene.add.rectangle(0, 0, 560, 260, 0xffffff, 1);
        this.background.setStrokeStyle(3, 0x000000, 1);
        this.background.setOrigin(0.5);

        this.nameText = scene.add.text(-260, -110, "", {
            color: "#111111",
            fontSize: "22px",
            fontStyle: "bold",
        });

        this.closeButton = scene.add
            .text(250, -112, "X", {
                color: "#b00020",
                fontSize: "24px",
                fontStyle: "bold",
                backgroundColor: "#ffffff",
            })
            .setInteractive({ useHandCursor: true });
        this.closeButton.on("pointerdown", () => this.hide());

        this.dialogueText = scene.add.text(-260, -58, "", {
            color: "#222222",
            fontSize: "15px",
            fontFamily: "monospace",
            lineSpacing: 6,
            wordWrap: { width: 520 },
        });

        this.container = scene.add.container(
            scene.scale.width / 2,
            scene.scale.height / 2,
            [
                this.background,
                this.nameText,
                this.closeButton,
                this.dialogueText,
            ],
        );
        this.container.setDepth(1000);
        this.container.setVisible(false);
    }

    show(entry: QueueEntry) {
        this.nameText.setText(entry.npc.name);
        this.dialogueText.setText(`"${entry.question.dialogue}"`);
        this.container.setVisible(true);
    }

    hide() {
        this.container.setVisible(false);
    }

    isVisible(): boolean {
        return this.container.visible;
    }
}

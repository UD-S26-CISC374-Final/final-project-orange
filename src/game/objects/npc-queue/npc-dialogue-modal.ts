import Phaser from "phaser";
import { type QueueEntry } from "../../helpers/queue-manager";

const MODAL_W = 363;
const MODAL_H = 200;
const BASE_DEPTH = 500;
const QUEUE_SECTION_H = 192;

type PointerEventDataWithStopPropagation = Phaser.Types.Input.EventData & {
    stopPropagation: () => void;
};

function stopPointerEventPropagation(event: Phaser.Types.Input.EventData): void {
    const pointerEvent = event as PointerEventDataWithStopPropagation;
    pointerEvent.stopPropagation();
}

export class NPCDialogueModal {
    private readonly outsideClickBlocker: Phaser.GameObjects.Rectangle;
    private readonly container: Phaser.GameObjects.Container;
    private readonly background: Phaser.GameObjects.Rectangle;
    private readonly nameText: Phaser.GameObjects.Text;
    private readonly dialogueText: Phaser.GameObjects.Text;
    private readonly closeButton: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.outsideClickBlocker = scene.add
            .rectangle(
                scene.scale.width / 2,
                scene.scale.height / 2,
                scene.scale.width,
                scene.scale.height,
                0x000000,
                0,
            )
            .setDepth(BASE_DEPTH - 1)
            .setVisible(false)
            .setInteractive({ useHandCursor: false });
        this.outsideClickBlocker.on(
            "pointerdown",
            (
                _pointer: Phaser.Input.Pointer,
                _x: number,
                _y: number,
                event: Phaser.Types.Input.EventData,
            ) => {
                this.hide();
                stopPointerEventPropagation(event);
            },
        );

        this.background = scene.add.rectangle(
            0, 0, MODAL_W, MODAL_H,
            0xfafafa, 1,
        ).setOrigin(0, 0);
        this.background.setStrokeStyle(2, 0x333333, 1);
        this.background
            .setInteractive({ useHandCursor: false })
            .on(
                "pointerdown",
                (
                    _pointer: Phaser.Input.Pointer,
                    _x: number,
                    _y: number,
                    event: Phaser.Types.Input.EventData,
                ) => {
                    stopPointerEventPropagation(event);
                    this.bringToTop();
                },
            );

        this.nameText = scene.add.text(14, 12, "", {
            color: "#111",
            fontSize: "15px",
            fontStyle: "bold",
        });

        this.closeButton = scene.add
            .text(MODAL_W - 14, 10, "✕", {
                color: "#b00020",
                fontSize: "18px",
                fontStyle: "bold",
            })
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true });
        this.closeButton.on("pointerdown", () => this.hide());

        const divider = scene.add.rectangle(
            0, 36, MODAL_W, 1,
            0x333333, 1,
        ).setOrigin(0, 0);

        this.dialogueText = scene.add.text(14, 44, "", {
            color: "#222",
            fontSize: "12px",
            fontFamily: "monospace",
            lineSpacing: 5,
            wordWrap: { width: MODAL_W - 28 },
        });

        this.container = scene.add.container(0, 0, [
            this.background,
            this.nameText,
            this.closeButton,
            divider,
            this.dialogueText,
        ]);

        this.container.setPosition(10, scene.scale.height - QUEUE_SECTION_H - MODAL_H - 8);
        this.container.setDepth(BASE_DEPTH);
        this.container.setVisible(false);
    }

    bringToTop() {
        this.container.setDepth(1000);
        this.outsideClickBlocker.setDepth(999);
    }

    lowerDepth() {
        this.container.setDepth(BASE_DEPTH);
        this.outsideClickBlocker.setDepth(BASE_DEPTH - 1);
    }

    show(entry: QueueEntry) {
        this.nameText.setText(entry.npc.name);
        this.dialogueText.setText(`"${entry.question.dialogue}"`);
        this.outsideClickBlocker.setVisible(true);
        this.container.setVisible(true);
        this.bringToTop();
    }

    hide() {
        this.outsideClickBlocker.setVisible(false);
        this.container.setVisible(false);
    }

    isVisible(): boolean {
        return this.container.visible;
    }
}

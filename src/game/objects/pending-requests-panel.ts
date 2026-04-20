import Phaser from "phaser";
import type { ERDiagram } from "./er-diagram/diagram-handler";

const PANEL_W = 260;
const LINE_H = 26;
const MAX_VISIBLE = 14;

/**
 * Right-side panel: staged GET selections plus POST/PUT/DELETE row edits awaiting Confirm Request.
 */
export class PendingRequestsPanel extends Phaser.GameObjects.Container {
    private readonly erDiagram: ERDiagram;
    private readonly bg: Phaser.GameObjects.Rectangle;
    private readonly title: Phaser.GameObjects.Text;
    private readonly emptyText: Phaser.GameObjects.Text;
    private lineObjects: Phaser.GameObjects.GameObject[] = [];

    constructor(scene: Phaser.Scene, x: number, y: number, erDiagram: ERDiagram) {
        super(scene, x, y);
        this.erDiagram = erDiagram;

        this.bg = scene.add
            .rectangle(0, 0, PANEL_W, 420, 0xfafafa, 1)
            .setStrokeStyle(2, 0x333333, 1)
            .setOrigin(0, 0);

        this.title = scene.add.text(10, 10, "Pending requests", {
            color: "#111",
            fontSize: "15px",
            fontStyle: "bold",
        });

        this.emptyText = scene.add.text(10, 40, "No pending requests.", {
            color: "#666",
            fontSize: "12px",
            fontStyle: "italic",
        });

        this.add([this.bg, this.title, this.emptyText]);
        scene.add.existing(this);
        this.setDepth(11);
        this.refresh();
    }

    refresh(): void {
        for (const o of this.lineObjects) {
            o.destroy();
        }
        this.lineObjects = [];

        const pending = this.erDiagram.getPendingRequests();

        if (pending.length === 0) {
            this.emptyText.setVisible(true);
            this.bg.setSize(PANEL_W, 72);
            return;
        }

        this.emptyText.setVisible(false);
        const count = Math.min(pending.length, MAX_VISIBLE);
        let y = 38;

        for (let i = 0; i < count; i += 1) {
            const item = pending[i];
            const label = item.summary;
            const txt = this.scene.add.text(10, y, label, {
                color: "#222",
                fontSize: "11px",
                fontFamily: "monospace",
                wordWrap: { width: PANEL_W - 70 },
            });
            txt.setOrigin(0, 0);

            const undoBtn = this.scene.add
                .text(PANEL_W - 58, y, "Undo", {
                    color: "#ffffff",
                    fontSize: "11px",
                    fontStyle: "bold",
                    backgroundColor: "#555555",
                    padding: { left: 6, right: 6, top: 2, bottom: 2 },
                })
                .setInteractive({ useHandCursor: true });

            const captured = item;
            undoBtn.on("pointerdown", () => {
                this.erDiagram.undoPendingRequest(captured.id);
            });

            this.add(txt);
            this.add(undoBtn);
            this.lineObjects.push(txt, undoBtn);
            y += LINE_H;
        }

        if (pending.length > MAX_VISIBLE) {
            const more = this.scene.add.text(
                10,
                y,
                `+ ${pending.length - MAX_VISIBLE} more…`,
                {
                    color: "#888",
                    fontSize: "10px",
                },
            );
            this.add(more);
            this.lineObjects.push(more);
            y += 18;
        }

        const h = Math.min(420, Math.max(72, y + 16));
        this.bg.setSize(PANEL_W, h);
    }
}

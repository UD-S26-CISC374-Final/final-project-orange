import { GameObjects, Scene } from "phaser";

import { EventBus } from "../event-bus";
import type { ChangeableScene } from "../reactable-scene";
import { DataLoader } from "../helpers/dataloader";
import { DevLevelShortcut } from "../helpers/dev-level-shortcut";

export class MainMenu extends Scene implements ChangeableScene {
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    startPrompt?: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;
    private enterStartHandler?: (event: KeyboardEvent) => void;
    private startTriggered = false;

    constructor() {
        super("MainMenu");
    }

    create() {
        const grid = new DataLoader(this);
        grid.buildGrid(this.scale.width, this.scale.height);

        this.logo = this.add
            .image(this.scale.width / 2, this.scale.height * 0.38, "logo")
            .setDepth(100);
        const maxLogoWidth = this.scale.width * 0.78;
        const maxLogoHeight = this.scale.height * 0.9;
        const logoScale = Math.min(
            maxLogoWidth / this.logo.width,
            maxLogoHeight / this.logo.height,
        );
        this.logo.setScale(logoScale);

        this.startPrompt = this.add
            .text(
                this.scale.width / 2,
                this.scale.height * 0.78,
                "Press Enter to Start",
                {
                    fontFamily: "Arial Black",
                    fontSize: "34px",
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 7,
                    align: "center",
                },
            )
            .setOrigin(0.5)
            .setDepth(100);

        this.tweens.add({
            targets: this.startPrompt,
            alpha: 0.35,
            duration: 700,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        if (this.input.keyboard) {
            this.enterStartHandler = (event: KeyboardEvent) => {
                if (event.defaultPrevented) {
                    return;
                }
                if (event.repeat) {
                    return;
                }
                const isEnterKey =
                    event.key === "Enter" || event.code === "NumpadEnter";
                if (!isEnterKey) {
                    return;
                }
                event.preventDefault();
                this.changeScene();
            };
            this.input.keyboard.on("keydown", this.enterStartHandler);
        }
        new DevLevelShortcut(this, (levelIndex) =>
            this.startMainGame(levelIndex),
        );
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (this.input.keyboard && this.enterStartHandler) {
                this.input.keyboard.off("keydown", this.enterStartHandler);
            }
            this.enterStartHandler = undefined;
        });

        // this.title = this.add
        //     .text(512, 460, "RushAPI Start Screen", {
        //         fontFamily: "Arial Black",
        //         fontSize: 38,
        //         color: "#ffffff",
        //         stroke: "#000000",
        //         strokeThickness: 8,
        //         align: "center",
        //     })
        //     .setOrigin(0.5)
        //     .setDepth(100);

        EventBus.emit("current-scene-ready", this);
    }

    changeScene() {
        this.startMainGame();
    }

    private startMainGame(levelIndex?: number) {
        if (this.startTriggered) {
            return;
        }
        this.startTriggered = true;
        if (this.logoTween) {
            this.logoTween.stop();
            this.logoTween = null;
        }

        const data =
            levelIndex === undefined ? undefined : (
                { startLevelIndex: levelIndex }
            );
        this.scene.start("MainGame", data);
    }

    moveSprite(callback: ({ x, y }: { x: number; y: number }) => void) {
        if (this.logoTween) {
            if (this.logoTween.isPlaying()) {
                this.logoTween.pause();
            } else {
                this.logoTween.play();
            }
        } else {
            this.logoTween = this.tweens.add({
                targets: this.logo,
                x: { value: 750, duration: 3000, ease: "Back.easeInOut" },
                y: { value: 80, duration: 1500, ease: "Sine.easeOut" },
                yoyo: true,
                repeat: -1,
                onUpdate: () => {
                    callback({
                        x: Math.floor(this.logo.x),
                        y: Math.floor(this.logo.y),
                    });
                },
            });
        }
    }
}

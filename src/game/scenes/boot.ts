import { Scene } from "phaser";

/**
 * The Boot scene is responsible for loading the assets required for the Preloader scene.
 * It is the first scene to be run in the game.
 * Try to keep its asset list to a minimum to ensure a fast load time.
 *
 * Think of it as the "loader for the loader".
 */
export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        const baseUrl = import.meta.env.BASE_URL;
        this.load.image("background", `${baseUrl}assets/bg.png`);
    }

    create() {
        this.scene.start("Preloader");
    }
}

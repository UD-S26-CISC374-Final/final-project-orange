import { Boot } from "./scenes/boot";
import { GameOver } from "./scenes/game-over";
import { MainGame } from "./scenes/game";
import { MainMenu } from "./scenes/main-menu";
import { AUTO, Game } from "phaser";
import { Preloader } from "./scenes/preloader";

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    title: "My Untitled CISC374 Game",
    version: "0.0.1",
    type: AUTO,
    parent: "game-container",
    backgroundColor: "#ffffff",
    scene: [Boot, Preloader, MainMenu, MainGame, GameOver],
    scale: {
        parent: "phaser-game",
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1024,
        height: 768,
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: false,
            gravity: { x: 0, y: 300 },
        },
    },
    input: {
        keyboard: true,
        mouse: true,
        touch: true,
        gamepad: false,
    },
    render: {
        pixelArt: false,
        antialias: true,
    },
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;

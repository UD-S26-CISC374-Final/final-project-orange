import type { Scene } from "phaser";

const BGM_KEY = "bgm";
const POP_KEY = "request-success";
const SAW_KEY = "request-failure";
const START_KEY = "rush-start";
const GAMEPLAY_MUSIC_UNLOCKED_KEY = "gameplay-music-unlocked";

export function hasUnlockedGameplayMusic(scene: Scene): boolean {
    return scene.registry.get(GAMEPLAY_MUSIC_UNLOCKED_KEY) === true;
}

export function ensureGameplayMusic(scene: Scene) {
    const existingMusic = scene.sound.get(BGM_KEY) as Phaser.Sound.BaseSound | null;

    if (existingMusic) {
        if (existingMusic.isPaused) {
            existingMusic.resume();
        } else if (!existingMusic.isPlaying) {
            existingMusic.play();
        }
        return;
    }

    const music = scene.sound.add(BGM_KEY, {
        loop: true,
        volume: 0.16,
    });
    music.play();
}

export function unlockGameplayMusic(scene: Scene) {
    scene.registry.set(GAMEPLAY_MUSIC_UNLOCKED_KEY, true);
    ensureGameplayMusic(scene);
}

export function playRequestSuccessSound(scene: Scene) {
    scene.sound.play(POP_KEY, { volume: 0.95 });
}

export function playRequestFailureSound(scene: Scene) {
    scene.sound.play(SAW_KEY, { volume: 0.9 });
}

export function playRushStartSound(scene: Scene) {
    scene.sound.play(START_KEY, { volume: 0.75 });
}

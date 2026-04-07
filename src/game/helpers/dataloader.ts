export class DataLoader extends Phaser.GameObjects.Graphics {
    constructor(scene: Phaser.Scene) {
        super(scene);
        scene.add.existing(this);
    }

    buildGrid(
        width: number,
        height: number,
        gridSize = 32,
        backgroundColor = 0xffffff,
        lineColor = 0x2f6fff,
    ) {
        this.clear();
        this.fillStyle(backgroundColor, 1);
        this.fillRect(0, 0, width, height);
        this.lineStyle(1, lineColor, 1);

        for (let x = 0; x <= width; x += gridSize) {
            this.moveTo(x, 0);
            this.lineTo(x, height);
        }

        for (let y = 0; y <= height; y += gridSize) {
            this.moveTo(0, y);
            this.lineTo(width, y);
        }

        this.strokePath();
        return this;
    }

    // load static game components in the scene
    loadGameComponents(scene: Phaser.Scene) {
        const { width, height } = scene.scale;
        const inventoryWidth = Math.floor(width * 0.5);
        const inventoryHeight = 120;
        const hiddenBottomPx = 24;
        const cornerRadius = 18;
        const inventoryX = (width - inventoryWidth) / 2 + 100;
        const inventoryY = height - inventoryHeight + hiddenBottomPx;

        const inventory = scene.add.graphics();
        inventory.fillStyle(0xffffff, 1);
        inventory.lineStyle(3, 0x000000, 1);
        inventory.fillRoundedRect(
            inventoryX,
            inventoryY,
            inventoryWidth,
            inventoryHeight,
            cornerRadius,
        );
        inventory.strokeRoundedRect(
            inventoryX,
            inventoryY,
            inventoryWidth,
            inventoryHeight,
            cornerRadius,
        );

        return inventory;
    }
}

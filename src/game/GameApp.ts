import { Engine, Scene, Vector3, HemisphericLight, DirectionalLight, ShadowGenerator, Color3, Color4, FreeCamera, Sound } from "babylonjs";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, Ellipse } from "babylonjs-gui";
import { Player } from "./Player";
import { Environment } from "./Environment";
import { ZombieManager } from "./ZombieManager";

export class GameApp {
    private engine: Engine;
    private scene: Scene;
    private player: Player;
    private environment: Environment;
    private zombieManager: ZombieManager;
    private ui: AdvancedDynamicTexture;
    private healthLabel: TextBlock;
    private scoreLabel: TextBlock;
    private ammoLabel: TextBlock;
    private gameOverLabel: TextBlock;
    private isGameOver: boolean = false;
    private score: number = 0;
    public shadowGenerator: ShadowGenerator;
    private resizeHandler: () => void;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, true);
        this.scene = this.createScene();
        this.ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        
        this.setupUI();

        // Game components
        this.environment = new Environment(this.scene, this.shadowGenerator);
        this.player = new Player(this.scene, canvas, this.environment, this.shadowGenerator);
        this.zombieManager = new ZombieManager(this.scene, this.player, this.environment, this.shadowGenerator);

        // Game Loop
        this.engine.runRenderLoop(() => {
            if (!this.isGameOver) {
                this.update();
                this.scene.render();
            }
        });

        this.resizeHandler = () => {
            this.engine.resize();
        };
        window.addEventListener("resize", this.resizeHandler);
    }

    private createScene(): Scene {
        const scene = new Scene(this.engine);
        scene.clearColor = new Color4(0.1, 0.1, 0.15, 1); // Dark atmospheric background
        scene.fogMode = Scene.FOGMODE_EXP2;
        scene.fogDensity = 0.02;
        scene.fogColor = new Color3(0.1, 0.1, 0.15);

        // Ambient light
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.3;
        hemiLight.groundColor = new Color3(0.1, 0.1, 0.1);

        // Directional light for shadows (Moonlight/Sunlight)
        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene);
        dirLight.position = new Vector3(20, 40, 20);
        dirLight.intensity = 0.7;

        // Shadows
        this.shadowGenerator = new ShadowGenerator(1024, dirLight);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;

        // Enable physics/collisions
        scene.collisionsEnabled = true;
        scene.gravity = new Vector3(0, -9.81, 0);

        return scene;
    }

    private setupUI() {
        // Crosshair
        const crosshair = new Ellipse();
        crosshair.width = "10px";
        crosshair.height = "10px";
        crosshair.color = "white";
        crosshair.thickness = 2;
        crosshair.background = "transparent";
        this.ui.addControl(crosshair);

        const dot = new Ellipse();
        dot.width = "2px";
        dot.height = "2px";
        dot.background = "white";
        this.ui.addControl(dot);

        // Health
        this.healthLabel = new TextBlock();
        this.healthLabel.text = "Health: 100";
        this.healthLabel.color = "white";
        this.healthLabel.fontSize = 24;
        this.healthLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.healthLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.healthLabel.paddingLeft = "20px";
        this.healthLabel.paddingTop = "20px";
        this.ui.addControl(this.healthLabel);

        // Ammo
        this.ammoLabel = new TextBlock();
        this.ammoLabel.text = "Ammo: 20";
        this.ammoLabel.color = "white";
        this.ammoLabel.fontSize = 24;
        this.ammoLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.ammoLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.ammoLabel.paddingRight = "20px";
        this.ammoLabel.paddingTop = "20px";
        this.ui.addControl(this.ammoLabel);

        // Score
        this.scoreLabel = new TextBlock();
        this.scoreLabel.text = "Kills: 0";
        this.scoreLabel.color = "yellow";
        this.scoreLabel.fontSize = 24;
        this.scoreLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.scoreLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.scoreLabel.paddingTop = "20px";
        this.ui.addControl(this.scoreLabel);

        // Game Over
        this.gameOverLabel = new TextBlock();
        this.gameOverLabel.text = "GAME OVER\nClick to Restart";
        this.gameOverLabel.color = "red";
        this.gameOverLabel.fontSize = 48;
        this.gameOverLabel.isVisible = false;
        this.ui.addControl(this.gameOverLabel);
    }

    private update() {
        const dt = this.engine.getDeltaTime() / 1000;

        this.player.update(dt);
        this.zombieManager.update(dt);

        // Check collisions between bullets and zombies
        const bullets = this.player.getBullets();
        const zombies = this.zombieManager.getZombies();

        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (bullet.isDead) continue;

            const ray = bullet.getRay();
            let hitZombie = false;

            // Check zombie collisions with Ray
            for (let j = zombies.length - 1; j >= 0; j--) {
                const zombie = zombies[j];
                const pickInfo = ray.intersectsMesh(zombie.mesh);
                if (pickInfo.hit) {
                    // Hit!
                    zombie.takeDamage(1);
                    hitZombie = true;
                    if (zombie.isDead()) {
                        this.score++;
                        this.scoreLabel.text = `Kills: ${this.score}`;
                    }
                    break; 
                }
            }

            if (hitZombie) {
                bullet.isDead = true;
                bullet.dispose();
                // We don't splice here because Player.updateBullets handles removal based on isDead flag
                // Actually Player.updateBullets is called BEFORE this update loop in GameApp.update()
                // So we should remove it manually or mark it dead for next frame.
                // Let's just splice it here to be safe and immediate.
                bullets.splice(i, 1);
            } else {
                // Check environment collision with Ray
                let hitEnv = false;
                
                // Ground
                const groundPick = ray.intersectsMesh(this.environment.ground);
                if (groundPick.hit) hitEnv = true;

                // Obstacles
                if (!hitEnv) {
                    for (const obstacle of this.environment.obstacles) {
                        if (ray.intersectsMesh(obstacle).hit) {
                            hitEnv = true;
                            break;
                        }
                    }
                }

                if (hitEnv) {
                    bullet.isDead = true;
                    bullet.dispose();
                    bullets.splice(i, 1);
                }
            }
        }

        // Check collisions between zombies and player
        for (const zombie of zombies) {
            if (!zombie.isDead() && zombie.mesh.intersectsMesh(this.player.mesh, true)) {
                if (this.player.takeDamage(10 * dt)) { // Damage over time if touching
                     this.gameOver();
                }
            }
        }

        // Check health packs
        const packs = this.environment.healthPacks;
        for (let i = packs.length - 1; i >= 0; i--) {
            if (this.player.mesh.intersectsMesh(packs[i], false)) {
                this.player.health = Math.min(100, this.player.health + 25);
                packs[i].dispose();
                packs.splice(i, 1);
            }
        }

        // Check ammo packs
        const ammoPacks = this.environment.ammoPacks;
        for (let i = ammoPacks.length - 1; i >= 0; i--) {
            if (this.player.mesh.intersectsMesh(ammoPacks[i], false)) {
                this.player.addAmmo(20);
                ammoPacks[i].dispose();
                ammoPacks.splice(i, 1);
            }
        }

        this.healthLabel.text = `Health: ${Math.ceil(this.player.health)}`;
        this.ammoLabel.text = `Ammo: ${this.player.currentAmmo} / ${this.player.reserveAmmo}`;
    }

    private gameOver() {
        this.isGameOver = true;
        this.gameOverLabel.isVisible = true;
        this.engine.stopRenderLoop();
        
        // Simple restart on click
        window.addEventListener("click", () => {
            window.location.reload();
        }, { once: true });
    }

    public dispose() {
        this.engine.dispose();
        this.player.dispose();
        window.removeEventListener("resize", this.resizeHandler);
    }
}

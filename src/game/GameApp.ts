import { Engine, Scene, Vector3, HemisphericLight, DirectionalLight, ShadowGenerator, Color3, Color4, FreeCamera, Sound } from "babylonjs";
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control, Ellipse, Button, StackPanel } from "babylonjs-gui";
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
    private pauseMenu: Rectangle;
    private isGameOver: boolean = false;
    private isPaused: boolean = false;
    private score: number = 0;
    public shadowGenerator: ShadowGenerator;
    private resizeHandler: () => void;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, true);
        this.scene = this.createScene();
        this.ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        
        this.setupUI();
        this.setupPauseMenu();

        // Game components
        this.environment = new Environment(this.scene, this.shadowGenerator);
        this.player = new Player(this.scene, canvas, this.environment, this.shadowGenerator);
        this.zombieManager = new ZombieManager(this.scene, this.player, this.environment, this.shadowGenerator);

        // Game Loop
        this.engine.runRenderLoop(() => {
            if (!this.isGameOver && !this.isPaused) {
                this.update();
                this.scene.render();
            } else if (this.isPaused) {
                this.scene.render(); // Still render scene when paused, just don't update logic
            }
        });

        this.resizeHandler = () => {
            this.engine.resize();
        };
        window.addEventListener("resize", this.resizeHandler);

        // Pause input
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "p") {
                this.togglePause();
            }
        });
    }

    private togglePause() {
        if (this.isGameOver) return;
        
        this.isPaused = !this.isPaused;
        this.pauseMenu.isVisible = this.isPaused;
        
        if (this.isPaused) {
            document.exitPointerLock();
        } else {
            // Resume pointer lock if clicking back into game
             this.scene.getEngine().getRenderingCanvas()?.requestPointerLock();
        }
    }

    private setupPauseMenu() {
        this.pauseMenu = new Rectangle();
        this.pauseMenu.width = "400px";
        this.pauseMenu.height = "300px";
        this.pauseMenu.background = "rgba(0, 0, 0, 0.8)";
        this.pauseMenu.cornerRadius = 20;
        this.pauseMenu.thickness = 0;
        this.pauseMenu.isVisible = false;
        this.ui.addControl(this.pauseMenu);

        const panel = new StackPanel();
        this.pauseMenu.addControl(panel);

        const title = new TextBlock();
        title.text = "PAUSED";
        title.color = "white";
        title.fontSize = 30;
        title.height = "60px";
        panel.addControl(title);

        // Camera Toggle
        const cameraBtn = Button.CreateSimpleButton("cameraBtn", "Camera: Right");
        cameraBtn.width = "200px";
        cameraBtn.height = "40px";
        cameraBtn.color = "white";
        cameraBtn.background = "#444444";
        cameraBtn.paddingBottom = "10px";
        cameraBtn.onPointerUpObservable.add(() => {
            if (cameraBtn.children[0] instanceof TextBlock) {
                const text = cameraBtn.children[0] as TextBlock;
                if (text.text === "Camera: Right") {
                    text.text = "Camera: Left";
                    this.player.setCameraSide('left');
                } else {
                    text.text = "Camera: Right";
                    this.player.setCameraSide('right');
                }
            }
        });
        panel.addControl(cameraBtn);

        // Resume
        const resumeBtn = Button.CreateSimpleButton("resumeBtn", "Resume");
        resumeBtn.width = "200px";
        resumeBtn.height = "40px";
        resumeBtn.color = "white";
        resumeBtn.background = "green";
        resumeBtn.paddingBottom = "10px";
        resumeBtn.onPointerUpObservable.add(() => {
            this.togglePause();
        });
        panel.addControl(resumeBtn);

        // Exit
        const exitBtn = Button.CreateSimpleButton("exitBtn", "Exit Game");
        exitBtn.width = "200px";
        exitBtn.height = "40px";
        exitBtn.color = "white";
        exitBtn.background = "red";
        exitBtn.onPointerUpObservable.add(() => {
            window.location.reload(); // Simple exit for now
        });
        panel.addControl(exitBtn);
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

        // Mobile Controls
        if (this.isMobile()) {
            this.setupMobileControls();
        }
    }

    private isMobile(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    private setupMobileControls() {
        // Left Stick (Movement)
        const leftStickContainer = new Ellipse();
        leftStickContainer.width = "150px";
        leftStickContainer.height = "150px";
        leftStickContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        leftStickContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        leftStickContainer.left = "50px";
        leftStickContainer.top = "-50px";
        leftStickContainer.color = "white";
        leftStickContainer.thickness = 2;
        leftStickContainer.background = "rgba(0,0,0,0.2)";
        leftStickContainer.isPointerBlocker = true;
        this.ui.addControl(leftStickContainer);

        const leftPuck = new Ellipse();
        leftPuck.width = "50px";
        leftPuck.height = "50px";
        leftPuck.color = "white";
        leftPuck.thickness = 0;
        leftPuck.background = "white";
        leftStickContainer.addControl(leftPuck);

        let leftPointerDown = false;
        let leftPointerId = -1;

        leftStickContainer.onPointerDownObservable.add((coordinates) => {
            leftPointerDown = true;
            leftPointerId = coordinates.pointerId;
            leftPuck.background = "gray";
        });

        leftStickContainer.onPointerUpObservable.add((coordinates) => {
            if (coordinates.pointerId === leftPointerId) {
                leftPointerDown = false;
                leftPuck.left = 0;
                leftPuck.top = 0;
                leftPuck.background = "white";
                this.player.setVirtualInput("w", false);
                this.player.setVirtualInput("s", false);
                this.player.setVirtualInput("a", false);
                this.player.setVirtualInput("d", false);
            }
        });

        leftStickContainer.onPointerMoveObservable.add((coordinates) => {
            if (leftPointerDown) {
                // Calculate delta from center
                const centerX = leftStickContainer.centerX;
                const centerY = leftStickContainer.centerY;
                
                // Coordinates are relative to the control if we use local coordinates, 
                // but onPointerMove gives global coordinates usually.
                // Let's use the coordinates relative to the center of the container.
                // Actually, coordinates.x and y are global.
                
                let deltaX = coordinates.x - centerX;
                let deltaY = coordinates.y - centerY;

                // Clamp to radius
                const radius = 75; // Half of 150
                const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (dist > radius) {
                    deltaX = (deltaX / dist) * radius;
                    deltaY = (deltaY / dist) * radius;
                }

                leftPuck.left = deltaX + "px";
                leftPuck.top = deltaY + "px";

                // Map to inputs
                // Y is inverted (up is negative)
                this.player.setVirtualInput("w", deltaY < -20);
                this.player.setVirtualInput("s", deltaY > 20);
                this.player.setVirtualInput("a", deltaX < -20);
                this.player.setVirtualInput("d", deltaX > 20);
            }
        });

        // Right Stick (Look)
        const rightStickContainer = new Ellipse();
        rightStickContainer.width = "150px";
        rightStickContainer.height = "150px";
        rightStickContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        rightStickContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        rightStickContainer.left = "-50px";
        rightStickContainer.top = "-50px";
        rightStickContainer.color = "white";
        rightStickContainer.thickness = 2;
        rightStickContainer.background = "rgba(0,0,0,0.2)";
        rightStickContainer.isPointerBlocker = true;
        this.ui.addControl(rightStickContainer);

        const rightPuck = new Ellipse();
        rightPuck.width = "50px";
        rightPuck.height = "50px";
        rightPuck.color = "white";
        rightPuck.thickness = 0;
        rightPuck.background = "white";
        rightStickContainer.addControl(rightPuck);

        let rightPointerDown = false;
        let rightPointerId = -1;

        rightStickContainer.onPointerDownObservable.add((coordinates) => {
            rightPointerDown = true;
            rightPointerId = coordinates.pointerId;
            rightPuck.background = "gray";
        });

        rightStickContainer.onPointerUpObservable.add((coordinates) => {
            if (coordinates.pointerId === rightPointerId) {
                rightPointerDown = false;
                rightPuck.left = 0;
                rightPuck.top = 0;
                rightPuck.background = "white";
            }
        });

        rightStickContainer.onPointerMoveObservable.add((coordinates) => {
            if (rightPointerDown) {
                const centerX = rightStickContainer.centerX;
                const centerY = rightStickContainer.centerY;
                
                let deltaX = coordinates.x - centerX;
                let deltaY = coordinates.y - centerY;

                const radius = 75;
                const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (dist > radius) {
                    deltaX = (deltaX / dist) * radius;
                    deltaY = (deltaY / dist) * radius;
                }

                rightPuck.left = deltaX + "px";
                rightPuck.top = deltaY + "px";

                // Look sensitivity
                this.player.handleVirtualLook(deltaX * 0.1, deltaY * 0.1);
            }
        });

        // Action Buttons
        const shootBtn = Button.CreateSimpleButton("shootBtn", "SHOOT");
        shootBtn.width = "80px";
        shootBtn.height = "80px";
        shootBtn.cornerRadius = 40;
        shootBtn.color = "white";
        shootBtn.background = "rgba(255, 0, 0, 0.5)";
        shootBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        shootBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        shootBtn.left = "-220px";
        shootBtn.top = "-80px";
        shootBtn.onPointerDownObservable.add(() => {
            this.player.setVirtualInput("mouseLeft", true);
        });
        shootBtn.onPointerUpObservable.add(() => {
            this.player.setVirtualInput("mouseLeft", false);
        });
        this.ui.addControl(shootBtn);

        const jumpBtn = Button.CreateSimpleButton("jumpBtn", "JUMP");
        jumpBtn.width = "80px";
        jumpBtn.height = "80px";
        jumpBtn.cornerRadius = 40;
        jumpBtn.color = "white";
        jumpBtn.background = "rgba(0, 255, 0, 0.5)";
        jumpBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        jumpBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        jumpBtn.left = "-220px";
        jumpBtn.top = "-180px";
        jumpBtn.onPointerDownObservable.add(() => {
            this.player.setVirtualInput(" ", true); // Space
        });
        jumpBtn.onPointerUpObservable.add(() => {
            this.player.setVirtualInput(" ", false);
        });
        this.ui.addControl(jumpBtn);

        const reloadBtn = Button.CreateSimpleButton("reloadBtn", "R");
        reloadBtn.width = "60px";
        reloadBtn.height = "60px";
        reloadBtn.cornerRadius = 30;
        reloadBtn.color = "white";
        reloadBtn.background = "rgba(0, 0, 255, 0.5)";
        reloadBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        reloadBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        reloadBtn.left = "-320px";
        reloadBtn.top = "-80px";
        reloadBtn.onPointerClickObservable.add(() => {
            this.player.setVirtualInput("r", true);
            setTimeout(() => this.player.setVirtualInput("r", false), 100);
        });
        this.ui.addControl(reloadBtn);

        // Sprint Button (Hold)
        const sprintBtn = Button.CreateSimpleButton("sprintBtn", "RUN");
        sprintBtn.width = "80px";
        sprintBtn.height = "80px";
        sprintBtn.cornerRadius = 40;
        sprintBtn.color = "white";
        sprintBtn.background = "rgba(255, 165, 0, 0.5)"; // Orange
        sprintBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        sprintBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        sprintBtn.left = "220px";
        sprintBtn.top = "-80px";
        sprintBtn.onPointerDownObservable.add(() => {
            this.player.setVirtualInput("shift", true);
        });
        sprintBtn.onPointerUpObservable.add(() => {
            this.player.setVirtualInput("shift", false);
        });
        this.ui.addControl(sprintBtn);

        // Pause Button
        const pauseBtn = Button.CreateSimpleButton("pauseBtn", "||");
        pauseBtn.width = "50px";
        pauseBtn.height = "50px";
        pauseBtn.cornerRadius = 10;
        pauseBtn.color = "white";
        pauseBtn.background = "rgba(0, 0, 0, 0.5)";
        pauseBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        pauseBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        pauseBtn.left = "-20px";
        pauseBtn.top = "20px";
        pauseBtn.onPointerClickObservable.add(() => {
            this.togglePause();
        });
        this.ui.addControl(pauseBtn);
    }

    private update() {
        const dt = this.engine.getDeltaTime() / 1000;

        this.player.update(dt);
        this.environment.update(this.player.mesh.position);
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
                bullets.splice(i, 1);
            } else {
                // Check environment collision with Ray
                let hitEnv = false;
                
                // Ground
                const groundMeshes = this.environment.getGroundMeshes();
                for (const ground of groundMeshes) {
                    if (ray.intersectsMesh(ground).hit) {
                        hitEnv = true;
                        break;
                    }
                }

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

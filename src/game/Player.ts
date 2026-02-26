import { Scene, MeshBuilder, Vector3, UniversalCamera, Mesh, StandardMaterial, Color3, Ray, Matrix, TransformNode, PointerEventTypes, ShadowGenerator, ParticleSystem, Texture, Color4 } from "babylonjs";
import { Environment } from "./Environment";

export class Bullet {
    public mesh: Mesh;
    private velocity: Vector3;
    private speed: number = 200;
    private lifeTime: number = 2; // seconds
    public isDead: boolean = false;
    public previousPosition: Vector3;

    constructor(scene: Scene, position: Vector3, direction: Vector3) {
        this.mesh = MeshBuilder.CreateSphere("bullet", { diameter: 0.2 }, scene);
        this.mesh.position = position.clone();
        this.previousPosition = position.clone();
        
        const mat = new StandardMaterial("bulletMat", scene);
        mat.emissiveColor = new Color3(1, 0.8, 0);
        this.mesh.material = mat;

        this.velocity = direction.normalize().scale(this.speed);
    }

    update(dt: number): boolean {
        if (this.isDead) return true;

        this.previousPosition.copyFrom(this.mesh.position);
        this.mesh.position.addInPlace(this.velocity.scale(dt));
        this.lifeTime -= dt;
        
        if (this.lifeTime <= 0) {
            this.isDead = true;
            return true;
        }
        return false;
    }

    getRay(): Ray {
        const rayDirection = this.mesh.position.subtract(this.previousPosition);
        const rayLength = rayDirection.length();
        // Ensure length is at least something small to avoid errors
        return new Ray(this.previousPosition, rayDirection.normalize(), Math.max(0.001, rayLength));
    }

    dispose() {
        this.mesh.dispose();
    }
}

export class Player {
    private scene: Scene;
    private canvas: HTMLCanvasElement;
    public mesh: Mesh;
    private visualMesh: Mesh;
    private camera: UniversalCamera;
    private cameraRoot: TransformNode;
    private shadowGenerator: ShadowGenerator;
    private gunMesh: Mesh;
    private muzzleSystem: ParticleSystem;
    
    // Stats
    public health: number = 100;
    public currentAmmo: number = 20;
    public reserveAmmo: number = 60;
    public maxMagAmmo: number = 20;
    private lastShotTime: number = 0;
    private fireRate: number = 0.15;
    private isReloading: boolean = false;

    // Movement
    private speed: number = 10;
    private jumpForce: number = 0.8;
    private verticalVelocity: number = 0;
    private isGrounded: boolean = false;
    private inputMap: any = {};
    private clickHandler: () => void;
    
    private bullets: Bullet[] = [];
    private environment: Environment;

    constructor(scene: Scene, canvas: HTMLCanvasElement, environment: Environment, shadowGenerator: ShadowGenerator) {
        this.scene = scene;
        this.canvas = canvas;
        this.environment = environment;
        this.shadowGenerator = shadowGenerator;

        this.createPlayerMesh();
        this.setupCamera();
        this.createGun();
        this.setupInputs();
    }

    private createPlayerMesh() {
        // Create a root mesh for physics/collision (invisible)
        // Use a Box instead of Capsule to ensure a flat base logic (though moveWithCollisions uses ellipsoid)
        // We will treat this.mesh.position as the CENTER of the player.
        this.mesh = MeshBuilder.CreateBox("playerCollider", { width: 1, height: 2, depth: 1 }, this.scene);
        this.mesh.isVisible = false; 
        this.mesh.checkCollisions = true;
        
        // Ellipsoid centered on the mesh
        this.mesh.ellipsoid = new Vector3(0.5, 1, 0.5);
        this.mesh.ellipsoidOffset = Vector3.Zero(); // No offset, mesh position is center
        
        this.mesh.position.y = 10; // Start high

        // Visual Mesh (Child)
        this.visualMesh = MeshBuilder.CreateCapsule("playerVisual", { radius: 0.5, height: 2 }, this.scene);
        this.visualMesh.parent = this.mesh;
        this.visualMesh.position = Vector3.Zero(); // Centered on parent
        this.visualMesh.checkCollisions = false; // Important: Don't collide with self
        
        const mat = new StandardMaterial("playerMat", this.scene);
        mat.diffuseColor = new Color3(0.2, 0.6, 1);
        this.visualMesh.material = mat;
        
        this.shadowGenerator.addShadowCaster(this.visualMesh);
    }

    private setupCamera() {
        // Create a transform node to act as the camera pivot/target
        this.cameraRoot = new TransformNode("cameraRoot", this.scene);
        this.cameraRoot.parent = this.mesh;
        // Eye level relative to center (0,0,0) of player (which is at 1m height)
        // Total height is 2m. Eyes are near top.
        // So 0.6m up from center = 1.6m from ground.
        this.cameraRoot.position = new Vector3(0, 0.6, 0); 

        this.camera = new UniversalCamera("TPCamera", new Vector3(0, 0, -6), this.scene);
        this.camera.parent = this.cameraRoot;
        // Remove lockedTarget to prevent drift/fighting with parent rotation
        // this.camera.lockedTarget = this.cameraRoot; 
        
        // Ensure camera is rigidly attached and looking forward
        this.camera.rotation = Vector3.Zero();
        this.camera.inertia = 0;
        
        this.scene.activeCamera = this.camera;
    }

    private createGun() {
        // Gun mesh attached to camera root so it pitches with view
        this.gunMesh = MeshBuilder.CreateBox("gun", { width: 0.15, height: 0.15, depth: 0.6 }, this.scene);
        this.gunMesh.parent = this.cameraRoot;
        this.gunMesh.position = new Vector3(0.4, -0.3, 0.5); // Offset to right and down
        
        const gunMat = new StandardMaterial("gunMat", this.scene);
        gunMat.diffuseColor = Color3.Black();
        this.gunMesh.material = gunMat;
        this.shadowGenerator.addShadowCaster(this.gunMesh);

        // Muzzle Flash Particle System
        this.muzzleSystem = new ParticleSystem("muzzleFlash", 10, this.scene);
        this.muzzleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png", this.scene);
        this.muzzleSystem.emitter = this.gunMesh;
        this.muzzleSystem.minEmitBox = new Vector3(0, 0, 0.3);
        this.muzzleSystem.maxEmitBox = new Vector3(0, 0, 0.3);
        this.muzzleSystem.color1 = new Color4(1, 1, 0, 1);
        this.muzzleSystem.color2 = new Color4(1, 0.5, 0, 1);
        this.muzzleSystem.minSize = 0.2;
        this.muzzleSystem.maxSize = 0.5;
        this.muzzleSystem.minLifeTime = 0.05;
        this.muzzleSystem.maxLifeTime = 0.1;
        this.muzzleSystem.emitRate = 100;
        this.muzzleSystem.manualEmitCount = 0;
        this.muzzleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;
        this.muzzleSystem.direction1 = new Vector3(0, 0, 1);
        this.muzzleSystem.direction2 = new Vector3(0, 0, 1);
        this.muzzleSystem.minEmitPower = 1;
        this.muzzleSystem.maxEmitPower = 3;
        this.muzzleSystem.updateSpeed = 0.005;
        this.muzzleSystem.start();
    }

    private setupInputs() {
        this.scene.actionManager = new BABYLON.ActionManager(this.scene);
        
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const type = kbInfo.type;
            const key = kbInfo.event.key.toLowerCase();
            
            if (type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.inputMap[key] = true;
                if (key === "r") this.reload();
                if (key === " ") this.jump();
            } else {
                this.inputMap[key] = false;
            }
        });

        // Mouse lock
        this.clickHandler = () => {
            if (document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock = this.canvas.requestPointerLock || (this.canvas as any).mozRequestPointerLock;
                this.canvas.requestPointerLock();
            }
        };
        this.canvas.addEventListener("click", this.clickHandler);

        // Mouse movement for rotation
        this.scene.onPointerObservable.add((pointerInfo) => {
            // ... existing pointer logic ...
            if (pointerInfo.type === PointerEventTypes.POINTERMOVE && document.pointerLockElement === this.canvas) {
                const event = pointerInfo.event as PointerEvent;
                const movementX = event.movementX;
                const movementY = event.movementY;

                // Rotate player body (Y axis)
                this.mesh.rotation.y += movementX * 0.002;

                // Rotate camera pivot (X axis) - Look up/down
                // We rotate the cameraRoot's local X
                // We need to clamp it to prevent flipping
                const currentX = this.cameraRoot.rotation.x;
                const newX = currentX + movementY * 0.002;
                // Allow looking almost straight up and down (-1.5 to 1.5 radians is approx -85 to 85 degrees)
                if (newX > -1.5 && newX < 1.5) {
                    this.cameraRoot.rotation.x = newX;
                }
            }
            
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN && document.pointerLockElement === this.canvas) {
                if (pointerInfo.event.button === 0) {
                    this.inputMap["mouseLeft"] = true;
                }
            }
            if (pointerInfo.type === PointerEventTypes.POINTERUP) {
                if (pointerInfo.event.button === 0) {
                    this.inputMap["mouseLeft"] = false;
                }
            }
        });
    }

    public dispose() {
        this.canvas.removeEventListener("click", this.clickHandler);
    }

    public update(dt: number) {
        this.handleMovement(dt);
        this.handleShooting(dt);
        this.updateBullets(dt);
    }

    private handleMovement(dt: number) {
        // Enforce upright rotation BEFORE movement
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = 0;

        const moveVector = Vector3.Zero();
        
        // Forward is based on player mesh rotation
        const forward = this.mesh.forward;
        const right = this.mesh.right;

        if (this.inputMap["w"]) {
            moveVector.addInPlace(forward);
        }
        if (this.inputMap["s"]) {
            moveVector.subtractInPlace(forward);
        }
        if (this.inputMap["d"]) {
            moveVector.addInPlace(right);
        }
        if (this.inputMap["a"]) {
            moveVector.subtractInPlace(right);
        }

        // Sprint
        let currentSpeed = this.speed;
        if (this.inputMap["shift"]) {
            currentSpeed *= 1.5;
        }

        // Normalize speed
        if (moveVector.length() > 0) {
            moveVector.normalize().scaleInPlace(currentSpeed * dt);
        }
        
        // Apply Gravity / Vertical Velocity
        
        // Check if grounded (raycast down)
        // Ray origin is now CENTER of player.
        const rayOrigin = this.mesh.position.clone();
        // Ray length needs to reach ground (1.0 distance to feet) + extra
        const ray = new Ray(rayOrigin, new Vector3(0, -1, 0), 1.1); 
        const hit = this.scene.pickWithRay(ray, (mesh) => mesh !== this.mesh && mesh !== this.visualMesh && mesh !== this.cameraRoot && !mesh.name.startsWith("bullet"));
        
        this.isGrounded = hit?.hit || false;

        if (this.isGrounded && this.verticalVelocity < 0) {
            this.verticalVelocity = -2; // Stick to ground
        } else {
            this.verticalVelocity -= 40 * dt; // Gravity
        }

        moveVector.y = this.verticalVelocity * dt;

        this.mesh.moveWithCollisions(moveVector);

        // Enforce upright rotation AFTER movement to correct any physics drift
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = 0;
    }

    private jump() {
        if (this.isGrounded) {
            this.verticalVelocity = 12; // Increased Jump force
            this.isGrounded = false;
        }
    }

    private handleShooting(dt: number) {
        if (this.inputMap["mouseLeft"] && !this.isReloading && this.currentAmmo > 0) {
            const now = Date.now() / 1000;
            if (now - this.lastShotTime > this.fireRate) {
                this.shoot();
                this.lastShotTime = now;
            }
        }
    }

    private shoot() {
        this.currentAmmo--;
        
        // Shoot from camera direction
        // We need the world position of the camera
        const origin = this.camera.globalPosition.clone();
        const forward = this.camera.getForwardRay().direction;
        
        // Adjust origin slightly forward so we don't hit player
        const startPos = origin.add(forward.scale(2));

        const bullet = new Bullet(this.scene, startPos, forward);
        this.bullets.push(bullet);

        // Recoil
        this.cameraRoot.rotation.x -= 0.02;

        // Muzzle Flash
        this.muzzleSystem.manualEmitCount = 5;
    }

    private reload() {
        if (this.isReloading || this.currentAmmo === this.maxMagAmmo || this.reserveAmmo <= 0) return;
        
        this.isReloading = true;
        // Simulate reload time
        setTimeout(() => {
            const needed = this.maxMagAmmo - this.currentAmmo;
            const toAdd = Math.min(needed, this.reserveAmmo);
            
            this.currentAmmo += toAdd;
            this.reserveAmmo -= toAdd;
            
            this.isReloading = false;
        }, 1500);
    }

    public addAmmo(amount: number) {
        this.reserveAmmo += amount;
    }

    private updateBullets(dt: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            if (this.bullets[i].update(dt)) {
                this.bullets[i].dispose();
                this.bullets.splice(i, 1);
            }
        }
    }

    public getBullets(): Bullet[] {
        return this.bullets;
    }

    public takeDamage(amount: number): boolean {
        this.health -= amount;
        return this.health <= 0;
    }
}

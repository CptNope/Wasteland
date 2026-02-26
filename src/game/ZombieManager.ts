import { Scene, MeshBuilder, Vector3, Mesh, StandardMaterial, Color3, Ray, ShadowGenerator } from "babylonjs";
import { Player } from "./Player";
import { Environment } from "./Environment";

export enum ZombieType {
    STANDARD,
    FAST,
    TANK
}

export class Zombie {
    public mesh: Mesh;
    private scene: Scene;
    private player: Player;
    private speed: number = 4.0;
    private health: number = 3;
    private isDeadFlag: boolean = false;
    private type: ZombieType;

    constructor(scene: Scene, position: Vector3, player: Player, shadowGenerator: ShadowGenerator, type: ZombieType = ZombieType.STANDARD) {
        this.scene = scene;
        this.player = player;
        this.type = type;
        
        // Create a slightly more complex zombie (Head + Body)
        // We use a container mesh for movement
        this.mesh = MeshBuilder.CreateCapsule("zombie", { radius: 0.5, height: 2 }, scene);
        this.mesh.position = position;
        this.mesh.checkCollisions = true;
        
        const mat = new StandardMaterial("zombieMat", scene);
        
        // Configure stats based on type
        switch (type) {
            case ZombieType.FAST:
                this.speed = 7.0;
                this.health = 2;
                mat.diffuseColor = new Color3(0.8, 0.2, 0.2); // Red
                this.mesh.scaling = new Vector3(0.8, 0.8, 0.8);
                break;
            case ZombieType.TANK:
                this.speed = 2.0;
                this.health = 10;
                mat.diffuseColor = new Color3(0.2, 0.2, 0.8); // Blue
                this.mesh.scaling = new Vector3(1.5, 1.5, 1.5);
                break;
            case ZombieType.STANDARD:
            default:
                this.speed = 4.0;
                this.health = 3;
                mat.diffuseColor = new Color3(0.1, 0.6, 0.1); // Green
                break;
        }
        
        this.mesh.material = mat;

        // Add eyes (red)
        const eye1 = MeshBuilder.CreateSphere("eye1", { diameter: 0.15 }, scene);
        eye1.parent = this.mesh;
        eye1.position = new Vector3(-0.2, 0.6, 0.4);
        const eyeMat = new StandardMaterial("eyeMat", scene);
        eyeMat.emissiveColor = Color3.Red();
        eye1.material = eyeMat;

        const eye2 = MeshBuilder.CreateSphere("eye2", { diameter: 0.15 }, scene);
        eye2.parent = this.mesh;
        eye2.position = new Vector3(0.2, 0.6, 0.4);
        eye2.material = eyeMat;

        shadowGenerator.addShadowCaster(this.mesh);
    }

    update(dt: number) {
        if (this.isDeadFlag) return;

        // Simple AI: Move towards player
        const direction = this.player.mesh.position.subtract(this.mesh.position);
        direction.y = 0; // Don't fly
        
        const dist = direction.length();

        if (dist > 1) { // Don't merge into player
            direction.normalize();
            this.mesh.moveWithCollisions(direction.scale(this.speed * dt));
            this.mesh.lookAt(this.player.mesh.position);
        }
        
        // Gravity
        this.mesh.moveWithCollisions(new Vector3(0, -9.81 * dt, 0));
    }

    takeDamage(amount: number) {
        this.health -= amount;
        // Flash red
        const mat = this.mesh.material as StandardMaterial;
        const originalColor = mat.diffuseColor.clone();
        mat.diffuseColor = Color3.Red();
        mat.emissiveColor = new Color3(0.5, 0, 0);
        setTimeout(() => {
            if (!this.isDeadFlag) {
                mat.diffuseColor = originalColor;
                mat.emissiveColor = Color3.Black();
            }
        }, 100);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDeadFlag = true;
        this.mesh.dispose();
    }

    isDead(): boolean {
        return this.isDeadFlag;
    }
}

export class ZombieManager {
    private scene: Scene;
    private player: Player;
    private environment: Environment;
    private shadowGenerator: ShadowGenerator;
    private zombies: Zombie[] = [];
    private spawnTimer: number = 0;
    private spawnInterval: number = 2.5; 
    private maxZombies: number = 100;

    constructor(scene: Scene, player: Player, environment: Environment, shadowGenerator: ShadowGenerator) {
        this.scene = scene;
        this.player = player;
        this.environment = environment;
        this.shadowGenerator = shadowGenerator;
    }

    update(dt: number) {
        // Spawn logic
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval && this.zombies.length < this.maxZombies) {
            this.spawnZombie();
            this.spawnTimer = 0;
            // Decrease interval slightly over time to increase difficulty
            this.spawnInterval = Math.max(0.5, this.spawnInterval * 0.99);
        }

        // Update zombies
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            zombie.update(dt);
            if (zombie.isDead()) {
                this.zombies.splice(i, 1);
            }
        }
    }

    private spawnZombie() {
        // Spawn randomly around player, but not too close
        let validPosition = false;
        let spawnPos = Vector3.Zero();
        let attempts = 0;

        while (!validPosition && attempts < 10) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 25 + Math.random() * 25;
            const x = this.player.mesh.position.x + Math.cos(angle) * distance;
            const z = this.player.mesh.position.z + Math.sin(angle) * distance;
            
            // Raycast down to find ground height and ensure we are not inside a building
            const rayOrigin = new Vector3(x, 50, z);
            const ray = new BABYLON.Ray(rayOrigin, new Vector3(0, -1, 0), 100);
            const hit = this.scene.pickWithRay(ray, (mesh) => {
                return mesh === this.environment.ground || this.environment.obstacles.includes(mesh as BABYLON.Mesh);
            });

            if (hit && hit.hit && hit.pickedMesh === this.environment.ground) {
                spawnPos = hit.pickedPoint!.clone();
                spawnPos.y += 1; // Offset for zombie height
                validPosition = true;
            }
            attempts++;
        }
        
        if (validPosition) {
            // Determine type
            const rand = Math.random();
            let type = ZombieType.STANDARD;
            
            if (rand > 0.9) {
                type = ZombieType.TANK; // 10% chance
            } else if (rand > 0.7) {
                type = ZombieType.FAST; // 20% chance
            }
            
            this.zombies.push(new Zombie(this.scene, spawnPos, this.player, this.shadowGenerator, type));
        }
    }

    public getZombies(): Zombie[] {
        return this.zombies;
    }
}

import { Scene, MeshBuilder, Vector3, StandardMaterial, Color3, Texture, Mesh, ShadowGenerator } from "babylonjs";

class Chunk {
    public meshes: Mesh[] = [];
    public obstacles: Mesh[] = [];
    public healthPacks: Mesh[] = [];
    public ammoPacks: Mesh[] = [];
    public ground: Mesh;

    constructor(scene: Scene, x: number, z: number, size: number, materials: any, shadowGenerator: ShadowGenerator) {
        // Create Ground
        this.ground = MeshBuilder.CreateGround("ground_" + x + "_" + z, { width: size, height: size, subdivisions: 2 }, scene);
        this.ground.position.x = x * size;
        this.ground.position.z = z * size;
        this.ground.material = materials.ground;
        this.ground.checkCollisions = true;
        this.ground.receiveShadows = true;
        this.meshes.push(this.ground);

        // Generate Obstacles
        this.generateObstacles(scene, x, z, size, materials, shadowGenerator);
        this.generateLoot(scene, x, z, size, materials, shadowGenerator);
    }

    private generateObstacles(scene: Scene, cx: number, cz: number, size: number, materials: any, shadowGenerator: ShadowGenerator) {
        const numBuildings = Math.floor(Math.random() * 3) + 2; // 2-5 buildings per chunk
        
        for (let i = 0; i < numBuildings; i++) {
            const width = 5 + Math.random() * 10;
            const depth = 5 + Math.random() * 10;
            const height = 5 + Math.random() * 20;
            
            // Local position within chunk
            const lx = (Math.random() - 0.5) * (size - 10);
            const lz = (Math.random() - 0.5) * (size - 10);
            
            const x = cx * size + lx;
            const z = cz * size + lz;

            const building = MeshBuilder.CreateBox("building_" + cx + "_" + cz + "_" + i, { width, height, depth }, scene);
            building.position = new Vector3(x, height / 2, z);
            building.material = Math.random() > 0.7 ? materials.rust : materials.building;
            building.checkCollisions = true;
            building.receiveShadows = true;
            shadowGenerator.addShadowCaster(building);
            
            building.rotation.y = Math.random() * Math.PI * 2;

            this.obstacles.push(building);
            this.meshes.push(building);

            // Debris
            if (Math.random() > 0.5) {
                this.createDebris(scene, x, z, width + 5, materials, shadowGenerator);
            }
        }
    }

    private createDebris(scene: Scene, x: number, z: number, radius: number, materials: any, shadowGenerator: ShadowGenerator) {
        const debrisCount = Math.floor(Math.random() * 3);
        for(let i=0; i<debrisCount; i++) {
            const size = 0.5 + Math.random();
            const debris = MeshBuilder.CreateBox("debris", {size}, scene);
            const dx = x + (Math.random() - 0.5) * radius;
            const dz = z + (Math.random() - 0.5) * radius;
            debris.position = new Vector3(dx, size/2, dz);
            debris.rotation = new Vector3(Math.random(), Math.random(), Math.random());
            debris.material = materials.debris;
            debris.checkCollisions = true;
            debris.receiveShadows = true;
            shadowGenerator.addShadowCaster(debris);
            this.meshes.push(debris);
            this.obstacles.push(debris); // Treat debris as obstacles
        }
    }

    private generateLoot(scene: Scene, cx: number, cz: number, size: number, materials: any, shadowGenerator: ShadowGenerator) {
        // Health Packs
        if (Math.random() > 0.7) { // 30% chance per chunk
            const pack = MeshBuilder.CreateBox("healthPack", {size: 1}, scene);
            const lx = (Math.random() - 0.5) * (size - 5);
            const lz = (Math.random() - 0.5) * (size - 5);
            pack.position = new Vector3(cx * size + lx, 0.5, cz * size + lz);
            pack.material = materials.health;
            
            // Simple rotation
            scene.registerBeforeRender(() => {
                if (!pack.isDisposed()) pack.rotation.y += 0.02;
            });
            
            this.healthPacks.push(pack);
            this.meshes.push(pack);
            shadowGenerator.addShadowCaster(pack);
        }

        // Ammo Packs
        if (Math.random() > 0.6) { // 40% chance per chunk
            const pack = MeshBuilder.CreateBox("ammoPack", {size: 0.8}, scene);
            const lx = (Math.random() - 0.5) * (size - 5);
            const lz = (Math.random() - 0.5) * (size - 5);
            pack.position = new Vector3(cx * size + lx, 0.4, cz * size + lz);
            pack.material = materials.ammo;
            
            scene.registerBeforeRender(() => {
                if (!pack.isDisposed()) pack.rotation.y += 0.03;
            });
            
            this.ammoPacks.push(pack);
            this.meshes.push(pack);
            shadowGenerator.addShadowCaster(pack);
        }
    }

    dispose() {
        this.meshes.forEach(m => m.dispose());
        this.meshes = [];
        this.obstacles = [];
        this.healthPacks = [];
        this.ammoPacks = [];
    }
}

export class Environment {
    private scene: Scene;
    private shadowGenerator: ShadowGenerator;
    
    // Aggregated lists for GameApp compatibility
    public obstacles: Mesh[] = [];
    public healthPacks: Mesh[] = [];
    public ammoPacks: Mesh[] = [];
    
    private chunks: Map<string, Chunk> = new Map();
    private chunkSize: number = 60;
    private loadDistance: number = 2; // Radius in chunks
    private materials: any = {};

    constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.initMaterials();
        
        // Initial update will create chunks
        this.update(Vector3.Zero());
    }

    private initMaterials() {
        const groundMat = new StandardMaterial("groundMat", this.scene);
        const textureSize = 512;
        const dynamicTexture = new BABYLON.DynamicTexture("gridTexture", textureSize, this.scene, false);
        const ctx = dynamicTexture.getContext();
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(0, 0, textureSize, textureSize);
        ctx.strokeStyle = "#444444";
        ctx.lineWidth = 4;
        const step = textureSize / 8;
        ctx.beginPath();
        for (let i = 0; i <= textureSize; i += step) {
            ctx.moveTo(i, 0); ctx.lineTo(i, textureSize);
            ctx.moveTo(0, i); ctx.lineTo(textureSize, i);
        }
        ctx.stroke();
        dynamicTexture.update();
        groundMat.diffuseTexture = dynamicTexture;
        (groundMat.diffuseTexture as Texture).uScale = this.chunkSize / 10;
        (groundMat.diffuseTexture as Texture).vScale = this.chunkSize / 10;
        groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
        groundMat.freeze(); // Optimization

        const buildingMat = new StandardMaterial("buildingMat", this.scene);
        buildingMat.diffuseColor = new Color3(0.3, 0.3, 0.35);
        buildingMat.freeze();

        const rustMat = new StandardMaterial("rustMat", this.scene);
        rustMat.diffuseColor = new Color3(0.4, 0.2, 0.1);
        rustMat.freeze();

        const debrisMat = new StandardMaterial("debrisMat", this.scene);
        debrisMat.diffuseColor = Color3.Gray();
        debrisMat.freeze();

        const healthMat = new StandardMaterial("packMat", this.scene);
        healthMat.emissiveColor = Color3.Green();
        healthMat.freeze();

        const ammoMat = new StandardMaterial("ammoPackMat", this.scene);
        ammoMat.emissiveColor = Color3.Yellow();
        ammoMat.freeze();

        this.materials = {
            ground: groundMat,
            building: buildingMat,
            rust: rustMat,
            debris: debrisMat,
            health: healthMat,
            ammo: ammoMat
        };
    }

    public update(playerPos: Vector3) {
        const centerChunkX = Math.round(playerPos.x / this.chunkSize);
        const centerChunkZ = Math.round(playerPos.z / this.chunkSize);

        const activeKeys = new Set<string>();

        for (let x = centerChunkX - this.loadDistance; x <= centerChunkX + this.loadDistance; x++) {
            for (let z = centerChunkZ - this.loadDistance; z <= centerChunkZ + this.loadDistance; z++) {
                const key = `${x},${z}`;
                activeKeys.add(key);

                if (!this.chunks.has(key)) {
                    this.createChunk(x, z);
                }
            }
        }

        // Remove old chunks
        for (const [key, chunk] of this.chunks) {
            if (!activeKeys.has(key)) {
                this.disposeChunk(key);
            }
        }
    }

    private createChunk(x: number, z: number) {
        const chunk = new Chunk(this.scene, x, z, this.chunkSize, this.materials, this.shadowGenerator);
        this.chunks.set(`${x},${z}`, chunk);
        
        // Add to aggregate lists
        this.obstacles.push(...chunk.obstacles);
        this.healthPacks.push(...chunk.healthPacks);
        this.ammoPacks.push(...chunk.ammoPacks);
    }

    private disposeChunk(key: string) {
        const chunk = this.chunks.get(key);
        if (chunk) {
            // Remove from aggregate lists
            this.obstacles = this.obstacles.filter(m => !chunk.obstacles.includes(m));
            this.healthPacks = this.healthPacks.filter(m => !chunk.healthPacks.includes(m));
            this.ammoPacks = this.ammoPacks.filter(m => !chunk.ammoPacks.includes(m));
            
            chunk.dispose();
            this.chunks.delete(key);
        }
    }

    public getGroundMeshes(): Mesh[] {
        const grounds: Mesh[] = [];
        for (const chunk of this.chunks.values()) {
            grounds.push(chunk.ground);
        }
        return grounds;
    }
}

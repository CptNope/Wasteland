import { Scene, MeshBuilder, Vector3, StandardMaterial, Color3, Texture, Mesh, PhysicsImpostor, ShadowGenerator } from "babylonjs";

export class Environment {
    private scene: Scene;
    public ground: Mesh;
    public obstacles: Mesh[] = [];
    public healthPacks: Mesh[] = [];
    public ammoPacks: Mesh[] = [];
    private mapSize: number = 200;
    private shadowGenerator: ShadowGenerator;

    constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.createGround();
        this.generateProceduralRuins();
        this.generateHealthPacks();
        this.generateAmmoPacks();
    }

    private createGround() {
        // Create a large ground
        this.ground = MeshBuilder.CreateGround("ground", { width: this.mapSize, height: this.mapSize, subdivisions: 20 }, this.scene);
        
        const groundMat = new StandardMaterial("groundMat", this.scene);
        
        // Create procedural grid texture
        const textureSize = 512;
        const dynamicTexture = new BABYLON.DynamicTexture("gridTexture", textureSize, this.scene, false);
        const ctx = dynamicTexture.getContext();
        
        ctx.fillStyle = "#2a2a2a"; // Dark gray background
        ctx.fillRect(0, 0, textureSize, textureSize);
        
        ctx.strokeStyle = "#444444"; // Lighter gray lines
        ctx.lineWidth = 4;
        
        // Draw grid
        const step = textureSize / 8;
        ctx.beginPath();
        for (let i = 0; i <= textureSize; i += step) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i, textureSize);
            ctx.moveTo(0, i);
            ctx.lineTo(textureSize, i);
        }
        ctx.stroke();
        dynamicTexture.update();
        
        groundMat.diffuseTexture = dynamicTexture;
        // Tile the texture
        (groundMat.diffuseTexture as Texture).uScale = this.mapSize / 10;
        (groundMat.diffuseTexture as Texture).vScale = this.mapSize / 10;
        
        groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
        
        this.ground.material = groundMat;
        this.ground.checkCollisions = true;
        this.ground.receiveShadows = true;
    }

    private generateProceduralRuins() {
        const numBuildings = 60;
        const buildingMat = new StandardMaterial("buildingMat", this.scene);
        buildingMat.diffuseColor = new Color3(0.3, 0.3, 0.35); // Concrete color
        
        const rustMat = new StandardMaterial("rustMat", this.scene);
        rustMat.diffuseColor = new Color3(0.4, 0.2, 0.1); // Rusty metal

        for (let i = 0; i < numBuildings; i++) {
            const width = 5 + Math.random() * 10;
            const depth = 5 + Math.random() * 10;
            const height = 5 + Math.random() * 20;
            
            const x = (Math.random() - 0.5) * (this.mapSize - 20);
            const z = (Math.random() - 0.5) * (this.mapSize - 20);

            // Don't spawn too close to center (player start)
            if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

            const building = MeshBuilder.CreateBox("building" + i, { width, height, depth }, this.scene);
            building.position = new Vector3(x, height / 2, z);
            building.material = Math.random() > 0.7 ? rustMat : buildingMat;
            building.checkCollisions = true;
            building.receiveShadows = true;
            this.shadowGenerator.addShadowCaster(building);
            
            // Random rotation
            building.rotation.y = Math.random() * Math.PI * 2;

            this.obstacles.push(building);

            // Add some debris around
            if (Math.random() > 0.5) {
                this.createDebris(x, z, width + 5);
            }
        }
    }

    private generateHealthPacks() {
        const numPacks = 10;
        const packMat = new StandardMaterial("packMat", this.scene);
        packMat.emissiveColor = Color3.Green();
        
        for(let i=0; i<numPacks; i++) {
            const pack = MeshBuilder.CreateBox("healthPack" + i, {size: 1}, this.scene);
            const x = (Math.random() - 0.5) * (this.mapSize - 40);
            const z = (Math.random() - 0.5) * (this.mapSize - 40);
            
            pack.position = new Vector3(x, 0.5, z);
            pack.material = packMat;
            
            // Add a simple rotation animation
            this.scene.registerBeforeRender(() => {
                pack.rotation.y += 0.02;
            });
            
            this.healthPacks.push(pack);
            this.shadowGenerator.addShadowCaster(pack);
        }
    }

    private createDebris(x: number, z: number, radius: number) {
        const debrisCount = Math.floor(Math.random() * 5);
        for(let i=0; i<debrisCount; i++) {
            const size = 0.5 + Math.random();
            const debris = MeshBuilder.CreateBox("debris", {size}, this.scene);
            const dx = x + (Math.random() - 0.5) * radius;
            const dz = z + (Math.random() - 0.5) * radius;
            debris.position = new Vector3(dx, size/2, dz);
            debris.rotation = new Vector3(Math.random(), Math.random(), Math.random());
            
            const mat = new StandardMaterial("debrisMat", this.scene);
            mat.diffuseColor = Color3.Gray();
            debris.material = mat;
            debris.checkCollisions = true;
            debris.receiveShadows = true;
            this.shadowGenerator.addShadowCaster(debris);
        }
    }

    private generateAmmoPacks() {
        const numPacks = 15;
        const packMat = new StandardMaterial("ammoPackMat", this.scene);
        packMat.emissiveColor = Color3.Yellow();
        
        for(let i=0; i<numPacks; i++) {
            const pack = MeshBuilder.CreateBox("ammoPack" + i, {size: 0.8}, this.scene);
            const x = (Math.random() - 0.5) * (this.mapSize - 40);
            const z = (Math.random() - 0.5) * (this.mapSize - 40);
            
            pack.position = new Vector3(x, 0.4, z);
            pack.material = packMat;
            
            // Add a simple rotation animation
            this.scene.registerBeforeRender(() => {
                pack.rotation.y += 0.03;
            });
            
            this.ammoPacks.push(pack);
            this.shadowGenerator.addShadowCaster(pack);
        }
    }
}

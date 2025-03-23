import * as THREE from 'three';

export class Terrain {
    constructor() {
        this.size = { width: 400, depth: 400 };
        this.segments = 128;
        
        // Definir alturas mínima y máxima
        this.minHeight = -10; // Profundidad máxima del agua
        this.maxHeight = 30;  // Altura máxima del terreno
        
        // Nivel del agua
        this.waterLevel = 0;
        
        this.heightData = null;
        this.mesh = null;
        this.textureRepeat = 8;
    }

    async initialize() {
        try {
            await this.loadHeightmap('/assets/heightmap.jpg');
            await this.loadTextures();
            this.createTerrain();
            return this.group;
        } catch (error) {
            console.error('Error inicializando el terreno:', error);
        }
    }

    loadHeightmap(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                
                const imageData = context.getImageData(0, 0, image.width, image.height).data;
                this.heightData = new Float32Array(image.width * image.height);
                
                for(let i = 0; i < this.heightData.length; i++) {
                    const r = imageData[i * 4];
                    const g = imageData[i * 4 + 1];
                    const b = imageData[i * 4 + 2];
                    
                    // Convertir el valor de gris (0-255) al rango de altura deseado
                    const normalizedHeight = ((r + g + b) / 3) / 255.0;
                    this.heightData[i] = this.minHeight + (normalizedHeight * (this.maxHeight - this.minHeight));
                }
                
                this.segments = image.width - 1;
                resolve();
            };
            image.onerror = reject;
            image.src = url;
        });
    }

    loadTextures() {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                './assets/textures/sand.png',
                (texture) => {
                    this.sandTexture = texture;
                    this.sandTexture.wrapS = THREE.RepeatWrapping;
                    this.sandTexture.wrapT = THREE.RepeatWrapping;
                    this.sandTexture.repeat.set(this.textureRepeat, this.textureRepeat);
                    resolve();
                },
                undefined,
                reject
            );
        });
    }

    createTerrain() {
        const geometry = new THREE.PlaneGeometry(
            this.size.width, 
            this.size.depth, 
            this.segments, 
            this.segments
        );
        geometry.rotateX(-Math.PI / 2);

        // Aplicar alturas del heightmap
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            vertices[i + 1] = this.getHeightAt(x, z);
        }

        geometry.computeVertexNormals();

        // Crear material con textura
        const material = new THREE.MeshStandardMaterial({
            map: this.sandTexture,
            color: 0xf0d6a3,
            roughness: 0.9,
            metalness: 0.05,
            side: THREE.DoubleSide,
            shadowSide: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;

        // Crear el agua
        const waterGeometry = new THREE.PlaneGeometry(this.size.width, this.size.depth);
        const waterMaterial = new THREE.MeshPhongMaterial({
            color: 0x0066ff,
            transparent: true,
            opacity: 0.6
        });
        
        this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        this.waterMesh.rotation.x = -Math.PI / 2;
        this.waterMesh.position.y = this.waterLevel;
        
        // Grupo para contener terreno y agua
        this.group = new THREE.Group();
        this.group.add(this.mesh);
        this.group.add(this.waterMesh);
        
        return this.group;
    }

    getHeightAt(x, z) {
        if (!this.heightData) return 0;

        const halfWidth = this.size.width / 2;
        const halfDepth = this.size.depth / 2;
        
        const normalizedX = (x + halfWidth) / this.size.width;
        const normalizedZ = (z + halfDepth) / this.size.depth;
        
        const ix = Math.floor(normalizedX * this.segments);
        const iz = Math.floor(normalizedZ * this.segments);
        
        const index = iz * (this.segments + 1) + ix;
        return this.heightData[index];
    }

    isInBounds(position) {
        const halfWidth = this.size.width / 2;
        const halfDepth = this.size.depth / 2;
        return position.x >= -halfWidth && 
               position.x <= halfWidth && 
               position.z >= -halfDepth && 
               position.z <= halfDepth;
    }
}
import * as THREE from 'three';
import { Logger } from '../utils/Logger.js';

export class Terrain {
    constructor() {
        this.size = { width: 400, depth: 400 };
        this.segments = 32; // Resolución final
        this.lowResSegments = 8; // Resolución inicial
        
        // Definir alturas mínima y máxima
        this.minHeight = -10; // Profundidad máxima del agua
        this.maxHeight = 30;  // Altura máxima del terreno
        
        // Nivel del agua
        this.waterLevel = 0;
        
        this.heightData = null;
        this.mesh = null;
        this.lowResMesh = null;
        this.textureRepeat = 8;
        this.isHighResLoaded = false;
        
        // Inicializar logger
        this.logger = new Logger();
        
        // Crear Web Worker
        this.worker = new Worker(new URL('../utils/TerrainWorker.js', import.meta.url));
        this.worker.onmessage = (e) => this.handleWorkerMessage(e);
    }

    async initialize() {
        try {
            this.logger.start('initialize');
            
            this.logger.start('loadHeightmap');
            await this.loadHeightmap('/assets/heightmap.png');
            this.logger.end('loadHeightmap');
            
            this.logger.start('loadTextures');
            await this.loadTextures();
            this.logger.end('loadTextures');
            
            this.logger.start('createLowResTerrain');
            this.createLowResTerrain();
            this.logger.end('createLowResTerrain');
            
            this.logger.start('loadHighResTerrain');
            this.loadHighResTerrain();
            this.logger.end('loadHighResTerrain');
            
            this.logger.end('initialize');
            return this.group;
        } catch (error) {
            console.error('Error inicializando el terreno:', error);
        }
    }

    createLowResTerrain() {
        this.logger.start('createLowResTerrain_geometry');
        const geometry = new THREE.PlaneGeometry(
            this.size.width, 
            this.size.depth, 
            this.lowResSegments, 
            this.lowResSegments
        );
        this.logger.end('createLowResTerrain_geometry');
        
        geometry.rotateX(-Math.PI / 2);

        this.logger.start('createLowResTerrain_heightmap');
        const vertices = geometry.attributes.position.array;
        
        // Aplicar heightmap
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            vertices[i + 1] = this.getHeightAt(x, z);
        }
        this.logger.end('createLowResTerrain_heightmap');

        this.logger.start('createLowResTerrain_smooth');
        // Suavizado temporalmente desactivado para pruebas de rendimiento
        // this.smoothTerrain(vertices, this.lowResSegments, 2, 0.3);
        this.logger.end('createLowResTerrain_smooth');

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            map: this.sandTexture,
            color: 0xf0d6a3,
            roughness: 0.9,
            metalness: 0.05,
            side: THREE.DoubleSide,
            shadowSide: THREE.DoubleSide
        });

        this.lowResMesh = new THREE.Mesh(geometry, material);
        this.lowResMesh.receiveShadow = true;

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
        
        // Grupo inicial con versión de baja resolución
        this.group = new THREE.Group();
        this.group.add(this.lowResMesh);
        this.group.add(this.waterMesh);
    }

    loadHighResTerrain() {
        this.logger.start('loadHighResTerrain_geometry');
        const geometry = new THREE.PlaneGeometry(
            this.size.width, 
            this.size.depth, 
            this.segments, 
            this.segments
        );
        this.logger.end('loadHighResTerrain_geometry');
        
        geometry.rotateX(-Math.PI / 2);
        const vertices = geometry.attributes.position.array;
        
        // Enviar datos al Web Worker
        this.worker.postMessage({
            vertices,
            segments: this.segments,
            size: this.size,
            heightData: this.heightData,
            minHeight: this.minHeight,
            maxHeight: this.maxHeight
        });
    }

    handleWorkerMessage(e) {
        const { vertices } = e.data;
        
        // Crear la geometría final
        const geometry = new THREE.PlaneGeometry(
            this.size.width, 
            this.size.depth, 
            this.segments, 
            this.segments
        );
        geometry.rotateX(-Math.PI / 2);
        geometry.attributes.position.array.set(vertices);
        geometry.computeVertexNormals();

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

        // Reemplazar la versión de baja resolución por la de alta resolución
        this.group.remove(this.lowResMesh);
        this.group.add(this.mesh);
        this.isHighResLoaded = true;
    }

    smoothTerrain(vertices, segments, iterations, intensity) {
        for (let iteration = 0; iteration < iterations; iteration++) {
            const tempHeights = new Float32Array(vertices.length / 3);
            
            for (let i = 0; i < vertices.length; i += 3) {
                const idx = i / 3;
                const row = Math.floor(idx / (segments + 1));
                const col = idx % (segments + 1);
                
                let sum = vertices[i + 1];
                let count = 1;
                
                const neighbors = [
                    [-1, -1], [-1, 0], [-1, 1],
                    [0, -1],           [0, 1],
                    [1, -1],  [1, 0],  [1, 1]
                ];
                
                for (const [dr, dc] of neighbors) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    if (newRow >= 0 && newRow <= segments && 
                        newCol >= 0 && newCol <= segments) {
                        const neighborIdx = (newRow * (segments + 1) + newCol) * 3;
                        sum += vertices[neighborIdx + 1];
                        count++;
                    }
                }
                
                tempHeights[idx] = vertices[i + 1] * (1 - intensity) + 
                                  (sum / count) * intensity;
            }
            
            for (let i = 0; i < vertices.length; i += 3) {
                vertices[i + 1] = tempHeights[i / 3];
            }
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
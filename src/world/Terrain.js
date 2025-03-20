import * as THREE from 'three';

export class Terrain {
    constructor() {
        this.size = { width: 100, depth: 100 };
        this.islandRadius = 30;
        this.islandHeight = 1;
        this.maxWaterDepth = -2;
        this.createTerrain();
    }

    createTerrain() {
        this.mesh = new THREE.Group();

        // Crear el terreno base
        const segments = 50;
        const terrainGeometry = new THREE.BufferGeometry();
        
        // Crear una rejilla de vértices
        const vertices = [];
        const halfWidth = this.size.width / 2;
        const halfDepth = this.size.depth / 2;
        
        for (let i = 0; i <= segments; i++) {
            const z = (i / segments) * this.size.depth - halfDepth;
            for (let j = 0; j <= segments; j++) {
                const x = (j / segments) * this.size.width - halfWidth;
                
                // Calcular altura basada en la distancia al centro
                const distanceFromCenter = Math.sqrt(x * x + z * z);
                let y;
                
                if (distanceFromCenter <= this.islandRadius) {
                    // Dentro de la isla
                    y = this.islandHeight;
                } else {
                    // Pendiente gradual hacia la profundidad máxima
                    const t = (distanceFromCenter - this.islandRadius) / 
                            (halfWidth - this.islandRadius);
                    y = this.islandHeight - (t * (this.islandHeight - this.maxWaterDepth));
                }
                
                vertices.push(x, y, z);
            }
        }

        // Crear índices para los triángulos
        const indices = [];
        const verticesPerRow = segments + 1;
        
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < segments; j++) {
                const a = i * verticesPerRow + j;
                const b = a + 1;
                const c = a + verticesPerRow;
                const d = c + 1;
                
                indices.push(a, b, c);
                indices.push(b, d, c);
            }
        }

        terrainGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        terrainGeometry.setIndex(indices);
        terrainGeometry.computeVertexNormals();

        // Material para el terreno
        const terrainMaterial = new THREE.MeshPhongMaterial({
            color: 0xf2e4bb,
            side: THREE.DoubleSide,
            shadowSide: THREE.DoubleSide
        });

        this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        this.terrain.receiveShadow = true;

        // Añadir el terreno al grupo
        this.mesh.add(this.terrain);
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
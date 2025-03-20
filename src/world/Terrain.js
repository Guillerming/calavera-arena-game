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

    getHeightAt(x, z) {
        // Get terrain geometry and vertices
        const geometry = this.terrain.geometry;
        const positionAttribute = geometry.getAttribute('position');
        const vertices = positionAttribute.array;
        const indices = geometry.index.array;
        
        // Find which triangle the point (x, z) falls into
        const verticesPerRow = Math.sqrt(positionAttribute.count);
        const segmentSize = this.size.width / (verticesPerRow - 1);
        
        // Convert world coordinates to grid coordinates
        const halfWidth = this.size.width / 2;
        const halfDepth = this.size.depth / 2;
        const gridX = Math.floor((x + halfWidth) / segmentSize);
        const gridZ = Math.floor((z + halfDepth) / segmentSize);
        
        // Make sure we're in bounds
        if (gridX < 0 || gridX >= verticesPerRow - 1 || gridZ < 0 || gridZ >= verticesPerRow - 1) {
            return 0; // Or return a default height
        }
        
        // Find the two triangles in this grid cell
        const cellIndex = gridZ * (verticesPerRow - 1) + gridX;
        const triangleIndex1 = cellIndex * 6; // Each cell has 6 indices (2 triangles)
        
        // Get local coordinates within the grid cell (0 to 1)
        const localX = (x + halfWidth) / segmentSize - gridX;
        const localZ = (z + halfDepth) / segmentSize - gridZ;
        
        // Determine which of the two triangles the point is in
        let triangleIndices;
        if (localX + localZ <= 1) {
            // Lower triangle
            triangleIndices = [
                indices[triangleIndex1],
                indices[triangleIndex1 + 1],
                indices[triangleIndex1 + 2]
            ];
        } else {
            // Upper triangle
            triangleIndices = [
                indices[triangleIndex1 + 3],
                indices[triangleIndex1 + 4],
                indices[triangleIndex1 + 5]
            ];
        }
        
        // Get the vertices of the triangle
        const triangle = [];
        for (let i = 0; i < 3; i++) {
            const vertexIndex = triangleIndices[i] * 3;
            triangle.push(new THREE.Vector3(
                vertices[vertexIndex],
                vertices[vertexIndex + 1],
                vertices[vertexIndex + 2]
            ));
        }
        
        // Calculate barycentric coordinates to find height
        const barycentricCoords = this.calculateBarycentricCoordinates(
            x, z, 
            triangle[0].x, triangle[0].z,
            triangle[1].x, triangle[1].z,
            triangle[2].x, triangle[2].z
        );
        
        // Interpolate height using barycentric coordinates
        const height = triangle[0].y * barycentricCoords.a + 
                       triangle[1].y * barycentricCoords.b + 
                       triangle[2].y * barycentricCoords.c;
        
        return height;
    }
    
    // Helper function to calculate barycentric coordinates
    calculateBarycentricCoordinates(px, pz, x1, z1, x2, z2, x3, z3) {
        const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
        const a = ((z2 - z3) * (px - x3) + (x3 - x2) * (pz - z3)) / det;
        const b = ((z3 - z1) * (px - x3) + (x1 - x3) * (pz - z3)) / det;
        const c = 1 - a - b;
        
        return { a, b, c };
    }
} 
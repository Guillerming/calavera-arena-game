import * as THREE from 'three';

export class Terrain {
    constructor() {
        this.size = { width: 20, depth: 20 }; // Mismo tamaño que la geometría
        this.mesh = this.createBasicTerrain();
    }

    createBasicTerrain() {
        // Por ahora, solo un plano simple
        const geometry = new THREE.PlaneGeometry(this.size.width, this.size.depth, 20, 20);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x3c8f3c,
            side: THREE.DoubleSide
        });
        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.x = -Math.PI / 2;
        return plane;
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
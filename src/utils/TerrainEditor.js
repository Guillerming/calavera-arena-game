import * as THREE from 'three';

export class TerrainEditor {
    constructor(terrain, engine) {
        this.terrain = terrain;
        this.engine = engine;
        this.isEditing = false;
        this.brushSize = 10;
        this.brushStrength = 0.5;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // No inicializamos UI ya que eliminamos el editor de terreno
    }

    initializeUI() {
        // No hay UI para inicializar
        return;
    }

    setupListeners() {
        // No configuramos listeners para elementos que ya no existen
        return;
    }

    onMouseMove(event) {
        // No procesamos eventos ya que la UI fue eliminada
        return;
    }

    modifyTerrain(point) {
        // Mantenemos la lógica de modificación de terreno por si se quiere llamar directamente
        if (!this.terrain || !this.terrain.mesh) return;
        
        // Acceder a la geometría a través del mesh del terreno
        const geometry = this.terrain.mesh.geometry;
        const vertices = geometry.attributes.position.array;
        
        // Modificar vértices cercanos al punto
        for (let i = 0; i < vertices.length; i += 3) {
            const distance = Math.sqrt(
                Math.pow(vertices[i] - point.x, 2) + 
                Math.pow(vertices[i + 2] - point.z, 2)
            );

            if (distance < this.brushSize) {
                const influence = 1 - (distance / this.brushSize);
                vertices[i + 1] += this.brushStrength * influence;
            }
        }

        // Marcar los atributos de posición como necesitados de actualización
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
    }

    saveTerrain() {
        // La funcionalidad de guardar terreno se mantiene, pero no se expone en la UI
        if (!this.terrain || !this.terrain.mesh) return;
        
        const geometry = this.terrain.mesh.geometry;
        const vertices = geometry.attributes.position.array;
        const heightData = [];
        
        // Convertir vértices a heightmap
        for (let i = 0; i < vertices.length; i += 3) {
            heightData.push(vertices[i + 1]);
        }

        // Guardar como JSON
        const blob = new Blob([JSON.stringify(heightData)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'terrain-heightmap.json';
        a.click();
    }
} 
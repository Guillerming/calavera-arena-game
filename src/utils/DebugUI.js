export class DebugUI {
    constructor() {
        this.container = document.getElementById('debug-container');
        
        if (!this.container) {
            console.error('No se encontró el contenedor de debug en el HTML');
        }
    }

    update(character) {
        if (!this.container) return;
        
        if (!character) {
            document.getElementById('debug-status').textContent = 'No hay personaje';
            return;
        }

        // Intentar obtener la posición, ya sea de character.mesh.position o character.position
        const position = character.mesh ? character.mesh.position : character.position;
        
        if (!position) {
            document.getElementById('debug-status').textContent = 'No se pudo obtener posición';
            return;
        }
        
        // Actualizar coordenadas X y Z
        document.getElementById('position-x').textContent = position.x.toFixed(2);
        document.getElementById('position-z').textContent = position.z.toFixed(2);
        document.getElementById('character-y').textContent = position.y.toFixed(2);

        if (!character.terrain) {
            document.getElementById('debug-status').textContent = 'No hay terreno';
            document.getElementById('terrain-height').textContent = 'N/A';
            document.getElementById('height-diff').textContent = 'N/A';
            return;
        }

        try {
            const terrainHeight = character.terrain.getHeightAt(position.x, position.z);
            const difference = position.y - terrainHeight;

            document.getElementById('terrain-height').textContent = terrainHeight.toFixed(2);
            document.getElementById('height-diff').textContent = difference.toFixed(2);
            document.getElementById('debug-status').textContent = 'OK';
        } catch (error) {
            document.getElementById('debug-status').textContent = 
                `Error: ${error.message} (${typeof character.terrain})`;
        }
    }
} 
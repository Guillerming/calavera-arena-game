export class DebugUI {
    constructor() {
        this.container = this.createDebugContainer();
    }

    createDebugContainer() {
        const container = document.createElement('div');
        container.id = 'debug-container';
        container.innerHTML = `
            <div class="debug-value">Altura Personaje: <span id="character-y">0.00</span></div>
            <div class="debug-value">Altura Terreno: <span id="terrain-height">0.00</span></div>
            <div class="debug-value">Diferencia: <span id="height-diff">0.00</span></div>
            <div class="debug-value">Estado: <span id="debug-status">Iniciando...</span></div>
        `;
        document.body.appendChild(container);
        return container;
    }

    update(character, terrain) {
        if (!character) {
            document.getElementById('debug-status').textContent = 'No hay personaje';
            return;
        }

        const position = character.mesh.position;
        document.getElementById('character-y').textContent = position.y.toFixed(2);

        if (!terrain) {
            document.getElementById('debug-status').textContent = 'No hay terreno';
            document.getElementById('terrain-height').textContent = 'N/A';
            document.getElementById('height-diff').textContent = 'N/A';
            return;
        }

        try {
            const terrainHeight = terrain.getHeightAt(position.x, position.z);
            const difference = position.y - terrainHeight;

            document.getElementById('terrain-height').textContent = terrainHeight.toFixed(2);
            document.getElementById('height-diff').textContent = difference.toFixed(2);
            document.getElementById('debug-status').textContent = 'OK';
        } catch (error) {
            document.getElementById('debug-status').textContent = 
                `Error: ${error.message} (${typeof terrain})`;
            // console.log('Terrain object:', terrain);
        }
    }
} 
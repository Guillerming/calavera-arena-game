export class CharacterUI {
    // Referencias a los elementos UI
    static uiInitialized = false;
    
    constructor(character) {
        this.character = character;
        this.reloadIndicator = null;
        this.reloadText = null;
        this.directionIndicator = null;
        this.directionText = null;
        this.healthBar = null;
        this.healthText = null;
        this.cannonIndicator = null;
        this.angleText = null;
        
        // Inicializar UI si no se ha hecho ya
        if (!CharacterUI.uiInitialized) {
            this.initializeUI();
        }
    }

    initializeUI() {
        if (CharacterUI.uiInitialized) return;
        CharacterUI.uiInitialized = true;
        
        // Obtener referencias a los elementos existentes en index.html
        this.reloadIndicator = document.getElementById('reload-indicator');
        this.reloadText = document.getElementById('reload-text');
        this.directionIndicator = document.getElementById('direction-indicator');
        this.directionText = document.getElementById('direction-text');
        this.healthBar = document.getElementById('health-bar');
        this.healthText = document.getElementById('health-text');
        this.angleText = document.getElementById('angle-text');
        
        // Verificar que todos los elementos existen
        if (!this.reloadText || !this.directionText || !this.healthBar || 
            !this.healthText || !this.angleText) {
            console.error('Error: Some UI elements were not found in the HTML');
        }
        
        // Actualizar inmediatamente la información de salud
        this.updateHealthIndicator(this.character.health);
    }

    updateCannonIndicators(angleToCamera) {
        // Solo actualizar si existen los elementos UI
        if (!this.reloadText || !this.directionText || !this.angleText) {
            return;
        }
        
        if (!this.character.cannonReady) {
            const remainingTime = Math.max(0, (this.character.cannonCooldown - this.character.cannonTimer) / 1000).toFixed(1);
            this.reloadText.textContent = `Reloading: ${remainingTime}s`;
            this.reloadText.classList.add('reload-active');
        } else {
            this.reloadText.textContent = 'Cannon ready';
            this.reloadText.classList.remove('reload-active');
        }

        const frontRestrictedAngle = Math.PI / 4;
        const backRestrictedAngle = Math.PI / 3;
        const isInFrontRestriction = Math.abs(angleToCamera) < frontRestrictedAngle / 2;
        const isInBackRestriction = Math.abs(Math.abs(angleToCamera) - Math.PI) < backRestrictedAngle / 2;

        if (isInFrontRestriction) {
            this.directionText.textContent = 'Cannot fire at bow';
            this.directionText.classList.add('direction-invalid');
            this.directionText.classList.remove('direction-valid');
        } else if (isInBackRestriction) {
            this.directionText.textContent = 'Cannot fire at stern';
            this.directionText.classList.add('direction-invalid');
            this.directionText.classList.remove('direction-valid');
        } else {
            this.directionText.textContent = 'Valid direction';
            this.directionText.classList.remove('direction-invalid');
            this.directionText.classList.add('direction-valid');
        }
        
        // Actualizar el indicador del ángulo del cañón
        if (this.angleText) {
            // Convertir el ángulo de radianes a grados para mejor legibilidad
            const angleInDegrees = (this.character.cannonAngle * 180 / Math.PI).toFixed(1);
            this.angleText.textContent = `Cannon angle: ${angleInDegrees}°`;
            
            // Código de color según el ángulo (más cerca del máximo/mínimo = diferente color)
            const minAngle = Math.PI / 60;
            const maxAngle = Math.PI / 25;
            const normalizedAngle = (this.character.cannonAngle - minAngle) / (maxAngle - minAngle);
            
            // Eliminar clases existentes de color
            this.angleText.classList.remove('angle-low', 'angle-medium', 'angle-high');
            
            // Color desde verde (bajo/lejano) hasta rojo (alto/cercano)
            if (normalizedAngle < 0.33) {
                this.angleText.classList.add('angle-low'); // Verde para ángulos bajos (disparos lejanos)
            } else if (normalizedAngle < 0.66) {
                this.angleText.classList.add('angle-medium'); // Amarillo para ángulos medios
            } else {
                this.angleText.classList.add('angle-high'); // Naranja para ángulos altos (disparos cercanos)
            }
        }
    }
    
    // Actualizar el indicador de salud
    updateHealthIndicator(health) {
        if (!this.healthBar || !this.healthText) {
            this.initializeUI();
        }
        
        if (!this.healthBar || !this.healthText) return;
        
        const percentage = Math.max(0, Math.min(100, health)) / 100;
        this.healthBar.style.width = `${percentage * 100}%`;
        this.healthText.textContent = `${Math.round(health)} / 100`;
        
        // Eliminar clases existentes
        this.healthBar.classList.remove('health-high', 'health-medium', 'health-low');
        
        // Cambiar el color según el nivel de salud
        if (percentage > 0.6) {
            this.healthBar.style.backgroundColor = '#00cc00'; // Verde
        } else if (percentage > 0.3) {
            this.healthBar.style.backgroundColor = '#cccc00'; // Amarillo
        } else {
            this.healthBar.style.backgroundColor = '#cc0000'; // Rojo
        }
    }
} 
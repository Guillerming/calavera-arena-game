export class CharacterUI {
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
        this.cameraAngleIndicator = null;
    }

    createCannonIndicators() {
        const indicatorContainer = document.createElement('div');
        indicatorContainer.style.position = 'fixed';
        indicatorContainer.style.bottom = '30%';
        indicatorContainer.style.left = '50%';
        indicatorContainer.style.transform = 'translateX(-50%)';
        indicatorContainer.style.padding = '10px';
        indicatorContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        indicatorContainer.style.borderRadius = '5px';
        indicatorContainer.style.display = 'flex';
        indicatorContainer.style.gap = '10px';
        indicatorContainer.style.alignItems = 'center';
        indicatorContainer.style.fontFamily = 'Arial, sans-serif';
        indicatorContainer.style.color = 'white';
        indicatorContainer.style.userSelect = 'none';

        this.reloadIndicator = document.createElement('div');
        this.reloadIndicator.style.display = 'flex';
        this.reloadIndicator.style.alignItems = 'center';
        this.reloadIndicator.style.gap = '5px';
        
        const reloadIcon = document.createElement('div');
        reloadIcon.innerHTML = '🔄';
        reloadIcon.style.fontSize = '20px';
        this.reloadIndicator.appendChild(reloadIcon);
        
        this.reloadText = document.createElement('span');
        this.reloadText.textContent = 'Cannon ready';
        this.reloadText.style.minWidth = '100px';
        this.reloadIndicator.appendChild(this.reloadText);
        
        this.directionIndicator = document.createElement('div');
        this.directionIndicator.style.display = 'flex';
        this.directionIndicator.style.alignItems = 'center';
        this.directionIndicator.style.gap = '5px';
        
        const directionIcon = document.createElement('div');
        directionIcon.innerHTML = '🎯';
        directionIcon.style.fontSize = '20px';
        this.directionIndicator.appendChild(directionIcon);
        
        this.directionText = document.createElement('span');
        this.directionText.textContent = 'Valid direction';
        this.directionText.style.minWidth = '120px';
        this.directionIndicator.appendChild(this.directionText);
        
        // Añadir indicador de ángulo del cañón
        const angleIndicator = document.createElement('div');
        angleIndicator.style.display = 'flex';
        angleIndicator.style.alignItems = 'center';
        angleIndicator.style.gap = '5px';
        
        const angleIcon = document.createElement('div');
        angleIcon.innerHTML = '📐';
        angleIcon.style.fontSize = '20px';
        angleIndicator.appendChild(angleIcon);
        
        this.angleText = document.createElement('span');
        this.angleText.textContent = 'Angle: default';
        this.angleText.style.minWidth = '100px';
        angleIndicator.appendChild(this.angleText);

        indicatorContainer.appendChild(this.reloadIndicator);
        indicatorContainer.appendChild(this.directionIndicator);
        indicatorContainer.appendChild(angleIndicator);

        document.body.appendChild(indicatorContainer);
        
        // Crear indicador del ángulo de la cámara en la esquina
        this.createCameraAngleIndicator();
    }
    
    // Crear indicador del ángulo de la cámara (rotationX)
    createCameraAngleIndicator() {
        // Contenedor para el indicador del ángulo de la cámara
        this.cameraAngleIndicator = document.createElement('div');
        this.cameraAngleIndicator.style.position = 'fixed';
        this.cameraAngleIndicator.style.top = '10px';
        this.cameraAngleIndicator.style.right = '10px';
        this.cameraAngleIndicator.style.padding = '10px';
        this.cameraAngleIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.cameraAngleIndicator.style.color = 'white';
        this.cameraAngleIndicator.style.fontFamily = 'monospace';
        this.cameraAngleIndicator.style.fontSize = '14px';
        this.cameraAngleIndicator.style.borderRadius = '5px';
        this.cameraAngleIndicator.style.zIndex = '1000';
        document.body.appendChild(this.cameraAngleIndicator);
    }

    updateCannonIndicators(angleToCamera) {
        if (!this.character.cannonReady) {
            const remainingTime = Math.max(0, (this.character.cannonCooldown - this.character.cannonTimer) / 1000).toFixed(1);
            this.reloadText.textContent = `Reloading: ${remainingTime}s`;
            this.reloadText.style.color = '#ff9900';
        } else {
            this.reloadText.textContent = 'Cannon ready';
            this.reloadText.style.color = '#00ff00';
        }

        const frontRestrictedAngle = Math.PI / 4;
        const backRestrictedAngle = Math.PI / 3;
        const isInFrontRestriction = Math.abs(angleToCamera) < frontRestrictedAngle / 2;
        const isInBackRestriction = Math.abs(Math.abs(angleToCamera) - Math.PI) < backRestrictedAngle / 2;

        if (isInFrontRestriction) {
            this.directionText.textContent = 'Cannot fire at bow';
            this.directionText.style.color = '#ff0000';
        } else if (isInBackRestriction) {
            this.directionText.textContent = 'Cannot fire at stern';
            this.directionText.style.color = '#ff0000';
        } else {
            this.directionText.textContent = 'Valid direction';
            this.directionText.style.color = '#00ff00';
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
            
            // Color desde verde (bajo/lejano) hasta rojo (alto/cercano)
            if (normalizedAngle < 0.33) {
                this.angleText.style.color = '#00ff00'; // Verde para ángulos bajos (disparos lejanos)
            } else if (normalizedAngle < 0.66) {
                this.angleText.style.color = '#ffff00'; // Amarillo para ángulos medios
            } else {
                this.angleText.style.color = '#ff9900'; // Naranja para ángulos altos (disparos cercanos)
            }
        }
        
        // Actualizar el indicador del ángulo de la cámara
        if (this.cameraAngleIndicator && this.character.cameraController) {
            const cameraAngleDegrees = (this.character.cameraController.rotationX * 180 / Math.PI).toFixed(1);
            const minCameraAngle = -25; // Nivel del mar (-25°)
            const inflectionPoint = 0;   // Punto de inflexión (0°)
            this.cameraAngleIndicator.textContent = `Ángulo cámara: ${cameraAngleDegrees}° (rango: ${minCameraAngle}° a ${inflectionPoint}°)`;
            
            // Colorear según si está dentro o fuera del rango de interpolación
            if (this.character.cameraController.rotationX >= -25 * Math.PI / 180 && 
                this.character.cameraController.rotationX <= 0) {
                this.cameraAngleIndicator.style.color = '#00ffff'; // Cyan para valores en el rango de interpolación
            } else if (this.character.cameraController.rotationX > 0) {
                this.cameraAngleIndicator.style.color = '#ff00ff'; // Magenta para valores por encima del punto de inflexión
            } else {
                this.cameraAngleIndicator.style.color = '#ff5555'; // Rojo claro para valores por debajo del mínimo
            }
        }
    }
    
    // Crear indicador de salud
    createHealthIndicator() {
        const healthContainer = document.createElement('div');
        healthContainer.style.position = 'fixed';
        healthContainer.style.top = '20px';
        healthContainer.style.left = '20px';
        healthContainer.style.padding = '10px';
        healthContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        healthContainer.style.borderRadius = '5px';
        healthContainer.style.display = 'flex';
        healthContainer.style.flexDirection = 'column';
        healthContainer.style.gap = '5px';
        healthContainer.style.fontFamily = 'Arial, sans-serif';
        healthContainer.style.color = 'white';
        healthContainer.style.userSelect = 'none';
        
        // Título
        const title = document.createElement('div');
        title.textContent = 'Estado del Barco';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        healthContainer.appendChild(title);
        
        // Contenedor de la barra de salud
        const barContainer = document.createElement('div');
        barContainer.style.width = '200px';
        barContainer.style.height = '20px';
        barContainer.style.backgroundColor = '#333';
        barContainer.style.borderRadius = '3px';
        barContainer.style.overflow = 'hidden';
        barContainer.style.position = 'relative';
        
        // Barra de salud
        this.healthBar = document.createElement('div');
        this.healthBar.style.width = '100%';
        this.healthBar.style.height = '100%';
        this.healthBar.style.backgroundColor = '#00cc00';
        this.healthBar.style.transition = 'width 0.3s, background-color 0.3s';
        barContainer.appendChild(this.healthBar);

        // Texto de salud
        this.healthText = document.createElement('div');
        this.healthText.style.position = 'absolute';
        this.healthText.style.top = '0';
        this.healthText.style.left = '0';
        this.healthText.style.width = '100%';
        this.healthText.style.height = '100%';
        this.healthText.style.display = 'flex';
        this.healthText.style.justifyContent = 'center';
        this.healthText.style.alignItems = 'center';
        this.healthText.style.color = 'white';
        this.healthText.style.fontWeight = 'bold';
        this.healthText.style.textShadow = '1px 1px 2px black';
        this.healthText.textContent = '100 / 100';
        barContainer.appendChild(this.healthText);
        
        healthContainer.appendChild(barContainer);
        document.body.appendChild(healthContainer);
        
        // Actualizar la barra de salud inicialmente
        this.updateHealthIndicator(this.character.health);
    }
    
    // Actualizar el indicador de salud
    updateHealthIndicator(health) {
        if (!this.healthBar || !this.healthText) {
            this.createHealthIndicator();
        }
        
        const percentage = Math.max(0, Math.min(100, health)) / 100;
        this.healthBar.style.width = `${percentage * 100}%`;
        this.healthText.textContent = `${Math.round(health)} / 100`;
        
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
import * as THREE from 'three';

export class SpeedIndicator {
    constructor() {
        this.initialize();
    }

    initialize() {
        // Obtener referencias a los elementos existentes en el HTML
        this.container = document.getElementById('speed-container');
        if (!this.container) {
            console.error('No se encontró el contenedor de velocidad en el HTML');
            return;
        }

        // Obtener referencias a las barras individuales
        this.bars = [];
        for (let i = 1; i <= 6; i++) {
            const bar = document.getElementById(`speed-bar-${i}`);
            if (bar) {
                this.bars.push(bar);
            } else {
                console.error(`No se encontró la barra de velocidad #${i}`);
            }
        }
        
        // Verificar que tenemos todas las barras
        if (this.bars.length !== 6) {
            console.error(`Se esperaban 6 barras de velocidad, se encontraron ${this.bars.length}`);
        }
    }

    update(currentSpeed, maxSpeed, minSpeed) {
        // Si no tenemos barras, no podemos actualizar
        if (!this.bars || this.bars.length === 0) {
            return;
        }
        
        // Convertir la velocidad actual a un porcentaje (-20 a 100)
        const speedRange = maxSpeed - minSpeed;
        const speedPercentage = ((currentSpeed - minSpeed) / speedRange) * 120 - 20;

        // Actualizar cada barra
        this.bars.forEach((bar, index) => {
            // Calcular el umbral de activación para esta barra
            // Invertimos el índice para que la barra 1 (index 0) sea la primera en activarse
            const threshold = -20 + ((5 - index) * 20); // 80, 60, 40, 20, 0, -20

            // Activar la barra si la velocidad supera su umbral
            if (speedPercentage >= threshold) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    }
}
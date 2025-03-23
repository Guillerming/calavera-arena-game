import * as THREE from 'three';

export class SpeedIndicator {
    constructor() {
        this.createSpeedBars();
    }

    createSpeedBars() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.left = '20px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '4px';
        container.style.zIndex = '1000';

        this.bars = [];
        const barCount = 6;
        const maxWidth = 100;
        const minWidth = 40;

        // Crear las barras de abajo a arriba (A a F)
        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('div');
            const width = maxWidth - ((maxWidth - minWidth) * (i / (barCount - 1)));
            bar.style.width = `${width}px`;
            bar.style.height = '8px';
            bar.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; // Blanco traslúcido
            bar.style.borderRadius = '4px';
            bar.style.transition = 'background-color 0.2s ease';
            container.appendChild(bar);
            this.bars.push(bar);
        }

        document.body.appendChild(container);
    }

    update(currentSpeed, maxSpeed, minSpeed) {
        // Convertir la velocidad actual a un porcentaje (-20 a 100)
        const speedRange = maxSpeed - minSpeed;
        const speedPercentage = ((currentSpeed - minSpeed) / speedRange) * 120 - 20;

        // Actualizar cada barra
        this.bars.forEach((bar, index) => {
            // Calcular el umbral de activación para esta barra
            // Invertimos el índice para que la barra A (index 0) sea la primera en activarse
            const threshold = -20 + ((5 - index) * 20); // 80, 60, 40, 20, 0, -20

            // Activar la barra si la velocidad supera su umbral
            if (speedPercentage >= threshold) {
                bar.style.backgroundColor = 'rgba(10, 255, 30, 1)'; // Verde
            } else {
                bar.style.backgroundColor = 'rgba(255,255,255,.1)'; // Blanco traslúcido
            }
        });
    }
}
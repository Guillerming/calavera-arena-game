import { FogDemo } from './FogDemo.js';

// Iniciar la demostración de niebla volumétrica
document.addEventListener('DOMContentLoaded', () => {
    const demo = new FogDemo();
    
    // Crear título de la demostración
    const title = document.createElement('h1');
    title.textContent = 'Demostración de Niebla Volumétrica con Three.js';
    title.style.position = 'absolute';
    title.style.top = '10px';
    title.style.right = '10px';
    title.style.color = 'white';
    title.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.7)';
    title.style.fontFamily = 'Arial, sans-serif';
    title.style.margin = '0';
    title.style.padding = '10px';
    document.body.appendChild(title);
    
    // Instrucciones
    const instructions = document.createElement('div');
    instructions.style.position = 'absolute';
    instructions.style.bottom = '10px';
    instructions.style.right = '10px';
    instructions.style.color = 'white';
    instructions.style.textShadow = '1px 1px 3px rgba(0, 0, 0, 0.7)';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.padding = '10px';
    instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    instructions.style.borderRadius = '5px';
    instructions.innerHTML = '<p>Usa las teclas WASD para moverte</p><p>Ratón para mirar alrededor</p>';
    document.body.appendChild(instructions);
}); 
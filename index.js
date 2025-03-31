import { Game } from './src/game.js';

// Crear instancia del juego y guardarla como referencia global
const game = new Game();
window.game = game; // Hacer la instancia accesible globalmente

// Iniciar el juego
game.start(); 
export class InputManager {
    constructor() {
        this.keys = new Map();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseDelta = { x: 0, y: 0 };
        this.isPointerLocked = false;
        this.init();
    }

    init() {
        // Eliminar posibles event listeners antiguos
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousemove', this.onMouseMove);
        
        // Asegurarnos de que 'this' se refiere a esta instancia
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        
        // Registrar nuevos event listeners
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousemove', this.onMouseMove);
        
        console.log("InputManager: Eventos de teclado y ratón inicializados");
        
        // Añadir control de bloqueo del puntero
        document.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement !== null;
        });
    }

    onKeyDown(event) {
        if (!event.repeat) {
            this.keys.set(event.code, true);
            console.log(`Tecla presionada: ${event.code}`);
        }
    }

    onKeyUp(event) {
        this.keys.set(event.code, false);
        console.log(`Tecla liberada: ${event.code}`);
    }

    onMouseMove(event) {
        if (this.isPointerLocked) {
            this.mouseDelta.x = event.movementX || 0;
            this.mouseDelta.y = event.movementY || 0;
        }
    }

    resetMouseDelta() {
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }

    isKeyPressed(keyCode) {
        const isPressed = this.keys.get(keyCode) || false;
        // Mostrar solo para las teclas de movimiento para evitar spam en la consola
        if (keyCode === 'KeyW' || keyCode === 'KeyS') {
            console.log(`Tecla ${keyCode}: ${isPressed ? 'presionada' : 'no presionada'}`);
        }
        return isPressed;
    }
    
    update() {
        // Reiniciar el delta del ratón después de cada frame
        this.resetMouseDelta();
    }
} 
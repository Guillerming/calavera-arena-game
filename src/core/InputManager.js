export class InputManager {
    constructor() {
        this.keys = new Map();
        this.mouseButtons = new Map();
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
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        
        // Asegurarnos de que 'this' se refiere a esta instancia
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        
        // Registrar nuevos event listeners
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        
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
        }
    }

    onKeyUp(event) {
        this.keys.set(event.code, false);
    }

    onMouseMove(event) {
        if (this.isPointerLocked) {
            this.mouseDelta.x = event.movementX || 0;
            this.mouseDelta.y = event.movementY || 0;
        }
    }
    
    onMouseDown(event) {
        this.mouseButtons.set(event.button, true);
    }
    
    onMouseUp(event) {
        this.mouseButtons.set(event.button, false);
    }

    resetMouseDelta() {
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }

    isKeyPressed(keyCode) {
        return this.keys.get(keyCode) || false;
    }
    
    isMouseButtonPressed(button) {
        return this.mouseButtons.get(button) || false;
    }
    
    update() {
        // Reiniciar el delta del ratón después de cada frame
        this.resetMouseDelta();
    }
}
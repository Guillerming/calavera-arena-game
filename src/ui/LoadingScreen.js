export class LoadingScreen {
    constructor(onComplete) {
        this.onComplete = onComplete || (() => {});
        
        // Obtener referencia al elemento de pantalla de carga ya existente en el HTML
        this.element = document.getElementById('loading-screen');
        
        if (!this.element) {
            console.error('Error: The loading-screen element was not found in the HTML');
            return;
        }
        
        // Manejar el envío del formulario
        const playerForm = this.element.querySelector('#player-form');
        if (playerForm) {
            playerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = this.element.querySelector('#player-name').value.trim();
                if (name) {
                    localStorage.setItem('playerName', name);
                    this.hide();
                    this.onComplete(name);
                }
            });
        } else {
            console.error('Error: The player form was not found in the HTML');
        }

        // Cargar nombre guardado si existe
        const playerNameInput = this.element.querySelector('#player-name');
        if (playerNameInput) {
            const savedName = localStorage.getItem('playerName');
            if (savedName) {
                playerNameInput.value = savedName;
            }
        }
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
} 
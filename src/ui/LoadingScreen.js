export class LoadingScreen {
    constructor(onComplete) {
        this.onComplete = onComplete || (() => {});
        
        // Obtener referencia al elemento de pantalla de carga ya existente en el HTML
        this.element = document.getElementById('loading-screen');
        
        if (!this.element) {
            console.error('Error: The loading-screen element was not found in the HTML');
            return;
        }
        
        // Buscar el elemento de mensaje de carga si existe
        this.loadingMessageElement = this.element.querySelector('.loading-message') || null;
        
        // Crear uno si no existe
        if (!this.loadingMessageElement) {
            this.loadingMessageElement = document.createElement('div');
            this.loadingMessageElement.className = 'loading-message';
            this.loadingMessageElement.style.marginTop = '10px';
            this.loadingMessageElement.style.color = '#fff';
            this.loadingMessageElement.style.textAlign = 'center';
            
            // Añadirlo al elemento principal (preferiblemente después del formulario)
            const form = this.element.querySelector('#player-form');
            if (form) {
                form.after(this.loadingMessageElement);
            } else {
                this.element.appendChild(this.loadingMessageElement);
            }
        }
        
        // Manejar el envío del formulario
        const playerForm = this.element.querySelector('#player-form');
        if (playerForm) {
            playerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = this.element.querySelector('#player-name').value.trim();
                if (name) {
                    localStorage.setItem('playerName', name);
                    
                    // No ocultar pantalla de carga inmediatamente para mostrar progreso de precarga
                    this.showLoadingMessage('Cargando recursos del juego...');
                    
                    // Llamar al callback con el nombre
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
    
    // Mostrar mensaje en la pantalla de carga
    showLoadingMessage(message) {
        if (this.loadingMessageElement) {
            this.loadingMessageElement.textContent = message;
        }
    }
    
    // Actualizar el progreso de carga (0-100)
    updateProgress(percent, message = null) {
        if (message) {
            this.showLoadingMessage(message);
        }
        
        // Si hay una barra de progreso, actualizarla
        const progressBar = this.element.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
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
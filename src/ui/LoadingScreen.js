export class LoadingScreen {
    constructor(onComplete) {
        this.onComplete = onComplete || (() => {});
        this.element = document.createElement('div');
        this.element.className = 'loading-screen';
        this.element.innerHTML = `
            <div class="loading-content">
                <div class="skull">💀</div>
                <h1>Calavera Arena</h1>
                <form id="player-form" class="player-form">
                    <input type="text" id="player-name" placeholder="Tu nombre" required>
                    <button type="submit">Join</button>
                </form>
            </div>
        `;

        // Añadir estilos
        const style = document.createElement('style');
        style.textContent = `
            .loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                color: #fff;
                font-family: Arial, sans-serif;
            }

            .loading-content {
                text-align: center;
            }

            .skull {
                font-size: 120px;
                margin-bottom: 20px;
                animation: float 3s ease-in-out infinite;
            }

            h1 {
                font-size: 48px;
                margin-bottom: 30px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }

            .player-form {
                display: flex;
                flex-direction: column;
                gap: 15px;
                align-items: center;
            }

            input {
                padding: 10px 20px;
                font-size: 18px;
                border: 2px solid #fff;
                background: transparent;
                color: #fff;
                border-radius: 5px;
                width: 200px;
            }

            input::placeholder {
                color: rgba(255,255,255,0.7);
            }

            button {
                padding: 10px 30px;
                font-size: 18px;
                background: #fff;
                color: #000;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            button:hover {
                background: #ddd;
                transform: scale(1.05);
            }

            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-20px); }
                100% { transform: translateY(0px); }
            }
        `;
        document.head.appendChild(style);

        // Manejar el envío del formulario
        this.element.querySelector('#player-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = this.element.querySelector('#player-name').value.trim();
            if (name) {
                localStorage.setItem('playerName', name);
                this.hide();
                this.onComplete(name);
            }
        });

        // Cargar nombre guardado si existe
        const savedName = localStorage.getItem('playerName');
        if (savedName) {
            this.element.querySelector('#player-name').value = savedName;
        }
    }

    show() {
        document.body.appendChild(this.element);
    }

    hide() {
        this.element.remove();
    }
} 
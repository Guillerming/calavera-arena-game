export class CharacterUI {
    constructor(character) {
        this.character = character;
        this.reloadIndicator = null;
        this.reloadText = null;
        this.directionIndicator = null;
        this.directionText = null;
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

        indicatorContainer.appendChild(this.reloadIndicator);
        indicatorContainer.appendChild(this.directionIndicator);

        document.body.appendChild(indicatorContainer);
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
    }
} 
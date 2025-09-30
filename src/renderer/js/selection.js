document.addEventListener('DOMContentLoaded', () => {
  // Éléments de l'interface
  const gameMode = document.getElementById('game-mode');
  const viewCount = document.getElementById('view-count');
  const viewCountValue = document.getElementById('view-count-value');
  const startButton = document.getElementById('start-button');
  
  // Mettre à jour l'affichage du nombre de vues
  viewCount.addEventListener('input', () => {
    viewCountValue.textContent = viewCount.value;
  });
  
  // Lancer la session lorsque le bouton est cliqué
  startButton.addEventListener('click', () => {
    // Version simplifiée - seulement le nombre de vues et le mode
    const config = {
      mode: gameMode.value,
      viewCount: parseInt(viewCount.value)
    };
    
    // Animer le bouton pour montrer le clic
    startButton.classList.add('clicked');
    
    // Envoyer uniquement les config de base au processus principal
    window.electronAPI.startSession(config);
    
    // Réinitialiser l'animation du bouton après un délai
    setTimeout(() => {
      startButton.classList.remove('clicked');
    }, 300);
  });
  
  // Animation supplémentaire pour les étoiles
  function createRandomStars() {
    const starsContainer = document.querySelector('.stars-container');
    
    if (!starsContainer) return;
    
    for (let i = 0; i < 20; i++) {
      const shootingStar = document.createElement('div');
      shootingStar.classList.add('shooting-star');
      
      // Positionner aléatoirement les étoiles filantes
      const startX = Math.random() * window.innerWidth;
      const startY = Math.random() * window.innerHeight;
      const angle = Math.random() * 45 + 15; // Angle entre 15 et 60 degrés
      
      shootingStar.style.left = `${startX}px`;
      shootingStar.style.top = `${startY}px`;
      shootingStar.style.transform = `rotate(${angle}deg)`;
      
      // Durée aléatoire pour l'animation
      const duration = Math.random() * 2 + 1;
      shootingStar.style.animationDuration = `${duration}s`;
      
      // Délai aléatoire pour l'animation
      const delay = Math.random() * 10;
      shootingStar.style.animationDelay = `${delay}s`;
      
      starsContainer.appendChild(shootingStar);
    }
  }
  
  createRandomStars();
}); 
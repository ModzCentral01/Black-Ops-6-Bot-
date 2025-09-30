document.addEventListener('DOMContentLoaded', () => {
  // Éléments de l'interface
  const syncScrollToggle = document.getElementById('sync-scroll-toggle');
  const backBtn = document.getElementById('back-btn');
  const viewCountDisplay = document.getElementById('view-count-display');
  const macroBtn = document.getElementById('macro-btn');
  const macroStatus = document.getElementById('macro-status');

  // État de l'application
  let syncEnabled = true;
  let macroEnabled = false;
  
  // Mettre à jour le compteur de vues lors de la réception des informations
  window.electronAPI.onUpdateViewCount((event, count) => {
    viewCountDisplay.textContent = `Vues: ${count}`;
  });
  
  // Activer/désactiver la synchronisation du défilement
  syncScrollToggle.addEventListener('click', () => {
    syncEnabled = !syncEnabled;
    
    if (syncEnabled) {
      syncScrollToggle.textContent = 'Désactiver Sync';
      syncScrollToggle.classList.remove('disabled');
    } else {
      syncScrollToggle.textContent = 'Activer Sync';
      syncScrollToggle.classList.add('disabled');
    }
    
    // Envoyer l'état de synchronisation au processus principal
    // (cette fonctionnalité devrait être ajoutée à l'API préchargée)
  });
  
  // Gérer le bouton de macro
  macroBtn.addEventListener('click', () => {
    macroEnabled = !macroEnabled;
    
    // Mettre à jour l'interface
    if (macroEnabled) {
      macroBtn.classList.add('active');
      macroStatus.classList.add('active');
      macroStatus.textContent = 'ON';
    } else {
      macroBtn.classList.remove('active');
      macroStatus.classList.remove('active');
      macroStatus.textContent = 'OFF';
    }
    
    // Envoyer la commande au processus principal
    window.electronAPI.toggleMacro(macroEnabled);
  });
  
  // Écouter les changements d'état de la macro
  window.electronAPI.onMacroStatusChange((event, status) => {
    macroEnabled = status.enabled;
    
    // Mettre à jour l'interface
    if (macroEnabled) {
      macroBtn.classList.add('active');
      macroStatus.classList.add('active');
      macroStatus.textContent = 'ON';
    } else {
      macroBtn.classList.remove('active');
      macroStatus.classList.remove('active');
      macroStatus.textContent = 'OFF';
    }
  });
  
  // Revenir à la fenêtre de sélection
  backBtn.addEventListener('click', () => {
    // Fermer la fenêtre actuelle - la fenêtre de sélection réapparaîtra
    window.close();
  });
}); 
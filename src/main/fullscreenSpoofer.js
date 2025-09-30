/**
 * FullScreen Spoofer amélioré pour applications Electron avec BrowserViews
 * 
 * Ce script simule les API fullscreen et pointer lock du navigateur même quand
 * l'application est en mode fenêtré. Il permet aux jeux en ligne et applications
 * HTML5 de fonctionner correctement dans des BrowserViews sans avoir besoin de passer
 * en mode plein écran réel.
 */

// Script à injecter dans chaque BrowserView
const FullScreenSpooferScript = `
(function() {
  console.log('Initialisation du FullScreen Spoofer...');
  
  // Stocker l'état de plein écran et des pointeurs
  var _fullscreenElement = null;
  var _pointerLockElement = null;
  var _originalWindowSize = { width: window.innerWidth, height: window.innerHeight };
  
  // ---- SIMULATION PRECOCE POUR CAPTURER LES VÉRIFICATIONS AU CHARGEMENT ---- //
  
  // Simuler immédiatement que le document est en mode plein écran
  // Cela aidera avec les jeux qui vérifient l'état au chargement
  _fullscreenElement = document.documentElement;
  
  // Simuler l'événement de changement d'état pour déclencher les détections
  setTimeout(() => {
    const event = new Event('fullscreenchange');
    document.dispatchEvent(event);
    const webkitEvent = new Event('webkitfullscreenchange');
    document.dispatchEvent(webkitEvent);
  }, 0);
  
  // ---- INTERCEPTION DES TESTS INITIAUX ---- //
  
  // Tests courants que les jeux effectuent au démarrage
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = function(query) {
    // Intercepter les requêtes liées au fullscreen
    if (query.includes('fullscreen') || query.includes('max-width') || query.includes('max-height')) {
      console.log('Requête matchMedia interceptée:', query);
      return {
        matches: query.includes('fullscreen'),
        addEventListener: function() {},
        removeEventListener: function() {},
        addListener: function() {},
        removeListener: function() {},
        media: query
      };
    }
    return originalMatchMedia.apply(this, arguments);
  };
  
  // ---- GESTION DU FULLSCREEN ---- //
  
  // Fonction helper pour créer/dispatcher des événements
  function dispatchCustomEvent(eventName, target) {
    const event = new Event(eventName);
    (target || document).dispatchEvent(event);
    
    // Essayer avec le préfixe webkit aussi
    if (eventName === 'fullscreenchange') {
      const webkitEvent = new Event('webkitfullscreenchange');
      (target || document).dispatchEvent(webkitEvent);
    }
    
    // Essayer les événements visibilitychange aussi
    if (eventName === 'fullscreenchange') {
      const visEvent = new Event('visibilitychange');
      document.dispatchEvent(visEvent);
    }
  }
  
  // Remplacer requestFullscreen et toutes ses variantes préfixées
  const requestFullscreenImplementation = function() {
    console.log('Simulation fullscreen pour:', this);
    _fullscreenElement = this;
    
    // Simuler l'événement
    setTimeout(() => {
      dispatchCustomEvent('fullscreenchange');
    }, 10);
    
    return Promise.resolve();
  };
  
  Element.prototype.requestFullscreen = requestFullscreenImplementation;
  Element.prototype.webkitRequestFullscreen = requestFullscreenImplementation;
  Element.prototype.mozRequestFullScreen = requestFullscreenImplementation;
  Element.prototype.msRequestFullscreen = requestFullscreenImplementation;
  
  // Remplacer exitFullscreen et toutes ses variantes préfixées
  const exitFullscreenImplementation = function() {
    _fullscreenElement = null;
    
    // Simuler l'événement
    setTimeout(() => {
      dispatchCustomEvent('fullscreenchange');
    }, 10);
    
    return Promise.resolve();
  };
  
  Document.prototype.exitFullscreen = exitFullscreenImplementation;
  Document.prototype.webkitExitFullscreen = exitFullscreenImplementation;
  Document.prototype.mozCancelFullScreen = exitFullscreenImplementation;
  Document.prototype.msExitFullscreen = exitFullscreenImplementation;
  
  // Remplacer la propriété fullscreenElement et ses variantes
  Object.defineProperty(Document.prototype, 'fullscreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitFullscreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'mozFullScreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'msFullscreenElement', {
    get: function() { return _fullscreenElement; },
    configurable: true
  });
  
  // État du fullscreen
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'mozFullScreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'msFullscreenEnabled', {
    get: function() { return true; },
    configurable: true
  });
  
  // Support pour webkitIsFullScreen
  Object.defineProperty(Document.prototype, 'webkitIsFullScreen', {
    get: function() { return _fullscreenElement !== null; },
    configurable: true
  });
  
  // Intercepter la propriété fullscreen du document
  // Certains jeux vérifient cette propriété
  Object.defineProperty(document, 'fullscreen', {
    get: function() { return _fullscreenElement !== null; },
    configurable: true
  });
  
  // Intercepter la détection de plein écran basée sur la taille de fenêtre
  Object.defineProperty(window, 'outerWidth', {
    get: function() { return window.screen.width; },
    configurable: true
  });
  
  Object.defineProperty(window, 'outerHeight', {
    get: function() { return window.screen.height; },
    configurable: true
  });
  
  // ---- GESTION DU POINTER LOCK ---- //
  
  // Remplacer requestPointerLock
  Element.prototype.requestPointerLock = function() {
    console.log('Simulation pointer lock pour:', this);
    _pointerLockElement = this;
    
    // Simuler l'événement
    setTimeout(() => {
      dispatchCustomEvent('pointerlockchange');
    }, 10);
  };
  
  Element.prototype.mozRequestPointerLock = Element.prototype.requestPointerLock;
  Element.prototype.webkitRequestPointerLock = Element.prototype.requestPointerLock;
  
  // Remplacer exitPointerLock
  Document.prototype.exitPointerLock = function() {
    _pointerLockElement = null;
    
    // Simuler l'événement
    setTimeout(() => {
      dispatchCustomEvent('pointerlockchange');
    }, 10);
  };
  
  Document.prototype.mozExitPointerLock = Document.prototype.exitPointerLock;
  Document.prototype.webkitExitPointerLock = Document.prototype.exitPointerLock;
  
  // Remplacer la propriété pointerLockElement
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    get: function() { return _pointerLockElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'mozPointerLockElement', {
    get: function() { return _pointerLockElement; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitPointerLockElement', {
    get: function() { return _pointerLockElement; },
    configurable: true
  });
  
  // ---- AMÉLIORATION DE LA VISIBILITÉ ---- //
  
  // Forcer l'état visible pour éviter la mise en pause des jeux
  Object.defineProperty(Document.prototype, 'hidden', {
    get: function() { return false; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitHidden', {
    get: function() { return false; },
    configurable: true
  });
  
  // Forcer l'état visibilityState
  Object.defineProperty(Document.prototype, 'visibilityState', {
    get: function() { return 'visible'; },
    configurable: true
  });
  
  Object.defineProperty(Document.prototype, 'webkitVisibilityState', {
    get: function() { return 'visible'; },
    configurable: true
  });
  
  // Empêcher les événements de visibilitychange
  document.addEventListener('visibilitychange', function(e) {
    e.stopPropagation();
    e.preventDefault();
  }, true);
  
  document.addEventListener('webkitvisibilitychange', function(e) {
    e.stopPropagation();
    e.preventDefault();
  }, true);
  
  // ---- ÉMULATION DU FOCUS ---- //
  
  // Garder le focus même si la fenêtre n'est pas active
  Object.defineProperty(document, 'hasFocus', {
    value: function() { return true; },
    configurable: true
  });
  
  // Simuler que le document est toujours actif
  Object.defineProperty(document, 'activeElement', {
    get: function() {
      return _pointerLockElement || document.body || document.documentElement;
    },
    configurable: true
  });
  
  // Overrider blur/focus pour les éléments
  const originalBlur = HTMLElement.prototype.blur;
  HTMLElement.prototype.blur = function() {
    console.log('Tentative de blur interceptée');
    // Ne pas appeler la fonction originale
  };
  
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function() {
    console.log('Focus forcé sur:', this);
    originalFocus.apply(this, arguments);
  };
  
  // ---- SIMULATION DE L'ÉCRAN PLEIN ---- //
  
  // Fonction pour mettre à jour toutes les propriétés d'écran
  function updateScreenProperties() {
    // Simuler les dimensions plein écran pour screen et window
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const screenProps = [
      'width', 'height', 'availWidth', 'availHeight',
      'availLeft', 'availTop'
    ];
    
    screenProps.forEach(prop => {
      Object.defineProperty(window.screen, prop, {
        get: function() { 
          return prop.includes('width') ? screenWidth : 
                 prop.includes('height') ? screenHeight : 0; 
        },
        configurable: true
      });
    });
    
    // Propriétés de fenêtres
    Object.defineProperty(window, 'innerWidth', {
      get: function() { return screenWidth; },
      configurable: true
    });
    
    Object.defineProperty(window, 'innerHeight', {
      get: function() { return screenHeight; },
      configurable: true
    });
    
    // Simuler les changements d'orientation pour les tablettes/mobile
    window.orientation = 0;
    window.screen.orientation = {
      angle: 0,
      type: 'landscape-primary',
      onchange: null,
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; }
    };
  }
  
  // Mettre à jour les dimensions initiales
  updateScreenProperties();
  
  // Mettre à jour les dimensions périodiquement
  setInterval(updateScreenProperties, 1000);
  
  // Mettre à jour les dimensions lors du redimensionnement de la fenêtre
  window.addEventListener('resize', updateScreenProperties);
  
  // Surveiller les changements d'état fullscreen
  document.addEventListener('fullscreenchange', updateScreenProperties);
  document.addEventListener('webkitfullscreenchange', updateScreenProperties);
  
  // ---- SUPPORT POUR L'API GAMEPAD ---- //
  
  // Assurer que navigator.getGamepads() fonctionne même si la fenêtre n'est pas focalisée
  if (navigator.getGamepads) {
    const originalGetGamepads = navigator.getGamepads;
    navigator.getGamepads = function() {
      try {
        return originalGetGamepads.apply(this, arguments);
      } catch (e) {
        console.warn('Erreur d\\'accès aux gamepads, retourne un tableau vide', e);
        return [];
      }
    };
  }
  
  // ---- GESTION DES NOTIFICATIONS ---- //
  
  // Simuler que les notifications sont toujours autorisées
  if (window.Notification) {
    Object.defineProperty(window.Notification, 'permission', {
      get: function() { return 'granted'; },
      configurable: true
    });
    
    const originalRequestPermission = window.Notification.requestPermission;
    window.Notification.requestPermission = function() {
      if (typeof originalRequestPermission === 'function') {
        try {
          return Promise.resolve('granted');
        } catch (e) {
          return Promise.resolve('granted');
        }
      } else {
        return Promise.resolve('granted');
      }
    };
  }
  
  // ---- ÉVÉNEMENTS DE DÉMARRAGE INITIAUX ---- //
  
  // Force-trigger un événement de focus pour aider les jeux qui se mettent en pause
  // lorsqu'ils détectent une perte de focus
  window.addEventListener('load', function() {
    setTimeout(() => {
      console.log('Forçage du focus initial...');
      const focusEvent = new FocusEvent('focus');
      window.dispatchEvent(focusEvent);
      document.dispatchEvent(focusEvent);
      if (document.body) document.body.dispatchEvent(focusEvent);
      
      // Déclencher un événement fullscreenchange pour aider à détecter certains jeux
      const fullscreenEvent = new Event('fullscreenchange');
      document.dispatchEvent(fullscreenEvent);
      
      // Déclencher également l'événement resize pour forcer la mise à jour des dimensions
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);
    }, 200);
  });
  
  console.log('FullScreen Spoofer activé avec succès');
})();
`;

// Exporter le script pour l'utiliser dans les BrowserViews
module.exports = {
  FullScreenSpooferScript
}; 
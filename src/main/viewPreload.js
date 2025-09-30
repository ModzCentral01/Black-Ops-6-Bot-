const { contextBridge, ipcRenderer } = require('electron');

// Debug log
console.log('[viewPreload.js] Loading APIs for views');

// Expose protected APIs for BrowserViews
contextBridge.exposeInMainWorld('electronAPI', {
  // API for scroll notification
  notifyScroll: (scrollPos) => ipcRenderer.send('sync-scroll', scrollPos),
  
  // API for synchronized movements
  updateMovementState: (state) => ipcRenderer.send('update-movement-state', state),
  
  // Receiver for state updates
  onMovementStateUpdate: (callback) => {
    ipcRenderer.on('movement-state-update', (event, state) => callback(state));
    return () => {
      ipcRenderer.removeListener('movement-state-update', callback);
    };
  },
  
  // API to notify view state
  notifyViewState: (stateData) => ipcRenderer.send('view-state-updated', stateData),
  
  // API to enable/disable audio
  toggleAudio: (enabled) => ipcRenderer.send('toggle-audio', enabled),
  
  // API to send keyboard events
  sendKeyboardEvent: (keyEvent) => ipcRenderer.send('keyboard-event', keyEvent),
  
  // API to update sync state
  onSyncStateChange: (callback) => ipcRenderer.on('sync-state-change', (event, data) => callback(data)),
  
  // Receive scroll position from main container
  onScrollPositionReceived: (callback) => ipcRenderer.on('scroll-to-position', (event, position) => callback(position))
});

// Function that will be executed after page load
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, preparing keyboard simulation functions');
  
  // Search for elements that could receive keyboard events
  const findInputTargets = () => {
    // First look for canvas (usual target for games)
    const canvas = document.querySelector('canvas');
    if (canvas) {
      console.log('Canvas found for keyboard events');
      return canvas;
    }
    
    // Look for elements that have focus
    if (document.activeElement && document.activeElement !== document.body) {
      console.log('Active element found for keyboard events');
      return document.activeElement;
    }
    
    // Look for interactive elements
    const interactiveElements = document.querySelector('button, input, textarea, [tabindex]');
    if (interactiveElements) {
      console.log('Interactive element found for keyboard events');
      return interactiveElements;
    }
    
    // Default to using body
    console.log('Using body for keyboard events');
    return document.body;
  };
  
  // Create function to inject direct events
  const injectDirectEvent = (type, key) => {
    try {
      // Target appropriate element
      const target = findInputTargets();
      
      // Get key info
      const keyInfo = getKeyInfo(key);
      
      // Create event with all necessary properties
      const event = new KeyboardEvent(type, {
        key: key,
        code: keyInfo.code,
        keyCode: keyInfo.keyCode,
        which: keyInfo.keyCode,
        bubbles: true,
        cancelable: true,
        view: window,
        composed: true
      });
      
      // Dispatch on multiple important elements
      const dispatched = target.dispatchEvent(event);
      document.dispatchEvent(event);
      window.dispatchEvent(event);
      
      console.log(`Key ${type === 'keydown' ? 'pressed' : 'released'}: ${key}`);
      return dispatched;
    } catch (e) {
      console.error(`Error sending ${type} event for ${key}:`, e);
      return false;
    }
  };
  
  // If game uses direct listeners on document/window, create our own method
  window._gameKeyHandlers = {
    pressedKeys: new Set(),
    
    simulateKeyDown: function(key) {
      if (!this.pressedKeys.has(key)) {
        this.pressedKeys.add(key);
        return injectDirectEvent('keydown', key);
      }
      return true;
    },
    
    simulateKeyUp: function(key) {
      if (this.pressedKeys.has(key)) {
        this.pressedKeys.delete(key);
        return injectDirectEvent('keyup', key);
      }
      return true;
    },
    
    clearAllKeys: function() {
      const keys = Array.from(this.pressedKeys);
      keys.forEach(key => {
        this.simulateKeyUp(key);
      });
    }
  };
  
  // Add some utility functions to help with debugging
  window.debugKeyEvents = {
    // Function to display currently pressed keys
    showPressedKeys: function() {
      console.log('Currently pressed keys:', Array.from(window._gameKeyHandlers.pressedKeys));
      return Array.from(window._gameKeyHandlers.pressedKeys);
    },
    
    // Function to test manual key press
    testKeyPress: function(key, duration = 200) {
      console.log(`Testing key press for ${key} during ${duration}ms`);
      window.pressKey(key);
      setTimeout(() => {
        window.releaseKey(key);
        console.log(`Test key release for ${key} completed`);
      }, duration);
    },
    
    // Function to test WASD keys in QWERTY
    testWASDKeys: function(delay = 500) {
      const keys = ['w', 'a', 's', 'd', ' '];
      let index = 0;
      
      const pressNextKey = () => {
        if (index < keys.length) {
          const key = keys[index];
          console.log(`Test QWERTY key: ${key}`);
          window.pressKey(key);
          
          setTimeout(() => {
            window.releaseKey(key);
            index++;
            setTimeout(pressNextKey, delay);
          }, 200);
        }
      };
      
      pressNextKey();
    }
  };
});

// Expose functions to simulate key press and release
contextBridge.exposeInMainWorld('pressKey', (key) => {
  try {
    // Try to use our special handler if it exists
    if (window._gameKeyHandlers) {
      return window._gameKeyHandlers.simulateKeyDown(key);
    }
    
    // Otherwise, use standard method
    const keyInfo = getKeyInfo(key);
    
    // Simulate key press
    const event = new KeyboardEvent('keydown', {
      key: key,
      code: keyInfo.code,
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    document.dispatchEvent(event);
    
    // Also dispatch on active document or window
    if (document.activeElement) {
      document.activeElement.dispatchEvent(event);
    } else {
      window.dispatchEvent(event);
    }
    
    console.log(`Key pressed: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error pressing key ${key}:`, error);
    return false;
  }
});

contextBridge.exposeInMainWorld('releaseKey', (key) => {
  try {
    // Try to use our special handler if it exists
    if (window._gameKeyHandlers) {
      return window._gameKeyHandlers.simulateKeyUp(key);
    }
    
    // Otherwise, use standard method
    const keyInfo = getKeyInfo(key);
    
    // Simulate key release
    const event = new KeyboardEvent('keyup', {
      key: key,
      code: keyInfo.code,
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    document.dispatchEvent(event);
    
    // Also dispatch on active document or window
    if (document.activeElement) {
      document.activeElement.dispatchEvent(event);
    } else {
      window.dispatchEvent(event);
    }
    
    console.log(`Key released: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error releasing key ${key}:`, error);
    return false;
  }
});

// Utility function to get key information
function getKeyInfo(key) {
  // Key codes and keyCodes
  const keyMap = {
    'a': { code: 'KeyA', keyCode: 65 },
    'b': { code: 'KeyB', keyCode: 66 },
    'c': { code: 'KeyC', keyCode: 67 },
    'd': { code: 'KeyD', keyCode: 68 },
    'e': { code: 'KeyE', keyCode: 69 },
    'f': { code: 'KeyF', keyCode: 70 },
    'g': { code: 'KeyG', keyCode: 71 },
    'h': { code: 'KeyH', keyCode: 72 },
    'i': { code: 'KeyI', keyCode: 73 },
    'j': { code: 'KeyJ', keyCode: 74 },
    'k': { code: 'KeyK', keyCode: 75 },
    'l': { code: 'KeyL', keyCode: 76 },
    'm': { code: 'KeyM', keyCode: 77 },
    'n': { code: 'KeyN', keyCode: 78 },
    'o': { code: 'KeyO', keyCode: 79 },
    'p': { code: 'KeyP', keyCode: 80 },
    'q': { code: 'KeyQ', keyCode: 81 },
    'r': { code: 'KeyR', keyCode: 82 },
    's': { code: 'KeyS', keyCode: 83 },
    't': { code: 'KeyT', keyCode: 84 },
    'u': { code: 'KeyU', keyCode: 85 },
    'v': { code: 'KeyV', keyCode: 86 },
    'w': { code: 'KeyW', keyCode: 87 },
    'x': { code: 'KeyX', keyCode: 88 },
    'y': { code: 'KeyY', keyCode: 89 },
    'z': { code: 'KeyZ', keyCode: 90 },
    '0': { code: 'Digit0', keyCode: 48 },
    '1': { code: 'Digit1', keyCode: 49 },
    '2': { code: 'Digit2', keyCode: 50 },
    '3': { code: 'Digit3', keyCode: 51 },
    '4': { code: 'Digit4', keyCode: 52 },
    '5': { code: 'Digit5', keyCode: 53 },
    '6': { code: 'Digit6', keyCode: 54 },
    '7': { code: 'Digit7', keyCode: 55 },
    '8': { code: 'Digit8', keyCode: 56 },
    '9': { code: 'Digit9', keyCode: 57 },
    ' ': { code: 'Space', keyCode: 32 },
    'Escape': { code: 'Escape', keyCode: 27 },
    'Enter': { code: 'Enter', keyCode: 13 },
    'Tab': { code: 'Tab', keyCode: 9 },
    'F11': { code: 'F11', keyCode: 122 },
    'Shift': { code: 'ShiftLeft', keyCode: 16 },
    'Control': { code: 'ControlLeft', keyCode: 17 },
    'Alt': { code: 'AltLeft', keyCode: 18 }
  };
  
  return keyMap[key] || { code: key, keyCode: key.charCodeAt(0) };
}

// Receive updated bitrate settings
ipcRenderer.on('bitrate-settings-updated', (event, settings) => {
  console.log('[viewPreload.js] Settings received in view:', settings);
  
  try {
    // Store settings in localStorage
    if (settings.region) {
      localStorage.setItem('region', settings.region);
      console.log(`[viewPreload.js] Region set: ${settings.region}`);
    }
    
    if (settings.bypassRestriction) {
      localStorage.setItem('bypassRestriction', settings.bypassRestriction);
      console.log(`[viewPreload.js] Restriction bypass set: ${settings.bypassRestriction}`);
    }
    
    if (settings.hostBitrate && typeof settings.hostBitrate === 'number') {
      localStorage.setItem('hostBitrate', settings.hostBitrate.toString());
      console.log(`[viewPreload.js] Host bitrate set: ${settings.hostBitrate}`);
    }
    
    if (settings.playerBitrate && typeof settings.playerBitrate === 'number') {
      localStorage.setItem('playerBitrate', settings.playerBitrate.toString());
      console.log(`[viewPreload.js] Player bitrate set: ${settings.playerBitrate}`);
    }
    
    console.log('[viewPreload.js] All settings have been injected into localStorage');
  } catch (error) {
    console.error('[viewPreload.js] Error injecting settings:', error);
  }
});

// Script for viewPreload injection
(function() {
  try {
    console.log("ViewPreload injection enabled");
    
    // Add necessary features for the view
    window.addEventListener('load', () => {
      console.log("ViewPreload: Page loaded");
    });

    return "ViewPreload injection successful";
  } catch (error) {
    console.error("Error during viewPreload injection:", error);
    return "Error: " + error.message;
  }
})(); 
/**
 * Macro management module for the application
 * Contains all available macros and management methods
 */

class MacroManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.randomMovementActive = false;
    this.centralMovementController = {
      isRunning: false,
      currentSequence: [],
      currentIndex: 0,
      lastDirection: null,
      recentMoves: [],
      timeoutIds: []
    };
    this.randomMovementTimeouts = [];
    this.randomMovementIntervalId = null;
    this.afkHostActive = false;
    this.afkHostTimeoutId = null;
    this.afkPlayerActive = false;
    this.afkPlayerTimeoutId = null;
    this.vKeyPressIntervalIds = [];
    this.mouseClickIntervalIds = [];
  }

  /**
   * Execute macros based on ID and game mode
   */
  executeMacro(macroId, gameMode) {
    if (!this.mainWindow) return;
    console.log(`Executing macro ${macroId} for mode ${gameMode}`);

    // Check if it's macro10 (synchronization panel)
    if (macroId === 'macro10') {
      this.mainWindow.openSyncPanel();
      return;
    }
    
    // Check if it's macro11 (macro panel)
    if (macroId === 'macro11') {
      this.mainWindow.openMacroPanel();
      return;
    }

    // For centralized movement macros that should execute globally
    if (macroId === 'macro4') {
      this.toggleRandomMovements();
      return;
    }

    // For other macros, use synchronized views that are valid, visible or not
    // Collect all synchronized views (functionality)
    const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
    
    // If no view is synchronized, use all valid views (non-destroyed)
    let targetViews = synchronizedViews.length > 0 
      ? synchronizedViews 
      : this.mainWindow.views.filter(view => view && view.webContents && !view.webContents.isDestroyed());
    
    console.log(`Executing macro ${macroId} on ${targetViews.length} views (synchronized: ${synchronizedViews.length > 0})`);

    // If after all there are no valid views, do nothing
    if (targetViews.length === 0) {
      console.warn("No valid views found to execute macro.");
      return;
    }

    // Execute appropriate macro on target views
    switch (macroId) {
      case 'macro1':
        this.executeMultiSearch(targetViews);
        break;
      case 'macro2':
        this.executeAbandonNext(targetViews);
        break;
      case 'macro3':
        this.executeFullscreen(targetViews);
        break;
      case 'macro5':
        this.executeAutoDrop(targetViews);
        break;
      case 'macro6':
        this.toggleAfkHost(targetViews);
        break;
      case 'macro7':
        this.toggleAfkPlayer(targetViews);
        break;
      case 'macro8':
        this.toggleAfkHostAndPlayer(targetViews);
        break;
      default:
        console.log('Unrecognized macro:', macroId);
    }
  }

  /**
   * Macro 1: Multi-Search (Press R)
   */
  executeMultiSearch(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // Press R for 100ms to reload
              window.pressKey('r');
              setTimeout(() => {
                window.releaseKey('r');
                console.log('Macro 1 executed successfully');
              }, 100);
            } catch (error) {
              console.error('Error executing macro 1:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro1:', err));
      }
    });
  }

  /**
   * Macro 2: Abandon and Next (Escape, Tab x2, Enter)
   */
  executeAbandonNext(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // Sequence: Escape, Tab x2, Enter
              console.log('Starting macro 2 sequence');
              window.pressKey('Escape');
              setTimeout(() => {
                window.releaseKey('Escape');
                console.log('Escape released');
                
                setTimeout(() => {
                  window.pressKey('Tab');
                  setTimeout(() => {
                    window.releaseKey('Tab');
                    console.log('First Tab released');
                    
                    setTimeout(() => {
                      window.pressKey('Tab');
                      setTimeout(() => {
                        window.releaseKey('Tab');
                        console.log('Second Tab released');
                        
                        setTimeout(() => {
                          window.pressKey('Enter');
                          setTimeout(() => {
                            window.releaseKey('Enter');
                            console.log('Enter released, sequence completed');
                          }, 100);
                        }, 200);
                      }, 100);
                    }, 200);
                  }, 100);
                }, 500);
              }, 100);
            } catch (error) {
              console.error('Error executing macro 2:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro2:', err));
      }
    });
  }

  /**
   * Macro 3: Fullscreen (F11)
   */
  executeFullscreen(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // F11 to toggle fullscreen
              console.log('Executing Fullscreen macro (F11)');
              window.pressKey('F11');
              setTimeout(() => {
                window.releaseKey('F11');
                console.log('F11 released, macro 3 completed');
              }, 100);
            } catch (error) {
              console.error('Error executing macro 3:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro3:', err));
      }
    });
  }

  /**
   * Macro 4: Random Movements (Toggle)
   */
  toggleRandomMovements() {
    // Invert macro state
    this.randomMovementActive = !this.randomMovementActive;
    
    // Update visual status in control bar
    this.mainWindow.updateControlBarMacroStatus(4, this.randomMovementActive);
    
    if (this.randomMovementActive) {
      console.log('Starting synchronized random movements');
      
      // Get all synchronized views
      const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
      
      if (synchronizedViews.length === 0) {
        console.log('No synchronized views available - select views in synchronization panel');
        // Reset state if no synchronized views
        this.randomMovementActive = false;
        this.mainWindow.updateControlBarMacroStatus(4, false);
        
        // Automatically open synchronization panel if no views are synchronized
        this.mainWindow.openSyncPanel();
        return;
      }
      
      console.log(`Executing movements on ${synchronizedViews.length} synchronized views`);
      
      // Initialize central controller
      this.centralMovementController = {
        isRunning: true,
        currentSequence: [],
        currentIndex: 0,
        lastDirection: null,
        recentMoves: [],
        timeoutIds: []
      };
      
      // Start movement sequence
      this.startCentralMovementSequence();
    } else {
      console.log('Stopping random movements');
      this.stopRandomMovements();
    }
  }

  /**
   * Stop all random movements
   */
  stopRandomMovements() {
    console.log('Stopping random movements');
    
    // Disable macro flag
    this.randomMovementActive = false;
    
    // Stop all synchronized movements
    this.stopAllSynchronizedMovements();
    
    console.log('All random movements have been stopped successfully');
  }

  /**
   * Stop all synchronized movements
   */
  stopAllSynchronizedMovements() {
    console.log('Stopping all synchronized movements');
    
    // Stop central controller
    this.centralMovementController.isRunning = false;
    
    // Clear all central timeouts
    if (this.centralMovementController.timeoutIds.length > 0) {
      this.centralMovementController.timeoutIds.forEach(id => clearTimeout(id));
      this.centralMovementController.timeoutIds = [];
    }
    
    // Clear other timeouts and intervals
    if (this.randomMovementTimeouts && this.randomMovementTimeouts.length > 0) {
      this.randomMovementTimeouts.forEach(id => clearTimeout(id));
      this.randomMovementTimeouts = [];
    }
    
    if (this.randomMovementIntervalId) {
      clearInterval(this.randomMovementIntervalId);
      this.randomMovementIntervalId = null;
    }
    
    // Reset controller state
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.currentSequence = [];
    
    // Release all keys in each view
    this.mainWindow.views.forEach(view => this.mainWindow.releaseAllKeysInView(view));
  }

  /**
   * Start central movement sequence
   */
  startCentralMovementSequence() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log('Starting central movement sequence');
    
    // Reset controller state
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.lastDirection = null;
    this.centralMovementController.recentMoves = [];
    
    // Start with 3 jumps
    this.executeJumpSequence(0);
  }

  /**
   * Execute initial jump sequence
   */
  executeJumpSequence(jumpIndex) {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log(`Executing jump ${jumpIndex+1}/3`);
    
    // Get all synchronized views
    const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
    
    // Execute jump on all views with simplified approach
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        const script = `
          (function() {
            try {
              const element = document.documentElement || document.body;
              
              // Simulate space key press
              const downEvent = document.createEvent('HTMLEvents');
              downEvent.initEvent('keydown', true, true);
              downEvent.key = ' ';
              downEvent.code = 'Space';
              downEvent.keyCode = 32;
              element.dispatchEvent(downEvent);
              
              // Release after 100ms
              setTimeout(() => {
                const upEvent = document.createEvent('HTMLEvents');
                upEvent.initEvent('keyup', true, true);
                upEvent.key = ' ';
                upEvent.code = 'Space';
                upEvent.keyCode = 32;
                element.dispatchEvent(upEvent);
              }, 100);
              
              return "Simple jump executed";
            } catch(error) {
              return "Jump error: " + error.message;
            }
          })();
        `;
        
        view.webContents.executeJavaScript(script)
          .then(result => console.log(`View ${view.viewNumber}: ${result}`))
          .catch(err => {
            console.error(`Jump error in view ${view.viewNumber}:`, err);
            // Try direct approach on failure
            this.executeDirectMovement(view, [' '], 100);
          });
      }
    });
    
    // Continue with next jump or move to movements
    if (jumpIndex < 2) {
      // Wait 200ms before next jump
      const nextJumpId = setTimeout(() => {
        this.executeJumpSequence(jumpIndex + 1);
      }, 200);
      
      this.centralMovementController.timeoutIds.push(nextJumpId);
    } else {
      // Move to random movements after 3 jumps
      const startMovementsId = setTimeout(() => {
        this.executeRandomMovement();
      }, 800);
      
      this.centralMovementController.timeoutIds.push(startMovementsId);
    }
  }

  /**
   * Execute random movement
   */
  executeRandomMovement() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    // Possible directions (AZERTY: ZQSD)
    const directions = [
      ['z'],      // Forward
      ['q'],      // Left
      ['s'],      // Backward
      ['d'],      // Right
      ['z', 'q'], // Diagonal forward-left
      ['z', 'd'], // Diagonal forward-right
      ['s', 'q'], // Diagonal backward-left
      ['s', 'd']  // Diagonal backward-right
    ];
    
    try {
      // 1. Choose direction randomly
      let chosen = directions[Math.floor(Math.random() * directions.length)];
      
      // 2. Reduce probability of replacing 'z' with 's' to only 20%
      if (chosen.includes('z') && !chosen.includes('s') && Math.random() < 0.2) {
        chosen = ['s'];
      }
      
      // Use AZERTY keys directly
      const mappedKeys = chosen;
      
      // Determine movement duration (between 500ms and 1750ms)
      const pressDuration = 500 + Math.random() * 1250;
      
      // Execute movement on all synchronized views
      console.log(`Executing movement: ${mappedKeys.join('+')} for ${pressDuration}ms`);
      
      const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
      
      // Use simplest approach: createElement + dispatchEvent
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          const script = `
            (function() {
              try {
                const simulateKeyEvent = (type, key) => {
                  const element = document.documentElement || document.body;
                  const event = document.createEvent('HTMLEvents');
                  event.initEvent(type, true, true);
                  event.key = key;
                  event.code = key === ' ' ? 'Space' : 
                                key === 'Shift' ? 'ShiftLeft' : 
                                'Key' + (key === 'z' ? 'Z' : 
                                          key === 'q' ? 'Q' : 
                                          key === 's' ? 'S' : 
                                          key === 'd' ? 'D' : key.toUpperCase());
                  event.keyCode = key === ' ' ? 32 : 
                                  key === 'Shift' ? 16 : 
                                  key.charCodeAt(0);
                  event.shiftKey = key === 'Shift' || keys.includes('Shift');
                  element.dispatchEvent(event);
                };

                // Press keys
                const keys = ${JSON.stringify(mappedKeys)};
                keys.forEach(key => simulateKeyEvent('keydown', key));

                // Release after delay
                setTimeout(() => {
                  keys.forEach(key => simulateKeyEvent('keyup', key));
                  
                  // Correction for backward movement (only if no combination)
                  if (keys.length === 1 && keys[0] === 's') {
                    simulateKeyEvent('keydown', 'z');
                    setTimeout(() => simulateKeyEvent('keyup', 'z'), 600);
                  }
                }, ${pressDuration});
                
                return "Executed";
              } catch (error) {
                return "Error: " + error.message;
              }
            })();
          `;
          
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`View ${view.viewNumber}: ${result}`))
            .catch(err => {
              console.error(`View ${view.viewNumber} error:`, err);
              // Try alternative approach on error
              this.executeDirectMovement(view, mappedKeys, pressDuration);
            });
        }
      });
      
      // Schedule next movement with random delay
      const nextDelay = pressDuration + 1000 + Math.random() * 1250;
      
      const nextMovementId = setTimeout(() => {
        this.executeRandomMovement();
      }, nextDelay);
      
      this.centralMovementController.timeoutIds.push(nextMovementId);
      
    } catch (error) {
      console.error('Error in central random movement:', error);
      
      // On error, try to continue after delay
      const errorRecoveryId = setTimeout(() => {
        this.executeRandomMovement();
      }, 2000);
      
      this.centralMovementController.timeoutIds.push(errorRecoveryId);
    }
  }

  /**
   * Execute direct movement (fallback)
   */
  executeDirectMovement(view, keys, duration) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) return;
    
    console.log(`Fallback: Direct execution for view ${view.viewNumber}`);
    
    try {
      // Try to inject code directly into page
      view.webContents.insertCSS(`
        @keyframes pressed { from {opacity: 0.8;} to {opacity: 1;} }
        body:after {
          content: "Movement active";
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: rgba(0,255,0,0.5);
          padding: 5px;
          z-index: 9999;
          animation: pressed 0.5s infinite alternate;
        }
      `).then(() => {
        // Simulate center click to activate focus
        const bounds = view.getBounds();
        view.webContents.sendInputEvent({
          type: 'mouseDown',
          x: Math.floor(bounds.width / 2),
          y: Math.floor(bounds.height / 2),
          button: 'left',
          clickCount: 1
        });
        
        setTimeout(() => {
          view.webContents.sendInputEvent({
            type: 'mouseUp',
            x: Math.floor(bounds.width / 2),
            y: Math.floor(bounds.height / 2),
            button: 'left',
            clickCount: 1
          });
          
          // AZERTY mapping for fallback
          const keyMapping = {
            'z': 'w',
            'q': 'a',
            's': 's',
            'd': 'd',
            'Shift': 'Shift'
          };
          
          // Send keyboard events directly via IPC
          keys.forEach(key => {
            const mappedKey = keyMapping[key] || key;
            this.mainWindow.mainWebContents.send('simulate-keypress', {
              viewId: view.viewNumber,
              key: mappedKey,
              state: 'down'
            });
          });
          
          setTimeout(() => {
            keys.forEach(key => {
              const mappedKey = keyMapping[key] || key;
              this.mainWindow.mainWebContents.send('simulate-keypress', {
                viewId: view.viewNumber,
                key: mappedKey,
                state: 'up'
              });
            });
          }, duration);
        }, 100);
      }).catch(err => console.error('CSS injection error:', err));
    } catch (error) {
      console.error(`Error during direct movement (view ${view.viewNumber}):`, error);
    }
  }

  /**
   * Macro 5: Auto Drop (Space on Hosts then Players)
   */
  executeAutoDrop(views) {
    if (!views || views.length === 0) return;
    
    console.log('Executing Auto Drop macro');
    
    // Separate views into hosts and players
    const hostViews = views.filter(view => view.viewType === 'host');
    const playerViews = views.filter(view => view.viewType === 'player');
    
    // Execute Space on hosts first
    hostViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              console.log('Auto Drop: Space key press (host)');
              window.pressKey(' ');
              setTimeout(() => {
                window.releaseKey(' ');
                console.log('Auto Drop: Space key release (host)');
              }, 100);
              return "Auto Drop executed on host";
            } catch (error) {
              console.error('Error executing Auto Drop on host:', error);
              return "Error: " + error.message;
            }
          })();
        `).catch(err => console.error('Failed to execute Auto Drop on host:', err));
      }
    });
    
    // After 0.3 second (300ms), execute Space on players
    setTimeout(() => {
      playerViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                console.log('Auto Drop: Space key press (player)');
                window.pressKey(' ');
                setTimeout(() => {
                  window.releaseKey(' ');
                  console.log('Auto Drop: Space key release (player)');
                }, 100);
                return "Auto Drop executed on player";
              } catch (error) {
                console.error('Error executing Auto Drop on player:', error);
                return "Error: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to execute Auto Drop on player:', err));
        }
      });
    }, 900);
  }

  /**
   * Macro 6: AFK Host (Movement on Hosts)
   * Executes ZQSD key sequence in order then DSQZ in reverse order
   * Each key is held for 1 second with 2 second pause between each key
   */
  toggleAfkHost(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggling AFK Host macro');
    
    // Identify hosts
    const hostViews = views.filter(view => view.viewType === 'host');
    
    if (hostViews.length === 0) {
      console.log('No visible hosts to execute AFK Host macro');
      return;
    }
    
    // Check if macro is already active
    this.afkHostActive = !this.afkHostActive;
    
    // Update visual status
    this.mainWindow.updateControlBarMacroStatus(6, this.afkHostActive);
    
    if (this.afkHostActive) {
      console.log('Starting AFK movements on hosts');
      
      // Function to execute key sequence
      const executeAfkMovement = () => {
        if (!this.afkHostActive) return;
        
        // Key sequence in order then in reverse order
        const forwardKeys = ['z', 'q', 's', 'd'];
        const reverseKeys = ['d', 's', 'q', 'z'];
        const allKeys = [...forwardKeys, ...reverseKeys];
        
        const executeKeySequence = (keyIndex) => {
          if (keyIndex >= allKeys.length || !this.afkHostActive) return;
          
          const currentKey = allKeys[keyIndex];
          
          hostViews.forEach(view => {
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Host: Pressing ${currentKey}');
                    window.pressKey('${currentKey}');
                    setTimeout(() => {
                      window.releaseKey('${currentKey}');
                      console.log('AFK Host: Releasing ${currentKey}');
                    }, 1000); // Press for 1 second
                    return "AFK Host: movement executed on key ${currentKey}";
                  } catch (error) {
                    console.error('Error executing AFK Host:', error);
                    return "Error: " + error.message;
                  }
                })();
              `).catch(err => console.error(`Failed to execute AFK Host movement for key ${currentKey}:`, err));
            }
          });
          
          // Move to next key after 2 seconds pause
          setTimeout(() => {
            executeKeySequence(keyIndex + 1);
          }, 3000); // 1000ms press + 2000ms pause
        };
        
        // Start key sequence
        executeKeySequence(0);
        
        // Schedule next complete sequence
        if (this.afkHostActive) {
          this.afkHostTimeoutId = setTimeout(executeAfkMovement, 3000); // Wait 3 seconds before restarting
        }
      };
      
      // Start movements
      executeAfkMovement();
    } else {
      console.log('Stopping AFK movements on hosts');
      
      // Stop timeouts
      if (this.afkHostTimeoutId) {
        clearTimeout(this.afkHostTimeoutId);
        this.afkHostTimeoutId = null;
      }
      
      // Release all keys in host views
      hostViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Release all possible keys
                ['z', 'q', 's', 'd'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Host: All keys released');
                return "AFK Host: stopped";
              } catch (error) {
                console.error('Error stopping AFK Host:', error);
                return "Error: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Host:', err));
        }
      });
    }
  }

  /**
   * Macro 7: AFK Player (Movement on Players)
   * Executes random ZQSD keys for 0.6 second every 1 second
   * Records last 4 movements and replays them in reverse order
   */
  toggleAfkPlayer(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggling AFK Player macro');
    
    // Identify players
    const playerViews = views.filter(view => view.viewType === 'player');
    
    if (playerViews.length === 0) {
      console.log('No visible players to execute AFK Player macro');
      return;
    }
    
    // Check if macro is already active
    this.afkPlayerActive = !this.afkPlayerActive;
    
    // Update visual status
    this.mainWindow.updateControlBarMacroStatus(7, this.afkPlayerActive);
    
    if (this.afkPlayerActive) {
      console.log('Starting AFK movements on players');
      
      // Initialize array to record last movements
      let lastMoves = [];
      let isReplayingMoves = false;
      
      // Fonction pour exécuter un mouvement
      const executeAfkMovement = () => {
        if (!this.afkPlayerActive) return;
        
        // Touches possibles
        const possibleKeys = ['z', 'q', 's', 'd'];
        
        // Si nous sommes en mode replay, utiliser les mouvements enregistrés dans l'ordre inverse
        if (isReplayingMoves && lastMoves.length > 0) {
          // Prendre les mouvements dans l'ordre inverse
          const movesToReplay = [...lastMoves].reverse();
          console.log('Rejouant les mouvements en sens inverse:', movesToReplay);
          
          const replayMove = (index) => {
            if (index >= movesToReplay.length || !this.afkPlayerActive) {
              // Terminer le replay et revenir au mode normal
              isReplayingMoves = false;
              setTimeout(executeAfkMovement, 1000);
              return;
            }
            
            const currentKey = movesToReplay[index];
            
            playerViews.forEach(view => {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Player Replay: Appui sur ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Player Replay: Relâchement ${currentKey}');
                      }, 600); // Appui pendant 0,6 seconde
                      return "AFK Player Replay: mouvement exécuté sur touche ${currentKey}";
                    } catch (error) {
                      console.error('Erreur lors de l\\'exécution de AFK Player Replay:', error);
                      return "Erreur: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Player replay movement for key ${currentKey}:`, err));
              }
            });
            
            // Passer au prochain mouvement après 1,6 secondes (0,6s d'appui + 1s de pause)
            setTimeout(() => {
              replayMove(index + 1);
            }, 1600);
          };
          
          // Démarrer le replay des mouvements
          replayMove(0);
          
        } else {
          // Mode normal: sélectionner une touche aléatoire
          const randomKey = possibleKeys[Math.floor(Math.random() * possibleKeys.length)];
          
          // Enregistrer ce mouvement
          lastMoves.push(randomKey);
          // Garder seulement les 4 derniers mouvements
          if (lastMoves.length > 4) {
            lastMoves.shift();
          }
          
          console.log('AFK Player: Exécution de la touche', randomKey, '- Mouvements enregistrés:', lastMoves);
          
          playerViews.forEach(view => {
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Player: Appui sur ${randomKey}');
                    window.pressKey('${randomKey}');
                    setTimeout(() => {
                      window.releaseKey('${randomKey}');
                      console.log('AFK Player: Relâchement ${randomKey}');
                    }, 600); // Appui pendant 0,6 seconde
                    return "AFK Player: mouvement exécuté sur touche ${randomKey}";
                  } catch (error) {
                    console.error('Erreur lors de l\\'exécution de AFK Player:', error);
                    return "Erreur: " + error.message;
                  }
                })();
              `).catch(err => console.error(`Failed to execute AFK Player movement for key ${randomKey}:`, err));
            }
          });
          
          // Si nous avons enregistré 4 mouvements, passer en mode replay pour le prochain cycle
          if (lastMoves.length === 4 && !isReplayingMoves) {
            isReplayingMoves = true;
          }
          
          // Planifier le prochain mouvement après 1,6 secondes (0,6s d'appui + 1s de pause)
          this.afkPlayerTimeoutId = setTimeout(executeAfkMovement, 1600);
        }
      };
      
      // Démarrer les mouvements
      executeAfkMovement();
    } else {
      console.log('Stopping AFK movements on players');
      
      // Stop timeouts
      if (this.afkPlayerTimeoutId) {
        clearTimeout(this.afkPlayerTimeoutId);
        this.afkPlayerTimeoutId = null;
      }
      
      // Release all keys in player views
      playerViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Release all possible keys
                ['z', 'q', 's', 'd'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Player: All keys released');
                return "AFK Player: stopped";
              } catch (error) {
                console.error('Error stopping AFK Player:', error);
                return "Error: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Player:', err));
        }
      });
    }
  }

  /**
   * Macro 8: AFK Host and Player (Movement on Hosts and Players)
   * Executes ZQSD key sequence in order then DSQZ in reverse order
   * Each key is held for 1 second with 2 second pause between each key
   * Presses V every 3 seconds on players and automatically restarts every 60 seconds
   */
  toggleAfkHostAndPlayer(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggling AFK Host and Player macro');
    
    // Identify hosts and players
    const hostViews = views.filter(view => view.viewType === 'host');
    const playerViews = views.filter(view => view.viewType === 'player');
    
    if (hostViews.length === 0 && playerViews.length === 0) {
      console.log('No visible hosts or players to execute AFK Host and Player macro');
      return;
    }
    
    // Check if macro is already active
    this.afkHostActive = !this.afkHostActive;
    this.afkPlayerActive = !this.afkPlayerActive;
    
    // Update visual status
    this.mainWindow.updateControlBarMacroStatus(8, this.afkHostActive && this.afkPlayerActive);
    
    if (this.afkHostActive && this.afkPlayerActive) {
      console.log('Starting AFK movements on hosts and players');
      
      // Store interval IDs for cleanup later
      this.vKeyPressIntervalIds = [];
      this.autoCompleteRestartId = null;
      
      // Function to start macro functionality
      const startAfkFunctionality = () => {
        // Clean existing intervals to avoid duplicates during restart
        this.cleanupIntervals();
        
        // Start periodic V key press only for players
        playerViews.forEach(view => {
          if (view.webContents && !view.webContents.isDestroyed()) {
            const intervalId = setInterval(() => {
              if (!this.afkHostActive || !this.afkPlayerActive) return;
              
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Host+Player: Appui sur V (player)');
                    window.pressKey('v');
                    setTimeout(() => {
                      window.releaseKey('v');
                      console.log('AFK Host+Player: Relâchement V (player)');
                    }, 100); // Appui court de 100ms
                    return "AFK Host+Player: appui V exécuté";
                  } catch (error) {
                    console.error('Erreur lors de l\\'appui sur V:', error);
                    return "Erreur: " + error.message;
                  }
                })();
              `).catch(err => console.error('Failed to execute V key press on player:', err));
            }, 3000); // Répétition toutes les 3 secondes
            
            this.vKeyPressIntervalIds.push(intervalId);
          }
        });
        
        // Fonction pour exécuter la séquence de touches
        const executeAfkMovement = () => {
          if (!this.afkHostActive || !this.afkPlayerActive) return;
          
          // Séquence de touches dans l'ordre puis dans l'ordre inverse
          const forwardKeys = ['z', 'q', 's', 'd'];
          const reverseKeys = ['d', 's', 'q', 'z'];
          const allKeys = [...forwardKeys, ...reverseKeys];
          
          const executeKeySequence = (keyIndex) => {
            if (keyIndex >= allKeys.length || !this.afkHostActive || !this.afkPlayerActive) return;
            
            const currentKey = allKeys[keyIndex];
            
            hostViews.forEach(view => {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Host and Player: Appui sur ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Host and Player: Relâchement ${currentKey}');
                      }, 1000); // Appui pendant 1 seconde
                      return "AFK Host and Player: mouvement exécuté sur touche ${currentKey}";
                    } catch (error) {
                      console.error('Erreur lors de l\\'exécution de AFK Host and Player:', error);
                      return "Erreur: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Host and Player movement for key ${currentKey}:`, err));
              }
            });
            
            playerViews.forEach(view => {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Host and Player: Appui sur ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Host and Player: Relâchement ${currentKey}');
                      }, 1000); // Appui pendant 1 seconde
                      return "AFK Host and Player: mouvement exécuté sur touche ${currentKey}";
                    } catch (error) {
                      console.error('Erreur lors de l\\'exécution de AFK Host and Player:', error);
                      return "Erreur: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Host and Player movement for key ${currentKey}:`, err));
              }
            });
            
            // Passer à la touche suivante après 2 secondes de pause
            setTimeout(() => {
              executeKeySequence(keyIndex + 1);
            }, 3000); // 1000ms d'appui + 2000ms de pause
          };
          
          // Démarrer la séquence de touches
          executeKeySequence(0);
          
          // Planifier la prochaine séquence complète
          if (this.afkHostActive && this.afkPlayerActive) {
            this.afkHostTimeoutId = setTimeout(executeAfkMovement, 3000); // Attendre 3 secondes avant de recommencer
          }
        };
        
        // Démarrer les mouvements
        executeAfkMovement();
      };
      
      // Configurer le redémarrage complet automatique toutes les 60 secondes
      this.autoCompleteRestartId = setInterval(() => {
        if (this.afkHostActive && this.afkPlayerActive) {
          console.log('Redémarrage complet automatique de la macro AFK Host+Player (toutes les 60 secondes)');
          
          // Arrêter tous les intervalles et timers
          this.cleanupIntervals();
          
          // Réinitialiser les flags pour simuler une désactivation complète
          const wasActive = this.afkHostActive && this.afkPlayerActive;
          this.afkHostActive = false;
          this.afkPlayerActive = false;
          
          // Relâcher toutes les touches dans les vues host et player
          const allViews = [...hostViews, ...playerViews];
          allViews.forEach(view => {
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    // Relâcher toutes les touches possibles
                    ['z', 'q', 's', 'd', 'v'].forEach(key => {
                      window.releaseKey(key);
                    });
                    return "AFK Host and Player: touches relâchées pour redémarrage complet";
                  } catch (error) {
                    console.error('Erreur lors du relâchement des touches:', error);
                    return "Erreur: " + error.message;
                  }
                })();
              `).catch(err => console.error('Failed to release keys:', err));
            }
          });
          
          // Simuler un redémarrage complet après une courte pause
          setTimeout(() => {
            if (wasActive) {
              // Réactiver les flags
              this.afkHostActive = true;
              this.afkPlayerActive = true;
              
              // Mettre à jour le statut visuel
              this.mainWindow.updateControlBarMacroStatus(8, true);
              
              console.log('Relancement complet de la macro AFK Host+Player');
              
              // Redémarrer toutes les fonctionnalités
              startAfkFunctionality();
            }
          }, 500); // Pause courte pour simuler un clic utilisateur
        }
      }, 60000); // Redémarrage complet toutes les 60 secondes
      
      // Méthode pour nettoyer les intervalles et timeouts existants
      this.cleanupIntervals = () => {
        // Arrêter les timeouts
        if (this.afkHostTimeoutId) {
          clearTimeout(this.afkHostTimeoutId);
          this.afkHostTimeoutId = null;
        }
        
        // Arrêter tous les intervalles d'appui sur V
        if (this.vKeyPressIntervalIds && this.vKeyPressIntervalIds.length > 0) {
          this.vKeyPressIntervalIds.forEach(intervalId => clearInterval(intervalId));
          this.vKeyPressIntervalIds = [];
        }
        
        // Relâcher toutes les touches dans les vues host et player
        const allViews = [...hostViews, ...playerViews];
        allViews.forEach(view => {
          if (view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.executeJavaScript(`
              (function() {
                try {
                  // Relâcher toutes les touches possibles
                  ['z', 'q', 's', 'd', 'v'].forEach(key => {
                    window.releaseKey(key);
                  });
                  return "AFK Host and Player: touches relâchées pour redémarrage";
                } catch (error) {
                  console.error('Erreur lors du relâchement des touches:', error);
                  return "Erreur: " + error.message;
                }
              })();
            `).catch(err => console.error('Failed to release keys:', err));
          }
        });
      };
      
      // Démarrer les fonctionnalités AFK
      startAfkFunctionality();
      
    } else {
      console.log('Arrêt des mouvements AFK sur les hosts et players');
      
      // Arrêter les timeouts
      if (this.afkHostTimeoutId) {
        clearTimeout(this.afkHostTimeoutId);
        this.afkHostTimeoutId = null;
      }
      
      // Arrêter l'intervalle de redémarrage complet automatique
      if (this.autoCompleteRestartId) {
        clearInterval(this.autoCompleteRestartId);
        this.autoCompleteRestartId = null;
      }
      
      // Arrêter tous les intervalles d'appui sur V
      if (this.vKeyPressIntervalIds && this.vKeyPressIntervalIds.length > 0) {
        this.vKeyPressIntervalIds.forEach(intervalId => clearInterval(intervalId));
        this.vKeyPressIntervalIds = [];
      }
      
      // Relâcher toutes les touches dans les vues host et player
      const allViews = [...hostViews, ...playerViews];
      allViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Relâcher toutes les touches possibles
                ['z', 'q', 's', 'd', 'v'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Host and Player: Toutes les touches relâchées');
                return "AFK Host and Player: arrêté";
              } catch (error) {
                console.error('Erreur lors de l\\'arrêt de AFK Host and Player:', error);
                return "Erreur: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Host and Player:', err));
        }
      });
    }
  }
}

module.exports = MacroManager; 
const { contextBridge, ipcRenderer } = require('electron');

// Variable to track if the script has already been injected
let scriptInjected = false;

// Function to inject BetterXcloud settings
function injectBetterXcloudSettings() {
  try {
    console.log("Injecting BetterXcloud settings");
    
    // Define main settings for BetterXcloud
    const settings = {
      "ui.imageQuality": 10,
      "ui.gameCard.waitTime.show": true,
      "ui.layout": "default",
      "game.fortnite.forceConsole": false,
      "block.tracking": true,
      "xhome.enabled": false,
      "block.features": [],
      "ui.hideSections": [],
      "audio.volume.booster.enabled": false,
      "ui.feedbackDialog.disabled": true,
      "stream.video.combineAudio": false,
      "nativeMkb.mode": "default",
      "loadingScreen.gameArt.show": false,
      "nativeMkb.forcedGames": [],
      "stream.video.maxBitrate": 2000000, // 3 Mbps hardcoded
      "stream.video.codecProfile": "low",
      "ui.splashVideo.skip": true,
      "ui.reduceAnimations": true,
      "ui.systemMenu.hideHandle": true,
      "ui.streamMenu.simplify": false,
      "ui.hideScrollbar": false,
      "version.current": "6.4.6",
      "version.lastCheck": 1742417945,
      "mkb.enabled": false,
      "ui.controllerStatus.show": true,
      "version.latest": "6.4.6",
      "server.bypassRestriction": "off",
      "server.region": "default",
      "bx.locale": "en-US",
      "ui.controllerFriendly": false,
      "stream.locale": "default",
      "server.ipv6.prefer": false,
      "stream.video.resolution": "720p",
      "screenshot.applyFilters": false,
      "audio.mic.onPlaying": false,
      "mkb.cursor.hideIdle": false,
      "gameBar.position": "off",
      "loadingScreen.waitTime.show": true,
      "loadingScreen.rocket": "hide",
      "userAgent.profile": "default",
      "ui.theme": "default"
    };

    // Define specific settings for BetterXcloud.Stream
    const streamSettings = {
      "controller.pollingRate": 4,
      "deviceVibration.mode": "off",
      "mkb.p1.preset.mappingId": -1,
      "keyboardShortcuts.preset.inGameId": -1,
      "audio.volume": 100,
      "video.player.type": "default",
      "video.maxFps": 10,
      "video.player.powerPreference": "default",
      "video.processing": "usm",
      "video.ratio": "16:9",
      "video.position": "center",
      "video.processing.sharpness": 0,
      "video.saturation": 100,
      "video.contrast": 100,
      "video.brightness": 100,
      "localCoOp.enabled": false,
      "deviceVibration.intensity": 50,
      "stats.showWhenPlaying": false,
      "stats.quickGlance.enabled": true,
      "stats.items": ["ping", "fps", "btr"],
      "stats.position": "top-right",
      "stats.textSize": "0.9rem",
      "stats.opacity.all": 60,
      "stats.opacity.background": 60,
      "stats.colors": false,
      "mkb.p1.slot": 1
    };

    // Save settings to localStorage
    localStorage.setItem("BetterXcloud", JSON.stringify(settings));
    localStorage.setItem("BetterXcloud.Stream", JSON.stringify(streamSettings));
    console.log("Settings injected into localStorage:", settings);
  } catch (error) {
    console.error("Error injecting BetterXcloud settings:", error);
  }
}

// Inject Better X Cloud as soon as possible
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded triggered, immediate injection');
  
  // Avoid multiple script injection
  if (scriptInjected) {
    console.log("BetterXcloud script already injected, no action needed");
    return;
  }
  
  try {
    // Inject script only if we're on an appropriate page
    const url = window.location.href;
    if (url.includes('xbox.com') || url.includes('play')) {
      // Check if script is already present
      if (document.getElementById('better-x-cloud-script')) {
        console.log("BetterXcloud script already present in DOM, no need to re-inject");
        return;
      }
      
      // Corrected URL version
      const scriptSrc = "https://cdn.jsdelivr.net/gh/redphx/better-x-cloud@latest/dist/better-x-cloud.min.js";
      
      // Inject script
      const scriptElem = document.createElement('script');
      scriptElem.id = 'better-x-cloud-script';
      scriptElem.src = scriptSrc;
      document.head.appendChild(scriptElem);
      
      console.log("BetterXcloud script injected");
      scriptInjected = true;
      
      // Add error handler
      scriptElem.onerror = function() {
        console.error("Error loading BetterXcloud script. Incorrect URL?");
      };
      
      // Inject settings after script loads
      scriptElem.onload = function() {
        console.log("BetterXcloud script loaded, injecting settings");
        injectBetterXcloudSettings();
      };
    }
  } catch (error) {
    console.error("Error injecting BetterXcloud script:", error);
  }
});

console.log("betterxcloudpreload.js is loaded");

// Attendre que le document soit chargé
document.addEventListener('DOMContentLoaded', async () => {
  // Références aux éléments DOM
  const licenseKeyInput = document.getElementById('licenseKey');
  const validateBtn = document.getElementById('validateBtn');
  const retryBtn = document.getElementById('retryBtn');
  const useYesBtn = document.getElementById('useYesBtn');
  const useNoBtn = document.getElementById('useNoBtn');
  const useSavedBtn = document.getElementById('useSavedBtn');
  const enterNewBtn = document.getElementById('enterNewBtn');
  const licenseForm = document.getElementById('license-form');
  const licenseInputForm = document.getElementById('license-input-form');
  const savedLicenseNotification = document.getElementById('saved-license-notification');
  const savedLicenseDisplay = document.getElementById('saved-license-display');
  const checkingResult = document.getElementById('checking-result');
  const validResult = document.getElementById('valid-result');
  const invalidResult = document.getElementById('invalid-result');
  const invalidMessage = document.getElementById('invalid-message');
  const expirationInfo = document.getElementById('expiration-info');
  const licenseKeyDisplay = document.getElementById('license-key-display');
  
  // Charger les informations de licence enregistrées
  const savedLicense = await window.licenseAPI.getSavedLicense();
  if (savedLicense) {
    // Afficher la notification de licence sauvegardée
    savedLicenseDisplay.textContent = maskLicenseKey(savedLicense);
    savedLicenseNotification.style.display = 'block';
    licenseInputForm.style.display = 'none';
    licenseKeyInput.value = savedLicense;
  }

  // Fonction pour masquer la clé de licence (afficher juste les 4 derniers caractères)
  function maskLicenseKey(key) {
    if (!key || key.length <= 4) return key;
    return '•'.repeat(key.length - 4) + key.slice(-4);
  }

  // Fonction pour masquer tous les résultats
  function hideAllResults() {
    licenseForm.style.display = 'block';
    checkingResult.style.display = 'none';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
  }
  
  // Fonction pour afficher le formulaire de licence
  function showLicenseInputForm() {
    savedLicenseNotification.style.display = 'none';
    licenseInputForm.style.display = 'block';
    licenseForm.style.display = 'block';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
  }
  
  // Fonction pour formater une date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    return date.toLocaleDateString('fr-FR', dateOptions) + ' à ' + date.toLocaleTimeString('fr-FR', timeOptions);
  }
  
  // Fonction pour afficher le résultat de validation
  function displayValidLicense(result) {
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'none';
    validResult.style.display = 'block';
    invalidResult.style.display = 'none';
    
    // Afficher les informations de licence
    const expiration = new Date(result.expiration);
    const now = new Date();
    const daysUntilExpiration = Math.ceil((expiration - now) / (1000 * 60 * 60 * 24));
    
    // Construire les informations d'expiration
    let expirationHtml = '';
    
    // Afficher la date d'activation si disponible
    if (result.activationDate) {
      const activationDate = formatDate(result.activationDate);
      expirationHtml += `<p><strong>Activée le:</strong> ${activationDate}</p>`;
    }
    
    // Ajouter la date d'expiration
    const formattedExpiration = formatDate(result.expiration);
    expirationHtml += `<p><strong>Expire le:</strong> ${formattedExpiration}</p>`;
    
    expirationInfo.innerHTML = expirationHtml;
    
    // Ajouter un avertissement si l'expiration est proche
    if (daysUntilExpiration <= 30) {
      expirationInfo.innerHTML += `
        <p style="color: var(--warning-color); font-weight: bold;">
          Attention: Votre licence expire dans ${daysUntilExpiration} jours
        </p>
      `;
      validResult.classList.add('warning');
    } else {
      validResult.classList.remove('warning');
    }
  }
  
  // Fonction pour afficher une licence invalide
  function displayInvalidLicense(message) {
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'none';
    validResult.style.display = 'none';
    invalidResult.style.display = 'block';
    
    invalidMessage.textContent = message || 'Impossible de valider votre licence.';
  }
  
  // Fonction pour valider une clé de licence
  async function validateLicenseKey(licenseKey) {
    if (!licenseKey) return;
    
    // Afficher l'indicateur de chargement
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'block';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
    
    try {
      await window.licenseAPI.validateLicense(licenseKey);
      // Le reste est géré par les écouteurs d'événements
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      displayInvalidLicense('Une erreur inattendue s\'est produite.');
    }
  }
  
  // Événement pour le bouton "Utiliser cette licence"
  useSavedBtn.addEventListener('click', () => {
    // Vérifier le statut de la licence sauvegardée
    validateLicenseKey(savedLicense);
  });
  
  // Événement pour le bouton "Entrer une nouvelle licence"
  enterNewBtn.addEventListener('click', () => {
    showLicenseInputForm();
  });
  
  // Événement pour le bouton "Oui" (utiliser cette licence)
  useYesBtn.addEventListener('click', () => {
    console.log("Bouton Oui cliqué - Signal envoyé au processus principal");
    // Signal au processus principal que l'utilisateur a validé la licence
    window.licenseAPI.signalLicenseValidated();
  });
  
  // Événement pour le bouton "Non" (changer de licence)
  useNoBtn.addEventListener('click', () => {
    // Afficher le formulaire pour saisir une nouvelle licence
    licenseKeyInput.value = '';
    showLicenseInputForm();
  });
  
  // Événement lors de la vérification en cours
  window.licenseAPI.onLicenseChecking(() => {
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'block';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
  });
  
  // Événement après vérification réussie
  window.licenseAPI.onLicenseResult((result) => {
    if (result.valid) {
      const savedLicense = licenseKeyInput.value.trim();
      licenseKeyDisplay.textContent = maskLicenseKey(savedLicense);
      displayValidLicense(result);
    } else {
      displayInvalidLicense(result.message);
    }
  });
  
  // Événement en cas d'erreur de vérification
  window.licenseAPI.onLicenseError((errorMessage) => {
    displayInvalidLicense(errorMessage);
  });
  
  // Événement de validation de la licence
  validateBtn.addEventListener('click', async () => {
    const licenseKey = licenseKeyInput.value.trim();
    
    if (!licenseKey) {
      invalidMessage.textContent = 'Veuillez entrer une clé de licence.';
      invalidResult.style.display = 'block';
      return;
    }
    
    validateLicenseKey(licenseKey);
  });
  
  // Événement pour réessayer
  retryBtn.addEventListener('click', () => {
    hideAllResults();
    // Si une licence était sauvegardée, montrer la notification
    if (savedLicense) {
      savedLicenseDisplay.textContent = maskLicenseKey(savedLicense);
      savedLicenseNotification.style.display = 'block';
      licenseInputForm.style.display = 'none';
    } else {
      showLicenseInputForm();
    }
  });
  
  // Activer la validation par la touche Entrée
  licenseKeyInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      validateBtn.click();
    }
  });
}); 
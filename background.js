let currentTabId = null;
let currentSite = null;
let startTime = null;

//agregar mas links para los que estas paginas funcionan
const TRACKED_SITES = [
  "twitter.com",
  "reddit.com",
  "facebook.com/marketplace",
  "x.com",
];

// Devuelve el sitio que coincide con alguna regla de TRACKED_SITES o null
function getTrackedSite(url) {
  for (const site of TRACKED_SITES) {
    if (url.includes(site)) {
      return site;
    }
  }
  return null;
}

// Maneja cambios de pestaña o actualizaciones
function handleTabChange(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab.url) return;
    const site = getTrackedSite(tab.url);

    // Si hay un sitio previamente trackeado, guardar el tiempo
    if (startTime && currentSite) {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      saveTime(currentSite, timeSpent);
      startTime = null;
      currentSite = null;
      currentTabId = null;
    }

    // Si la nueva pestaña es de un sitio trackeado, iniciar tracking
    if (site) {
      currentTabId = tabId;
      currentSite = site;
      startTime = Date.now();
    }
  });
}

// Guarda el tiempo acumulado para el sitio en chrome.storage.local
function saveTime(site, seconds) {
  const key = `time_${site}`;
  chrome.storage.local.get([key], (result) => {
    const previous = result[key] || 0;
    chrome.storage.local.set({ [key]: previous + seconds });
  });
}

// Escucha cuando se activa otra pestaña
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabChange(activeInfo.tabId);
});

// Escucha actualizaciones de la pestaña (por ejemplo, cambio de URL)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    handleTabChange(tabId);
  }
});

// Cuando la pestaña se cierra, si es la actual, guardar el tiempo
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (
    msg === "tracked_tab_closed" &&
    startTime &&
    sender.tab.id === currentTabId
  ) {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    saveTime(currentSite, timeSpent);
    startTime = null;
    currentSite = null;
    currentTabId = null;
  }
});

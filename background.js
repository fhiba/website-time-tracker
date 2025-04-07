const SUPABASE_URL = "https://nmhphmzygssjibrzsoqn.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5taHBobXp5Z3Nzamlicnpzb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjI4MDEsImV4cCI6MjA1OTYzODgwMX0.IXvZ_NOMbdy79Ut8ofZSzLRk06DK7-EABwSN4kU5pQk";

// Variables globales para trackeo
let currentTabId = null;
let currentSite = null;
let startTime = null;

// Lista de sitios a trackear
const TRACKED_SITES = ["twitter.com", "reddit.com", "facebook.com/marketplace"];

// Devuelve el sitio que coincide con alguna regla de TRACKED_SITES o null
function getTrackedSite(url) {
  for (const site of TRACKED_SITES) {
    if (url.includes(site)) {
      return site;
    }
  }
  return null;
}

// Función para enviar el tiempo a Supabase
async function sendTimeToSupabase(site, seconds) {
  // Recuperar el nombre de usuario guardado en chrome.storage.sync
  chrome.storage.sync.get(["username"], async (syncData) => {
    const username = syncData.username;
    if (!username) {
      console.error(
        "No se encontró un nombre de usuario. No se puede enviar la data.",
      );
      return;
    }

    const payload = [{ username, site, time_spent: seconds }];

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/user_times`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Error al enviar:", data);
      } else {
        console.log(`Tiempo de ${seconds} segundos enviado para ${site}`);
      }
    } catch (error) {
      console.error("Error en la red:", error);
    }
  });
}

// Guarda el tiempo acumulado para el sitio en chrome.storage.local (opcional, si quieres persistir localmente)
function saveTimeLocal(site, seconds) {
  const key = `time_${site}`;
  chrome.storage.local.get([key], (result) => {
    const previous = result[key] || 0;
    chrome.storage.local.set({ [key]: previous + seconds });
  });
}

// Maneja el cambio de pestaña o actualización
function handleTabChange(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab.url) return;
    const site = getTrackedSite(tab.url);

    // Si ya estaba trackeando un sitio, calcular el tiempo y enviarlo
    if (startTime && currentSite) {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Opcional: guardar localmente
      saveTimeLocal(currentSite, timeSpent);

      // Envío automático a Supabase
      sendTimeToSupabase(currentSite, timeSpent);

      // Resetear variables
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

// Escuchar cambios de pestaña
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabChange(activeInfo.tabId);
});

// Escuchar actualizaciones en la pestaña (por ejemplo, cambio de URL)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    handleTabChange(tabId);
  }
});

// Cuando la pestaña se cierra, si es la actual, enviar el tiempo
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (
    msg === "tracked_tab_closed" &&
    startTime &&
    sender.tab.id === currentTabId
  ) {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    saveTimeLocal(currentSite, timeSpent);
    sendTimeToSupabase(currentSite, timeSpent);

    startTime = null;
    currentSite = null;
    currentTabId = null;
  }
});

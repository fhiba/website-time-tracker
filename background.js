// Configuración inicial
const TRACKED_SITES = [
  { name: "Twitter", pattern: "*://*.twitter.com/*", id: 1 },
  { name: "Reddit", pattern: "*://*.reddit.com/*", id: 2 },
  { name: "YouTube", pattern: "*://*.youtube.com/*", id: 3 },
  {
    name: "Facebook Marketplace",
    pattern: "*://*.facebook.com/marketplace/*",
    id: 4,
  },
  { name: "ChatGPT", pattern: "*://*.openai.com/chat/*", id: 5 },
];

// Variables para seguimiento de tiempo
let startTime = null;
let currentSite = null;
let isTracking = false;
let currentTabId = null;
let currentUserId = null;
let localTimeData = {};

// Credenciales de Supabase
const SUPABASE_URL = "https://nmhphmzygssjibrzsoqn.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5taHBobXp5Z3Nzamlicnpzb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjI4MDEsImV4cCI6MjA1OTYzODgwMX0.IXvZ_NOMbdy79Ut8ofZSzLRk06DK7-EABwSN4kU5pQk";

// Inicializar y cargar datos de sitios
chrome.runtime.onInstalled.addListener(async () => {
  // Inicializar datos locales
  await chrome.storage.local.set({
    timeData: {},
    currentUser: null,
  });

  // Inicializar sitios en Supabase si no existen
  for (const site of TRACKED_SITES) {
    await checkAndCreateSite(site.name, site.id);
  }
});

// Función para comprobar y crear un sitio en la base de datos
async function checkAndCreateSite(siteName, siteId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sites?id=eq.${siteId}`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (data.length === 0) {
      // Si no existe, lo creamos
      await fetch(`${SUPABASE_URL}/rest/v1/sites`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: siteId,
          name: siteName,
        }),
      });
    }
  } catch (error) {
    console.error("Error al verificar/crear sitio:", error);
  }
}

// Escuchar cambios de pestaña
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Detener el seguimiento anterior si existe
  if (isTracking) {
    stopTracking();
  }

  currentTabId = activeInfo.tabId;
  await checkCurrentTab(currentTabId);
});

// Escuchar actualizaciones de pestañas
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === "complete") {
    await checkCurrentTab(tabId);
  }
});

// Verificar si la pestaña actual debe ser rastreada
async function checkCurrentTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);

    // Verificar si la URL de la pestaña pertenece a alguno de los sitios rastreados
    for (const site of TRACKED_SITES) {
      if (matchesPattern(tab.url, site.pattern)) {
        startTracking(site);
        return;
      }
    }

    // Si llegamos aquí, la pestaña no es un sitio rastreado
    currentSite = null;
    isTracking = false;
  } catch (error) {
    console.error("Error al verificar la pestaña actual:", error);
  }
}

// Función para verificar si una URL coincide con un patrón
function matchesPattern(url, pattern) {
  if (!url) return false;

  const patternUrl = pattern.replace(/\*/g, ".*").replace(/[.]/g, "\\.");

  const regex = new RegExp(`^${patternUrl}$`);
  return regex.test(url);
}

// Iniciar el seguimiento para un sitio
function startTracking(site) {
  if (currentUserId) {
    currentSite = site;
    startTime = Date.now();
    isTracking = true;

    // Notificar a la UI que se ha iniciado el seguimiento
    chrome.runtime.sendMessage({
      action: "trackingStarted",
      site: site.name,
    });
  }
}

// Detener el seguimiento y registrar el tiempo
function stopTracking() {
  if (!isTracking || !currentSite || !startTime) return;

  const endTime = Date.now();
  const timeSpent = endTime - startTime;

  // Guardar localmente
  saveTimeLocally(currentSite.id, timeSpent);

  // Guardar en Supabase
  if (currentUserId) {
    saveTimeToSupabase(currentUserId, currentSite.id, timeSpent);
  }

  // Restablecer variables
  isTracking = false;
  startTime = null;

  // Notificar a la UI que se ha detenido el seguimiento
  chrome.runtime.sendMessage({
    action: "trackingStopped",
    site: currentSite.name,
    timeSpent: timeSpent,
  });
}

// Guardar tiempo localmente
async function saveTimeLocally(siteId, timeSpent) {
  try {
    // Obtener datos actuales
    const data = await chrome.storage.local.get("timeData");
    const timeData = data.timeData || {};

    // Actualizar datos
    if (!timeData[siteId]) {
      timeData[siteId] = 0;
    }

    timeData[siteId] += timeSpent;

    // Guardar datos actualizados
    await chrome.storage.local.set({ timeData });
    localTimeData = timeData;
  } catch (error) {
    console.error("Error al guardar tiempo localmente:", error);
  }
}

// Guardar tiempo en Supabase
async function saveTimeToSupabase(userId, siteId, timeSpentMs) {
  try {
    // Convertir milisegundos a formato de tiempo de Postgres (HH:MM:SS)
    const seconds = Math.floor(timeSpentMs / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    const timeSpentFormatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

    // Verificar si ya existe un registro
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/time_in_site?user_id=eq.${userId}&site_id=eq.${siteId}`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );

    const existingRecords = await response.json();

    if (existingRecords.length > 0) {
      // Si existe, actualizar
      const existingRecord = existingRecords[0];

      // Obtener el tiempo existente y sumar el nuevo tiempo
      const existingTimeArr = existingRecord.time_spent.split(":").map(Number);
      const existingSeconds =
        existingTimeArr[0] * 3600 +
        existingTimeArr[1] * 60 +
        existingTimeArr[2];
      const totalSeconds = existingSeconds + seconds;

      // Convertir de nuevo a formato HH:MM:SS
      const updatedHours = Math.floor(totalSeconds / 3600);
      const updatedMinutes = Math.floor((totalSeconds % 3600) / 60);
      const updatedSeconds = totalSeconds % 60;
      const updatedTimeFormatted = `${String(updatedHours).padStart(2, "0")}:${String(updatedMinutes).padStart(2, "0")}:${String(updatedSeconds).padStart(2, "0")}`;

      await fetch(
        `${SUPABASE_URL}/rest/v1/time_in_site?id=eq.${existingRecord.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            time_spent: updatedTimeFormatted,
          }),
        },
      );
    } else {
      // Si no existe, crear nuevo
      await fetch(`${SUPABASE_URL}/rest/v1/time_in_site`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          site_id: siteId,
          time_spent: timeSpentFormatted,
        }),
      });
    }
  } catch (error) {
    console.error("Error al guardar tiempo en Supabase:", error);
  }
}

// Gestionar mensajes desde la UI
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "login") {
    await handleLogin(message.username);
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "getTimeData") {
    const response = {
      currentSite: currentSite ? currentSite.name : null,
      isTracking,
      timeData: localTimeData,
    };
    sendResponse(response);
    return true;
  }

  if (message.action === "getLeaderboard") {
    const leaderboard = await fetchLeaderboard();
    sendResponse({ leaderboard });
    return true;
  }
});

// Manejar inicio de sesión
async function handleLogin(username) {
  try {
    // Verificar si el usuario existe
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?name=eq.${encodeURIComponent(username)}`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );

    const users = await response.json();

    let userId;

    if (users.length === 0) {
      // Si no existe, crear nuevo usuario
      const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: username,
        }),
      });

      // Obtener ID del usuario recién creado
      const getUserResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?name=eq.${encodeURIComponent(username)}`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        },
      );

      const newUser = await getUserResponse.json();
      userId = newUser[0].id;
    } else {
      // Usuario existe
      userId = users[0].id;

      // Cargar datos de tiempo del usuario
      await loadUserTimeData(userId);
    }

    // Guardar ID de usuario
    currentUserId = userId;
    await chrome.storage.local.set({
      currentUser: { id: userId, name: username },
    });

    // Iniciar seguimiento si ya estamos en un sitio rastreado
    if (currentTabId) {
      await checkCurrentTab(currentTabId);
    }

    return true;
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return false;
  }
}

// Cargar datos de tiempo del usuario
async function loadUserTimeData(userId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/time_in_site?user_id=eq.${userId}`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );

    const records = await response.json();
    const timeData = {};

    for (const record of records) {
      const timeArr = record.time_spent.split(":");
      const totalSeconds =
        parseInt(timeArr[0]) * 3600 +
        parseInt(timeArr[1]) * 60 +
        parseInt(timeArr[2]);
      timeData[record.site_id] = totalSeconds * 1000; // Convertir a milisegundos
    }

    await chrome.storage.local.set({ timeData });
    localTimeData = timeData;
  } catch (error) {
    console.error("Error al cargar datos de tiempo del usuario:", error);
  }
}

// Obtener tabla de clasificación
async function fetchLeaderboard() {
  try {
    // Consulta para obtener los usuarios con más tiempo en cada sitio
    const query = `
      SELECT 
        u.name as user_name,
        s.name as site_name,
        t.time_spent
      FROM 
        time_in_site t
      JOIN 
        users u ON t.user_id = u.id
      JOIN 
        sites s ON t.site_id = s.id
      ORDER BY 
        s.name, t.time_spent DESC
    `;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: query,
      }),
    });

    if (!response.ok) {
      throw new Error("Error al obtener la tabla de clasificación");
    }

    const data = await response.json();

    // Organizar los datos por sitio
    const leaderboard = {};
    TRACKED_SITES.forEach((site) => {
      leaderboard[site.name] = [];
    });

    data.forEach((item) => {
      if (leaderboard[item.site_name]) {
        leaderboard[item.site_name].push({
          username: item.user_name,
          time: item.time_spent,
        });
      }
    });

    return leaderboard;
  } catch (error) {
    console.error("Error al obtener tabla de clasificación:", error);
    return {};
  }
}

// Evento para cuando Chrome se cierra
chrome.runtime.onSuspend.addListener(() => {
  if (isTracking) {
    stopTracking();
  }
});

// Cargar el usuario actual al iniciar
chrome.storage.local.get(["currentUser"], (result) => {
  if (result.currentUser) {
    currentUserId = result.currentUser.id;
    loadUserTimeData(currentUserId);
  }
});

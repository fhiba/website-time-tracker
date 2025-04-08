// Mapeo de sitios para IDs y nombres
const SITE_MAPPING = {
  1: { name: "Twitter", elemId: "time-twitter" },
  2: { name: "Reddit", elemId: "time-reddit" },
  3: { name: "YouTube", elemId: "time-youtube" },
  4: { name: "Facebook Marketplace", elemId: "time-facebook" },
  5: { name: "ChatGPT", elemId: "time-chatgpt" },
};

// Variables globales
let currentUser = null;
let timerInterval = null;
let startTime = null;
let isTracking = false;
let leaderboardData = {};
let currentLeaderboardSite = "Twitter";

// Elementos DOM
const loginSection = document.getElementById("login-section");
const userSection = document.getElementById("user-section");
const trackingStatus = document.getElementById("tracking-status");
const timeStats = document.getElementById("time-stats");
const leaderboardSection = document.getElementById("leaderboard-section");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const userNameSpan = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");
const currentSiteSpan = document.getElementById("current-site");
const trackingStateSpan = document.getElementById("tracking-state");
const timerElement = document.getElementById("timer");
const refreshLeaderboardBtn = document.getElementById("refresh-leaderboard");
const leaderboardTabBtns = document.querySelectorAll(".tab-btn");

// Inicializar
document.addEventListener("DOMContentLoaded", async () => {
  // Cargar usuario actual
  const data = await chrome.storage.local.get(["currentUser"]);
  if (data.currentUser) {
    currentUser = data.currentUser;
    showLoggedInUI();
  }

  // Configurar eventos
  setupEventListeners();

  // Actualizar estado de seguimiento
  updateTrackingStatus();

  // Actualizar estadísticas de tiempo
  updateTimeStats();

  // Cargar tabla de clasificación
  loadLeaderboard();
});

// Configurar eventos
function setupEventListeners() {
  // Formulario de inicio de sesión
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) {
      await handleLogin(username);
    }
  });

  // Botón de cierre de sesión
  logoutBtn.addEventListener("click", handleLogout);

  // Botón de actualizar tabla de clasificación
  refreshLeaderboardBtn.addEventListener("click", loadLeaderboard);

  // Botones de pestañas de la tabla de clasificación
  leaderboardTabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const site = e.target.dataset.site;
      currentLeaderboardSite = site;

      // Actualizar clase activa
      leaderboardTabBtns.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");

      // Actualizar tabla
      updateLeaderboardTable();
    });
  });
}

// Manejar inicio de sesión
async function handleLogin(username) {
  try {
    // Enviar mensaje al background script
    const response = await chrome.runtime.sendMessage({
      action: "login",
      username: username,
    });

    if (response.success) {
      // Obtener usuario actual
      const data = await chrome.storage.local.get(["currentUser"]);
      currentUser = data.currentUser;
      console.log("no user");

      // Mostrar UI de usuario conectado
      showLoggedInUI();
      console.log("no user 1");

      // Actualizar estadísticas de tiempo
      updateTimeStats();
      console.log("no user 2");

      // Cargar tabla de clasificación
      loadLeaderboard();
      console.log("no user 3");
    }
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    console.log("no user 4" + error);
    //alert("Error al iniciar sesión. Inténtalo de nuevo.");
  }
}

// Manejar cierre de sesión
async function handleLogout() {
  try {
    // Limpiar datos de usuario
    await chrome.storage.local.set({ currentUser: null });
    currentUser = null;

    // Mostrar UI de inicio de sesión
    showLoginUI();
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

// Mostrar UI de usuario conectado
function showLoggedInUI() {
  loginSection.classList.add("hidden");
  userSection.classList.remove("hidden");
  trackingStatus.classList.remove("hidden");
  timeStats.classList.remove("hidden");
  leaderboardSection.classList.remove("hidden");

  userNameSpan.textContent = currentUser ? currentUser.name : "";
}

// Mostrar UI de inicio de sesión
function showLoginUI() {
  loginSection.classList.remove("hidden");
  userSection.classList.add("hidden");
  trackingStatus.classList.add("hidden");
  timeStats.classList.add("hidden");
  leaderboardSection.classList.add("hidden");

  // Limpiar formulario
  loginForm.reset();
}

// Actualizar estado de seguimiento
async function updateTrackingStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getTimeData",
    });

    if (response) {
      // Actualizar elementos de la UI
      currentSiteSpan.textContent = response.currentSite || "Ninguno";
      trackingStateSpan.textContent = response.isTracking
        ? "Activo"
        : "Inactivo";

      // Actualizar temporizador
      if (response.isTracking && !isTracking) {
        // Iniciar temporizador
        startTimer();
      } else if (!response.isTracking && isTracking) {
        // Detener temporizador
        stopTimer();
      }

      isTracking = response.isTracking;
    }
  } catch (error) {
    console.error("Error al actualizar estado de seguimiento:", error);
  }

  // Programar próxima actualización
  setTimeout(updateTrackingStatus, 1000);
}

// Actualizar estadísticas de tiempo
async function updateTimeStats() {
  try {
    const data = await chrome.storage.local.get(["timeData"]);
    const timeData = data.timeData || {};

    // Actualizar cada sitio
    Object.keys(SITE_MAPPING).forEach((siteId) => {
      const site = SITE_MAPPING[siteId];
      const timeElement = document.getElementById(site.elemId);

      if (timeElement) {
        const timeMs = timeData[siteId] || 0;
        timeElement.textContent = formatTime(timeMs);
      }
    });
  } catch (error) {
    console.error("Error al actualizar estadísticas de tiempo:", error);
  }
}

// Iniciar temporizador
function startTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    timerElement.textContent = formatTime(elapsed);
  }, 1000);

  isTracking = true;
}

// Detener temporizador
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerElement.textContent = "00:00:00";
  isTracking = false;
}

// Cargar tabla de clasificación
async function loadLeaderboard() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getLeaderboard",
    });

    if (response && response.leaderboard) {
      leaderboardData = response.leaderboard;
      updateLeaderboardTable();
    }
  } catch (error) {
    console.error("Error al cargar tabla de clasificación:", error);
  }
}

// Actualizar tabla de clasificación
function updateLeaderboardTable() {
  const leaderboardBody = document.getElementById("leaderboard-body");
  leaderboardBody.innerHTML = "";

  const siteData = leaderboardData[currentLeaderboardSite] || [];

  if (siteData.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="3" class="text-center">No hay datos disponibles</td>
    `;
    leaderboardBody.appendChild(row);
    return;
  }

  // Crear filas para cada usuario
  siteData.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.username}</td>
      <td>${item.time}</td>
    `;
    leaderboardBody.appendChild(row);
  });
}

// Formatear tiempo en milisegundos a formato legible
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

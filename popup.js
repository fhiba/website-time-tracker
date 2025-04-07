document.addEventListener("DOMContentLoaded", () => {
  const siteTimesDiv = document.getElementById("site-times");
  const boardDiv = document.getElementById("board");
  const usernameInput = document.getElementById("username");
  const saveBtn = document.getElementById("save-btn");
  const refreshLeaderboardBtn = document.getElementById("refresh-leaderboard");

  // Función para formatear segundos a "Xm Ys"
  function formatSeconds(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}m ${sec}s`;
  }

  // Limpia los contenedores para evitar duplicados
  siteTimesDiv.innerHTML = "";
  boardDiv.innerHTML = "Loading...";

  // Definir grupos de dominios para unificar los tiempos
  const siteGroups = {
    Twitter: ["twitter.com", "x.com"],
    Reddit: ["reddit.com", "redd.it"],
    "Facebook Marketplace": ["facebook.com/marketplace"],
  };

  // Obtener todos los datos almacenados en chrome.storage.local y agruparlos
  chrome.storage.local.get(null, (result) => {
    Object.entries(siteGroups).forEach(([groupName, domains]) => {
      let totalSeconds = 0;
      domains.forEach((domain) => {
        const key = `time_${domain}`;
        totalSeconds += parseInt(result[key] || 0, 10);
      });

      const groupDiv = document.createElement("div");
      groupDiv.className = "site-entry";
      groupDiv.innerHTML = `
        <span>${groupName}</span>
        <span>${formatSeconds(totalSeconds)}</span>
      `;
      siteTimesDiv.appendChild(groupDiv);
    });
  });

  // Cargar el username guardado, si existe
  chrome.storage.sync.get(["username"], (data) => {
    if (data.username) {
      usernameInput.value = data.username;
    }
  });

  // Guardar el username
  saveBtn.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (username) {
      chrome.storage.sync.set({ username }, () => {
        alert("Username saved!");
      });
    }
  });

  // Función para cargar el leaderboard desde Supabase
  async function loadLeaderboard() {
    const SUPABASE_URL = "https://nmhphmzygssjibrzsoqn.supabase.co";
    const SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5taHBobXp5Z3Nzamlicnpzb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjI4MDEsImV4cCI6MjA1OTYzODgwMX0.IXvZ_NOMbdy79Ut8ofZSzLRk06DK7-EABwSN4kU5pQk";

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/user_times?select=*`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      const data = await res.json();

      // Agrupar tiempos por usuario
      const leaderboardMap = {};
      data.forEach((row) => {
        if (!leaderboardMap[row.username]) {
          leaderboardMap[row.username] = 0;
        }
        leaderboardMap[row.username] += row.time_spent;
      });

      // Ordenar de mayor a menor y construir el HTML
      const leaderboardArr = Object.entries(leaderboardMap).sort(
        (a, b) => b[1] - a[1],
      );
      let boardHTML = "";
      leaderboardArr.forEach(([user, time]) => {
        boardHTML += `
          <div class="leaderboard-entry">
            <span>${user}</span>
            <span>${formatSeconds(time)}</span>
          </div>
        `;
      });
      boardDiv.innerHTML = boardHTML || "No data available.";
    } catch (error) {
      console.error(error);
      boardDiv.innerHTML = "Error loading leaderboard.";
    }
  }

  // Cargar el leaderboard inicialmente
  loadLeaderboard();

  // Refrescar leaderboard al hacer click
  refreshLeaderboardBtn.addEventListener("click", () => {
    boardDiv.innerHTML = "Loading...";
    loadLeaderboard();
  });
});

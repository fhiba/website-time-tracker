// Configuración de Supabase (rellená con tus datos)
const SUPABASE_URL = "https://nmhphmzygssjibrzsoqn.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5taHBobXp5Z3Nzamlicnpzb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjI4MDEsImV4cCI6MjA1OTYzODgwMX0.IXvZ_NOMbdy79Ut8ofZSzLRk06DK7-EABwSN4kU5pQk";

// Guarda y recupera el usuario
document.getElementById("saveUser").addEventListener("click", () => {
  const username = document.getElementById("username").value.trim();
  if (username) {
    chrome.storage.sync.set({ username });
    alert("Usuario guardado!");
  }
});

// Formatear segundos a minutos y segundos
function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Mostrar los tiempos por sitio
function displayTimes() {
  // Las claves en storage tienen el formato "time_<site>"
  chrome.storage.local.get(null, (result) => {
    const keys = Object.keys(result).filter((k) => k.startsWith("time_"));
    let html = "";
    if (keys.length === 0) {
      html = "No hay datos aún.";
    } else {
      keys.forEach((key) => {
        const site = key.replace("time_", "");
        html += `<strong>${site}</strong>: ${formatSeconds(result[key])}<br>`;
      });
    }
    document.getElementById("times").innerHTML = html;
  });
}

// Enviar datos a Supabase
async function sendTimes() {
  chrome.storage.sync.get(["username"], (syncData) => {
    const username = syncData.username;
    if (!username) {
      alert("Primero guarda tu nombre de usuario");
      return;
    }

    // Obtenemos todos los tiempos guardados
    chrome.storage.local.get(null, async (localData) => {
      const entries = Object.entries(localData).filter(([key]) =>
        key.startsWith("time_"),
      );
      if (entries.length === 0) {
        alert("No hay tiempos para enviar");
        return;
      }

      // Por cada sitio, enviar un objeto a Supabase
      // Usamos Prefer: resolution=merge-duplicates para hacer upsert (reemplazar tiempo)
      const payload = entries.map(([key, time]) => {
        const site = key.replace("time_", "");
        return { username, site, time_spent: time };
      });

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
        if (res.ok) {
          alert("¡Tiempos enviados!");
          // Opcional: limpiar los tiempos locales después de enviar
          entries.forEach(([key]) => chrome.storage.local.remove(key));
          displayTimes();
          loadLeaderboard();
        } else {
          console.error("Error al enviar:", data);
          alert("Error al enviar los datos");
        }
      } catch (error) {
        console.error(error);
        alert("Error de red");
      }
    });
  });
}

document.getElementById("send").addEventListener("click", sendTimes);

// Cargar y mostrar el leaderboard
async function loadLeaderboard() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_times?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await res.json();
    // Agrupar por usuario y sumar tiempos (puede haber varias filas por sitio)
    const leaderboardMap = {};
    data.forEach((row) => {
      if (!leaderboardMap[row.username]) {
        leaderboardMap[row.username] = 0;
      }
      leaderboardMap[row.username] += row.time_spent;
    });

    // Convertir a array y ordenar
    const leaderboardArr = Object.entries(leaderboardMap).sort(
      (a, b) => b[1] - a[1],
    );
    const boardText = leaderboardArr
      .map(([user, time]) => `${user}: ${formatSeconds(time)}`)
      .join("\n");
    document.getElementById("board").innerText = boardText || "Sin datos";
  } catch (error) {
    console.error(error);
    document.getElementById("board").innerText = "Error al cargar leaderboard";
  }
}

// Al cargar el popup, mostramos los tiempos guardados y el leaderboard
displayTimes();
loadLeaderboard();

document.addEventListener("DOMContentLoaded", () => {
  const siteTimesDiv = document.getElementById("site-times");
  const usernameInput = document.getElementById("username");
  const saveBtn = document.getElementById("save-btn");

  // Mostrar tiempos por sitio
  const trackedSites = [
    "twitter.com",
    "reddit.com",
    "facebook.com/marketplace",
  ];

  trackedSites.forEach((site) => {
    const key = `time_${site}`;
    chrome.storage.local.get([key], (result) => {
      const seconds = result[key] || 0;
      const el = document.createElement("div");
      el.className =
        "flex justify-between items-center bg-white p-3 rounded-lg shadow";
      el.innerHTML = `
        <span class="text-gray-800 font-medium">${site}</span>
        <span class="text-sm text-gray-600">${formatSeconds(seconds)}</span>
      `;
      siteTimesDiv.appendChild(el);
    });
  });

  // Cargar username si existe
  chrome.storage.sync.get(["username"], (data) => {
    if (data.username) {
      usernameInput.value = data.username;
    }
  });

  // Guardar username
  saveBtn.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (username) {
      chrome.storage.sync.set({ username }, () => {
        alert("Username guardado!");
      });
    }
  });
});

function formatSeconds(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}m ${sec}s`;
}

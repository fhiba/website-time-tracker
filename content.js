window.addEventListener("beforeunload", () => {
  chrome.runtime.sendMessage("tracked_tab_closed");
});

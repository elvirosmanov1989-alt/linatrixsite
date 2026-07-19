import { apiFetch, getCurrentUser } from "./api.js";

async function refreshCounters() {
  const countersList = document.getElementById("sharedCountersList");
  if (!countersList) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  let data;
  try {
    data = await apiFetch("/requests/connections");
  } catch (err) {
    console.error(err);
    return;
  }

  countersList.innerHTML = "";
  data.connections.forEach((connection) => {
    countersList.innerHTML += `
      <div class="message">
        <strong>Shared Counter</strong>
        <br><br>
        Members: ${connection.members.join(", ")}
      </div>
    `;
  });
}

const POLL_INTERVAL_MS = 8000;
window.addEventListener("DOMContentLoaded", () => {
  refreshCounters();
  setInterval(refreshCounters, POLL_INTERVAL_MS);
});

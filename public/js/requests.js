import { apiFetch } from "./api.js";

window.acceptRequest = async function (requestId) {
  try {
    await apiFetch(`/requests/${requestId}/accept`, { method: "POST" });
    alert("Family connection created");
    await refreshRequests();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

async function refreshRequests() {
  const notifications = document.getElementById("notificationsList");
  if (!notifications) return;
  let data;
  try {
    data = await apiFetch("/requests");
  } catch (err) {
    console.error(err);
    return;
  }
  notifications.innerHTML = "";
  data.requests.forEach((request) => {
    notifications.innerHTML += `
      <div class="message">
        <strong>${request.from_username}</strong> wants family connection.
        <br><br>
        <button class="mainBtn" onclick="acceptRequest('${request.id}')">Accept</button>
      </div>
    `;
  });
}

const POLL_INTERVAL_MS = 8000;
window.addEventListener("DOMContentLoaded", () => {
  refreshRequests();
  setInterval(refreshRequests, POLL_INTERVAL_MS);
});
window.addEventListener("auth:ready", refreshRequests);

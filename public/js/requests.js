import { apiFetch } from "./api.js";

window.acceptRequest = async function (requestId) {
  try {
    await apiFetch(`/requests/${requestId}/accept`, { method: "POST" });
    alert("Joined the family");
    await refreshRequests();
    if (window.refreshFamilies) await window.refreshFamilies();
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
  if (data.requests.length === 0) {
    notifications.innerHTML = `<p class="emptyHint">No pending requests.</p>`;
    return;
  }
  notifications.innerHTML = "";
  data.requests.forEach((request) => {
    notifications.innerHTML += `
      <div class="message">
        <strong>${request.from_username}</strong> invited you to join <strong>${request.family_name}</strong>.
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


import { apiFetch, getCurrentUser } from "./api.js";

window.sendFamilyRequest = async function (toUsername) {
  try {
    await apiFetch("/requests", {
      method: "POST",
      body: JSON.stringify({ toUsername }),
    });
    alert("Request sent");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

async function refreshUsers() {
  const usersList = document.getElementById("usersList");
  if (!usersList) return;
  let data, connectionsData;
  try {
    data = await apiFetch("/users");
    connectionsData = await apiFetch("/requests/connections");
  } catch (err) {
    console.error(err);
    return;
  }
  const currentUser = getCurrentUser();
  const connectedUsernames = new Set();
  (connectionsData.connections || []).forEach((conn) => {
    conn.members.forEach((m) => {
      if (currentUser && m !== currentUser.username) connectedUsernames.add(m);
    });
  });
  usersList.innerHTML = "";
  data.users.forEach((user) => {
    const isConnected = connectedUsernames.has(user.username);
    usersList.innerHTML += `
      <div class="message">
        <strong>${user.username}</strong>
        <br><br>
        ${
          isConnected
            ? `<h3>Already Family</h3>`
            : `<button class="mainBtn" onclick="sendFamilyRequest('${user.username}')">Send Request</button>`
        }
      </div>
    `;
  });
}

window.addEventListener("DOMContentLoaded", refreshUsers);
window.addEventListener("auth:ready", refreshUsers);

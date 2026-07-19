import { apiFetch } from "./api.js";

let socket;

function renderMessage(message) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;
  const time = new Date(message.created_at || Date.now()).toLocaleTimeString();
  chatMessages.innerHTML += `
    <div class="message">
      <strong>${message.username}</strong>
      <br>
      ${message.text}
      <br><br>
      <small>${time}</small>
    </div>
  `;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendMessage = async function () {
  const input = document.getElementById("chatInput");
  if (input.value.trim() === "") return;
  try {
    await apiFetch("/messages", {
      method: "POST",
      body: JSON.stringify({ text: input.value.trim() }),
    });
    input.value = "";
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

async function loadHistory() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;
  try {
    const data = await apiFetch("/messages");
    chatMessages.innerHTML = "";
    data.messages.forEach(renderMessage);
  } catch (err) {
    console.error(err);
  }
}

function connectSocket() {
  if (typeof io === "undefined") {
    console.error("socket.io-client not loaded - check index.html script tag");
    return;
  }
  socket = io(window.API_BASE || "http://localhost:3000");
  socket.on("chat:message", renderMessage);
}

window.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  connectSocket();
});
window.addEventListener("auth:ready", loadHistory);

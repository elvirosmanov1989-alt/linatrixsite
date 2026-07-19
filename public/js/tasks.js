import { apiFetch, getCurrentUser } from "./api.js";

window.addTask = async function () {
  const input = document.getElementById("taskInput");
  if (input.value.trim() === "") return;
  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({ text: input.value.trim() }),
    });
    input.value = "";
    await refreshTasks();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.completeTask = async function (taskId) {
  try {
    const result = await apiFetch(`/tasks/${taskId}/complete`, { method: "POST" });
    if (result.alreadyCompleted) {
      alert("You already completed this today");
    }
    await refreshTasks();
    await refreshStats();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

async function refreshTasks() {
  const taskList = document.getElementById("taskList");
  if (!taskList) return;
  let data;
  try {
    data = await apiFetch("/tasks");
  } catch (err) {
    console.error(err);
    return;
  }
  const currentUser = getCurrentUser();
  taskList.innerHTML = "";
  data.tasks.forEach((task) => {
    const completedToday = currentUser && task.completedToday.includes(currentUser.username);
    const completedUsers = task.completedToday.length ? task.completedToday.join(", ") : "Nobody yet";
    taskList.innerHTML += `
      <div class="task ${completedToday ? "completed" : ""}">
        <h2>${task.text}</h2>
        <p>Created by: ${task.createdBy || "Unknown"}</p>
        <p>Completed today by: ${completedUsers}</p>
        ${
          !completedToday
            ? `<button class="completeBtn" onclick="completeTask('${task.id}')">Complete Today</button>`
            : `<h3>You Completed This Today</h3>`
        }
      </div>
    `;
  });
}

async function refreshStats() {
  const statsList = document.getElementById("statsList");
  if (!statsList) return;
  let data;
  try {
    data = await apiFetch("/stats/today");
  } catch (err) {
    console.error(err);
    return;
  }
  statsList.innerHTML = "";
  data.stats.forEach(({ username, count }) => {
    statsList.innerHTML += `<h3>${username}: ${count}</h3>`;
  });
}

const POLL_INTERVAL_MS = 5000;
window.addEventListener("DOMContentLoaded", () => {
  refreshTasks();
  refreshStats();
  setInterval(refreshTasks, POLL_INTERVAL_MS);
  setInterval(refreshStats, POLL_INTERVAL_MS);
});
window.addEventListener("auth:ready", () => {
  refreshTasks();
  refreshStats();
});

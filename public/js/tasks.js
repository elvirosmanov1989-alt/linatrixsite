import { apiFetch, getCurrentUser } from "./api.js";

const SUGGESTED_TASKS = [
  "Take out the trash",
  "Walk the dog",
  "Do the dishes",
  "Vacuum the living room",
  "Water the plants",
  "Grocery shopping",
  "Laundry",
  "Clean the bathroom",
  "Homework check-in",
  "Take out recycling",
];

window.addTask = async function (presetText) {
  const input = document.getElementById("taskInput");
  const text = (presetText || input.value).trim();
  if (!text) return;

  const select = document.getElementById("taskFamilySelect");
  const familyId = select && select.value ? select.value : (window.myFamilies[0] && window.myFamilies[0].id);
  if (!familyId) {
    alert("Create or join a family first");
    return;
  }

  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({ text, familyId }),
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

function renderSuggestedTasks() {
  const container = document.getElementById("suggestedTasksList");
  if (!container) return;
  container.innerHTML = SUGGESTED_TASKS.map(
    (text) => `<button type="button" class="suggestionChip" onclick="addTask('${text.replace(/'/g, "\\'")}')">${text}</button>`
  ).join("");
}

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
  if (data.tasks.length === 0) {
    taskList.innerHTML = `<p class="emptyHint">No tasks yet. Add one to get started.</p>`;
    return;
  }
  taskList.innerHTML = "";
  data.tasks.forEach((task) => {
    const completedToday = currentUser && task.completedToday.includes(currentUser.username);
    const completedUsers = task.completedToday.length ? task.completedToday.join(", ") : "Nobody yet";
    taskList.innerHTML += `
      <div class="task ${completedToday ? "completed" : ""}">
        <p class="taskFamilyTag">${task.familyName}</p>
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
  if (data.stats.length === 0) {
    statsList.innerHTML = `<p class="emptyHint">No completions yet today.</p>`;
    return;
  }
  statsList.innerHTML = "";
  data.stats.forEach(({ username, count }) => {
    statsList.innerHTML += `<h3>${username}: ${count}</h3>`;
  });
}

const POLL_INTERVAL_MS = 5000;
window.addEventListener("DOMContentLoaded", () => {
  renderSuggestedTasks();
  refreshTasks();
  refreshStats();
  setInterval(refreshTasks, POLL_INTERVAL_MS);
  setInterval(refreshStats, POLL_INTERVAL_MS);
});
window.addEventListener("auth:ready", () => {
  refreshTasks();
  refreshStats();
});
window.addEventListener("families:changed", () => {
  refreshTasks();
});


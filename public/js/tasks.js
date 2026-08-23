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

  if (!input) return;

  const text = (presetText || input.value).trim();

  if (!text) return;

  const select = document.getElementById("taskFamilySelect");

  const familyId =
    select && select.value
      ? select.value
      : window.currentFamilyId ||
        (window.myFamilies[0] && window.myFamilies[0].id);

  if (!familyId) {
    alert("Create or join a family first");
    return;
  }

  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({
        text,
        familyId,
      }),
    });

    input.value = "";

    await refreshTasks();

    if (window.refreshFamilyTasks && window.currentFamilyId) {
      await window.refreshFamilyTasks(window.currentFamilyId);
    }
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.addFamilyTask = async function () {
  const input = document.getElementById("familyTaskInput");

  if (!input) return;

  const text = input.value.trim();

  if (!text) return;

  const familyId = window.currentFamilyId;

  if (!familyId) {
    alert("Please select a family first");
    return;
  }

  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({
        text,
        familyId,
      }),
    });

    input.value = "";

    await window.refreshFamilyTasks(familyId);
    await refreshTasks();
    await refreshStats();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.addSuggestedFamilyTask = async function (text) {
  const familyId = window.currentFamilyId;

  if (!familyId) {
    alert("Please select a family first");
    return;
  }

  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({
        text,
        familyId,
      }),
    });

    await window.refreshFamilyTasks(familyId);
    await refreshTasks();
    await refreshStats();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.completeTask = async function (taskId) {
  try {
    const result = await apiFetch(
      `/tasks/${taskId}/complete`,
      { method: "POST" }
    );

    if (result.alreadyCompleted) {
      alert("You already completed this today");
    }

    await refreshTasks();
    await refreshStats();

    if (window.currentFamilyId && window.refreshFamilyTasks) {
      await window.refreshFamilyTasks(window.currentFamilyId);
    }
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

function renderSuggestedTasks() {
  const container = document.getElementById("suggestedTasksList");

  if (!container) return;

  container.innerHTML = SUGGESTED_TASKS.map(
    (text) =>
      `<button
        type="button"
        class="suggestionChip"
        onclick="addTask('${text.replace(/'/g, "\\'")}')"
      >${text}</button>`
  ).join("");
}

async function refreshTasks() {
  const taskList = document.getElementById("taskList");

  if (!taskList) return;

  try {
    const data = await apiFetch("/tasks");
    const currentUser = getCurrentUser();

    if (data.tasks.length === 0) {
      taskList.innerHTML =
        `<p class="emptyHint">No tasks yet. Add one to get started.</p>`;
      return;
    }

    taskList.innerHTML = "";

    data.tasks.forEach((task) => {
      const completedToday =
        currentUser &&
        task.completedToday.includes(currentUser.username);

      const completedUsers =
        task.completedToday.length
          ? task.completedToday.join(", ")
          : "Nobody yet";

      taskList.innerHTML += `
        <div class="task ${completedToday ? "completed" : ""}">
          <p class="taskFamilyTag">${task.familyName}</p>
          <h2>${task.text}</h2>
          <p>Created by: ${task.createdBy || "Unknown"}</p>
          <p>Completed today by: ${completedUsers}</p>

          ${
            !completedToday
              ? `<button
                  class="completeBtn"
                  onclick="completeTask('${task.id}')"
                >Complete Today</button>`
              : `<h3>You Completed This Today</h3>`
          }
        </div>
      `;
    });
  } catch (error) {
    console.error(error);
  }
}

window.refreshFamilyTasks = async function (familyId) {
  const taskList = document.getElementById("familyTaskList");

  if (!taskList) return;

  try {
    const data = await apiFetch("/tasks");
    const currentUser = getCurrentUser();

    const family = window.myFamilies.find(
      (fam) => String(fam.id) === String(familyId)
    );

    if (!family) {
      taskList.innerHTML =
        `<p class="emptyHint">Family not found.</p>`;
      return;
    }

    const familyTasks = data.tasks.filter(
      (task) => task.familyName === family.name
    );

    if (familyTasks.length === 0) {
      taskList.innerHTML =
        `<p class="emptyHint">No tasks in this family yet.</p>`;
      return;
    }

    taskList.innerHTML = "";

    familyTasks.forEach((task) => {
      const completedToday =
        currentUser &&
        task.completedToday.includes(currentUser.username);

      const completedUsers =
        task.completedToday.length
          ? task.completedToday.join(", ")
          : "Nobody yet";

      taskList.innerHTML += `
        <div class="task ${completedToday ? "completed" : ""}">
          <h2>${task.text}</h2>

          <p>Created by: ${task.createdBy || "Unknown"}</p>

          <p>Completed today by: ${completedUsers}</p>

          ${
            !completedToday
              ? `<button
                  class="completeBtn"
                  onclick="completeTask('${task.id}')"
                >Complete Today</button>`
              : `<h3>You Completed This Today</h3>`
          }
        </div>
      `;
    });
  } catch (error) {
    console.error(error);
  }
};

async function refreshStats() {
  const statsList = document.getElementById("statsList");

  if (!statsList) return;

  try {
    const data = await apiFetch("/stats/today");

    if (data.stats.length === 0) {
      statsList.innerHTML =
        `<p class="emptyHint">No completions yet today.</p>`;
      return;
    }

    statsList.innerHTML = "";

    data.stats.forEach(({ username, count }) => {
      statsList.innerHTML += `<h3>${username}: ${count}</h3>`;
    });
  } catch (error) {
    console.error(error);
  }
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

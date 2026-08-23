import { apiFetch } from "./api.js";

window.myFamilies = [];
window.currentFamilyId = null;

window.createFamily = async function (inputId) {
  const input = document.getElementById(inputId);
  const name = input.value.trim();

  if (!name) return;

  try {
    await apiFetch("/families", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    input.value = "";
    await refreshFamilies();
    window.dispatchEvent(new Event("families:changed"));
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

function renderOnboarding(hasFamilies) {
  const onboarding = document.getElementById("onboarding");
  const mainApp = document.getElementById("mainAppContent");

  if (!onboarding || !mainApp) return;

  onboarding.style.display = hasFamilies ? "none" : "block";
  mainApp.style.display = hasFamilies ? "block" : "none";
}

function renderFamiliesList() {
  const list = document.getElementById("familiesList");

  if (!list) return;

  if (window.myFamilies.length === 0) {
    list.innerHTML =
      `<p class="emptyHint">You're not in a family yet.</p>`;
    return;
  }

  list.innerHTML = window.myFamilies
    .map(
      (fam) => `
        <div
          class="familyCard"
          onclick="openFamily('${fam.id}')"
          style="cursor:pointer;"
        >
          <p class="familyCardName">${fam.name}</p>
          <p class="familyCardMembers">${fam.members.join(", ")}</p>
        </div>
      `
    )
    .join("");
}

function renderFamilySelect(selectId) {
  const select = document.getElementById(selectId);

  if (!select) return;

  select.innerHTML = window.myFamilies
    .map(
      (fam) =>
        `<option value="${fam.id}">${fam.name}</option>`
    )
    .join("");

  select.style.display =
    window.myFamilies.length > 1 ? "block" : "none";
}

window.refreshFamilies = async function () {
  try {
    const data = await apiFetch("/families/mine");

    window.myFamilies = data.families || [];

    renderOnboarding(window.myFamilies.length > 0);
    renderFamiliesList();

    renderFamilySelect("taskFamilySelect");
    renderFamilySelect("inviteFamilySelect");
  } catch (error) {
    console.error(error);
  }
};

window.openFamily = function (familyId) {
  const family = window.myFamilies.find(
    (fam) => String(fam.id) === String(familyId)
  );

  if (!family) return;

  window.currentFamilyId = family.id;

  const dashboard = document.getElementById("mainContent");
  const familyView = document.getElementById("familyView");

  if (!dashboard || !familyView) return;

  dashboard.style.display = "none";
  familyView.style.display = "block";

  const nameElement = document.getElementById("familyViewName");
  const membersElement = document.getElementById("familyViewMembers");

  if (nameElement) {
    nameElement.textContent = family.name;
  }

  if (membersElement) {
    membersElement.innerHTML = family.members
      .map(
        (member) =>
          `<span class="familyMember">${member}</span>`
      )
      .join("");
  }

  if (window.refreshFamilyTasks) {
    window.refreshFamilyTasks(family.id);
  }
};

window.closeFamily = function () {
  window.currentFamilyId = null;

  const dashboard = document.getElementById("mainContent");
  const familyView = document.getElementById("familyView");

  if (!dashboard || !familyView) return;

  familyView.style.display = "none";
  dashboard.style.display = "block";
};

window.addEventListener("auth:ready", refreshFamilies);

if (window.__authReady) {
  refreshFamilies();
}

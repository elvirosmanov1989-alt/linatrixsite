import { apiFetch } from "./api.js";

window.myFamilies = [];

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
    list.innerHTML = `<p class="emptyHint">You're not in a family yet.</p>`;
    return;
  }
  list.innerHTML = window.myFamilies
    .map(
      (fam) => `
      <div class="familyCard">
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
    .map((fam) => `<option value="${fam.id}">${fam.name}</option>`)
    .join("");
  select.style.display = window.myFamilies.length > 1 ? "block" : "none";
}

window.refreshFamilies = async function () {
  let data;
  try {
    data = await apiFetch("/families/mine");
  } catch (err) {
    console.error(err);
    return;
  }
  window.myFamilies = data.families || [];
  renderOnboarding(window.myFamilies.length > 0);
  renderFamiliesList();
  renderFamilySelect("taskFamilySelect");
  renderFamilySelect("inviteFamilySelect");
};

window.addEventListener("auth:ready", refreshFamilies);


import { apiFetch } from "./api.js";

window.sendFamilyRequest = async function (toUsername) {
  const select = document.getElementById("inviteFamilySelect");
  const familyId = select && select.value ? select.value : (window.myFamilies[0] && window.myFamilies[0].id);
  if (!familyId) {
    alert("Create a family first");
    return;
  }
  try {
    await apiFetch("/requests", {
      method: "POST",
      body: JSON.stringify({ toUsername, familyId }),
    });
    alert("Invite sent");
    document.getElementById("inviteSearchInput").value = "";
    document.getElementById("inviteResults").innerHTML = "";
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

let searchDebounce;
window.onInviteSearchInput = function () {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runInviteSearch, 250);
};

async function runInviteSearch() {
  const input = document.getElementById("inviteSearchInput");
  const results = document.getElementById("inviteResults");
  if (!input || !results) return;
  const q = input.value.trim();
  if (!q) {
    results.innerHTML = "";
    return;
  }
  let data;
  try {
    data = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
  } catch (err) {
    console.error(err);
    return;
  }
  if (data.users.length === 0) {
    results.innerHTML = `<p class="emptyHint">No matching users.</p>`;
    return;
  }
  results.innerHTML = data.users
    .map(
      (user) => `
      <div class="message">
        <strong>${user.username}</strong>
        <br><br>
        <button class="mainBtn" onclick="sendFamilyRequest('${user.username}')">Invite</button>
      </div>
    `
    )
    .join("");
}


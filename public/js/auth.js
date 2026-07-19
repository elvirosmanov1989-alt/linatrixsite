import { apiFetch, setToken, setCurrentUser, getCurrentUser, getToken } from "./api.js";

/* REGISTER */
window.register = async function () {
  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if (!username || !email || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    alert("Registered successfully");
    document.getElementById("registerUsername").value = "";
    document.getElementById("registerEmail").value = "";
    document.getElementById("registerPassword").value = "";
    showLogin();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

/* LOGIN */
window.login = async function () {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!username || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    setCurrentUser(data.user);
    alert("Logged in successfully");
    await enterApp();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

/* LOGOUT */
window.logout = async function () {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch (err) {}
  setToken(null);
  setCurrentUser(null);
  document.getElementById("auth").style.display = "block";
  document.getElementById("app").style.display = "none";
};

/* AUTH STATE */
async function enterApp() {
  document.getElementById("auth").style.display = "none";
  document.getElementById("app").style.display = "block";
  const user = getCurrentUser();
  if (user) {
    document.getElementById("welcomeUser").innerText = "Welcome, " + user.username;
  }
  window.dispatchEvent(new Event("auth:ready"));
}

async function checkAuthOnLoad() {
  const token = getToken();
  if (!token) {
    document.getElementById("auth").style.display = "block";
    document.getElementById("app").style.display = "none";
    return;
  }
  try {
    const data = await apiFetch("/auth/me");
    setCurrentUser(data.user);
    await enterApp();
  } catch (err) {
    setToken(null);
    setCurrentUser(null);
    document.getElementById("auth").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
}

window.addEventListener("DOMContentLoaded", checkAuthOnLoad);

window.toggleChat = function () {

  const popup =
    document.getElementById("chatPopup");



  if (
    popup.style.display === "block"
  ) {

    popup.style.display = "none";

  }

  else {

    popup.style.display = "block";

  }

};









window.openUsersPopup = function () {

  document.getElementById("usersPopup").style.display =
    "block";

};









window.closeUsersPopup = function () {

  document.getElementById("usersPopup").style.display =
    "none";

};
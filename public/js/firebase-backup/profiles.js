import {

  db,
  auth

}

from "./firebase.js";



import {

  ref,
  onValue,
  push,
  get

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";







const usersRef =
  ref(db, "users");









onValue(usersRef, async (snapshot) => {

  const usersList =
    document.getElementById("usersList");



  if (!usersList)
    return;





  usersList.innerHTML = "";





  const data =
    snapshot.val();





  if (!data)
    return;





  const currentUser =
    auth.currentUser;





  if (!currentUser)
    return;





  const currentSnapshot =

    await get(

      ref(db, "users/" + currentUser.uid)

    );





  const currentData =
    currentSnapshot.val();





  Object.entries(data).forEach(([uid, user]) => {





    if (
      uid === currentUser.uid
    ) return;





    usersList.innerHTML += `

      <div class="message">

        <strong>

          ${user.username}

        </strong>

        <br><br>

        <button
          class="mainBtn"
          onclick="sendFamilyRequest(
            '${user.username}'
          )">

          Send Request

        </button>

      </div>

    `;

  });

});









window.sendFamilyRequest = async function (toUser) {

  const currentUser =
    auth.currentUser;





  const snapshot =

    await get(

      ref(db, "users/" + currentUser.uid)

    );





  const currentData =
    snapshot.val();





  push(

    ref(db, "familyRequests"),

    {

      from:
        currentData.username,

      to:
        toUser,

      status:
        "pending"

    }

  );





  alert("Request sent");

};
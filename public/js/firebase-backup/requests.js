import {

  db,
  auth

}

from "./firebase.js";



import {

  ref,
  onValue,
  update,
  push,
  get

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";







const requestsRef =
  ref(db, "familyRequests");









onValue(requestsRef, async (snapshot) => {

  const notifications =
    document.getElementById("notificationsList");



  if (!notifications)
    return;





  notifications.innerHTML = "";





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





  Object.entries(data).forEach(([id, request]) => {





    if (

      request.to === currentData.username &&
      request.status === "pending"

    ) {





      notifications.innerHTML += `

        <div class="message">

          <strong>

            ${request.from}

          </strong>

          wants family connection.

          <br><br>

          <button
            class="mainBtn"
            onclick="acceptRequest(
              '${id}',
              '${request.from}',
              '${request.to}'
            )">

            Accept

          </button>

        </div>

      `;

    }

  });

});









window.acceptRequest = async function (

  requestId,
  fromUser,
  toUser

) {

  await update(

    ref(db, "familyRequests/" + requestId),

    {

      status:
        "accepted"

    }

  );





  push(

    ref(db, "familyConnections"),

    {

      users: {

        [fromUser]: true,
        [toUser]: true

      }

    }

  );





  alert("Family connection created");

};
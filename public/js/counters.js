import {

  db,
  auth

}

from "./firebase.js";



import {

  ref,
  onValue,
  get

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";







const countersRef =
  ref(db, "familyConnections");









onValue(countersRef, async (snapshot) => {

  const countersList =
    document.getElementById("sharedCountersList");



  if (!countersList)
    return;





  countersList.innerHTML = "";





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





  const currentUsername =
    currentData.username;









  Object.entries(data).forEach(([id, counter]) => {





    const users =
      Object.keys(counter.users);





    if (
      !users.includes(currentUsername)
    ) return;





    countersList.innerHTML += `

      <div class="message">

        <strong>

          Shared Counter

        </strong>

        <br><br>

        Members:
        ${users.join(", ")}

      </div>

    `;

  });

});
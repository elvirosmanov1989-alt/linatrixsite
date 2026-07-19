import {

  db,
  auth

}

from "./firebase.js";



import {

  ref,
  push,
  onValue,
  get

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";







const messagesRef =
  ref(db, "messages");









window.sendMessage = async function () {

  const input =
    document.getElementById("chatInput");



  if (input.value.trim() === "")
    return;





  const user =
    auth.currentUser;





  const snapshot =

    await get(

      ref(db, "users/" + user.uid)

    );





  const userData =
    snapshot.val();





  push(messagesRef, {

    username:
      userData.username,

    text:
      input.value,

    time:
      new Date().toLocaleTimeString()

  });





  input.value = "";

};









onValue(messagesRef, (snapshot) => {

  const chatMessages =
    document.getElementById("chatMessages");



  chatMessages.innerHTML = "";





  const data =
    snapshot.val();





  if (!data)
    return;





  Object.values(data).forEach((message) => {



    chatMessages.innerHTML += `

      <div class="message">

        <strong>

          ${message.username}

        </strong>

        <br>

        ${message.text}

        <br><br>

        <small>

          ${message.time}

        </small>

      </div>

    `;

  });

});
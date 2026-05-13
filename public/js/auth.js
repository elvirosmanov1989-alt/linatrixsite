import {

  auth,
  db

}

from "./firebase.js";



import {

  createUserWithEmailAndPassword,

  signInWithEmailAndPassword,

  onAuthStateChanged,

  signOut

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";



import {

  ref,

  set,

  get

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";







/* =========================
   REGISTER
========================= */

window.register = async function () {

  const username =

    document.getElementById("registerUsername").value.trim();



  const email =

    document.getElementById("registerEmail").value.trim();



  const password =

    document.getElementById("registerPassword").value.trim();





  if (!username || !email || !password) {

    alert("Fill all fields");

    return;

  }





  try {

    const userCredential =

      await createUserWithEmailAndPassword(

        auth,
        email,
        password

      );





    const user =
      userCredential.user;





    await set(

      ref(db, "users/" + user.uid),

      {

        username:
          username,

        email:
          email

      }

    );





    alert("Registered successfully");





    document.getElementById("registerUsername").value = "";

    document.getElementById("registerEmail").value = "";

    document.getElementById("registerPassword").value = "";





    showLogin();

  }

  catch (error) {

    console.error(error);

    alert(error.message);

  }

};







/* =========================
   LOGIN
========================= */

window.login = async function () {

  const username =

    document.getElementById("loginUsername").value.trim();



  const password =

    document.getElementById("loginPassword").value.trim();





  if (!username || !password) {

    alert("Fill all fields");

    return;

  }





  try {

    const snapshot =
      await get(ref(db, "users"));





    const users =
      snapshot.val();





    if (!users) {

      alert("No users found");

      return;

    }





    let foundEmail = null;





    Object.values(users).forEach((user) => {

      if (user.username === username) {

        foundEmail = user.email;

      }

    });





    if (!foundEmail) {

      alert("Username not found");

      return;

    }





    await signInWithEmailAndPassword(

      auth,
      foundEmail,
      password

    );





    alert("Logged in successfully");

  }

  catch (error) {

    console.error(error);

    alert(error.message);

  }

};







/* =========================
   LOGOUT
========================= */

window.logout = async function () {

  await signOut(auth);

};







/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth, async (user) => {

  if (user) {

    document.getElementById("auth").style.display =
      "none";



    document.getElementById("app").style.display =
      "block";





    const snapshot =

      await get(

        ref(db, "users/" + user.uid)

      );





    const userData =
      snapshot.val();





    if (userData) {

      document.getElementById("welcomeUser").innerText =

        "Welcome, " + userData.username;

    }

  }

  else {

    document.getElementById("auth").style.display =
      "block";



    document.getElementById("app").style.display =
      "none";

  }

});
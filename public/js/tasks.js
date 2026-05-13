import {

  db,
  auth

}

from "./firebase.js";



import {

  ref,
  push,
  onValue,
  update,
  get

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";







const tasksRef =
  ref(db, "tasks");









function getTodayDate() {

  return new Date()
    .toISOString()
    .split("T")[0];

}









window.addTask = async function () {

  const input =
    document.getElementById("taskInput");



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





  push(tasksRef, {

    text:
      input.value,

    createdBy:
      userData.username,

    completionHistory: {}

  });





  input.value = "";

};









window.completeTask = async function (taskId) {

  const today =
    getTodayDate();





  const user =
    auth.currentUser;





  const userSnapshot =

    await get(

      ref(db, "users/" + user.uid)

    );





  const userData =
    userSnapshot.val();





  const username =
    userData.username;





  const taskSnapshot =

    await get(

      ref(db, "tasks/" + taskId)

    );





  const task =
    taskSnapshot.val();





  if (

    task.completionHistory &&
    task.completionHistory[today] &&
    task.completionHistory[today][username]

  ) {

    alert("You already completed this today");

    return;

  }





  await update(

    ref(db, "tasks/" + taskId),

    {

      [`completionHistory/${today}/${username}`]:
        true

    }

  );





  const statsRef =
    ref(db, "dailyStats/" + today);





  const statsSnapshot =
    await get(statsRef);





  let stats =
    statsSnapshot.val() || {};





  if (!stats[username]) {

    stats[username] = 0;

  }





  stats[username]++;





  await update(statsRef, stats);

};









onValue(tasksRef, async (snapshot) => {

  const taskList =
    document.getElementById("taskList");



  taskList.innerHTML = "";





  const data =
    snapshot.val();





  if (!data)
    return;





  const today =
    getTodayDate();





  const user =
    auth.currentUser;





  if (!user)
    return;





  const userSnapshot =

    await get(

      ref(db, "users/" + user.uid)

    );





  const userData =
    userSnapshot.val();





  const username =
    userData.username;









  Object.entries(data).forEach(([id, task]) => {





    const completedToday =

      task.completionHistory &&
      task.completionHistory[today] &&
      task.completionHistory[today][username];





    const completedUsers =

      task.completionHistory &&
      task.completionHistory[today]

      ?

      Object.keys(

        task.completionHistory[today]

      ).join(", ")

      :

      "Nobody yet";









    taskList.innerHTML += `

      <div class="task ${completedToday ? "completed" : ""}">

        <h2>

          ${task.text}

        </h2>



        <p>

          Created by:
          ${task.createdBy || "Unknown"}

        </p>



        <p>

          Completed today by:
          ${completedUsers}

        </p>





        ${

          !completedToday

          ?

          `

          <button
            class="completeBtn"
            onclick="completeTask('${id}')">

            Complete Today

          </button>

          `

          :

          `

          <h3>
            ✅ You Completed This Today
          </h3>

          `

        }

      </div>

    `;

  });

});









const statsRef =
  ref(db, "dailyStats");









onValue(statsRef, (snapshot) => {

  const data =
    snapshot.val() || {};





  const today =
    getTodayDate();





  const todayStats =
    data[today] || {};





  const statsList =
    document.getElementById("statsList");





  statsList.innerHTML = "";





  Object.entries(todayStats)

    .sort((a, b) => b[1] - a[1])

    .forEach(([username, count]) => {





      statsList.innerHTML += `

        <h3>

          ${username}: ${count}

        </h3>

      `;

    });

});
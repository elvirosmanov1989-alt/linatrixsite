import { initializeApp }

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";



import {

  getDatabase

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";



import {

  getAuth

}

from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";





const firebaseConfig = {

  apiKey:
  "AIzaSyAIMxMTyOJBdfsDSbsNXPazrpDpIzbLUDQ",

  authDomain:
  "family-task-app-4407d.firebaseapp.com",

  databaseURL:
  "https://family-task-app-4407d-default-rtdb.firebaseio.com",

  projectId:
  "family-task-app-4407d",

  storageBucket:
  "family-task-app-4407d.firebasestorage.app",

  messagingSenderId:
  "1081523131491",

  appId:
  "1:1081523131491:web:cf6b678f82b429ef6bd456"

};





const app =
  initializeApp(firebaseConfig);





export const db =
  getDatabase(app);





export const auth =
  getAuth(app);
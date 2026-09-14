import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    doc, 
    updateDoc, 
    deleteDoc, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtQWnvp-Rf6uSuO9p3jTxiyGwfAYPYpL0",
  authDomain: "resid-qaime.firebaseapp.com",
  projectId: "resid-qaime",
  storageBucket: "resid-qaime.firebasestorage.app",
  messagingSenderId: "699887002366",
  appId: "1:699887002366:web:3cec7c39e47a81912ebbaf"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Bütün modulları vahid paket olaraq export edirik ki, app.js rahatlıqla istifadə edə bilsin
export { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    where
};
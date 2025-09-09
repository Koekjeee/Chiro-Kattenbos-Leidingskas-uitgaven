// config.js
export const firebaseConfig = {
  apiKey: "AIzaSyA2--5vxLThr-jq5WHHboSakHgbjyBSFm0",
  authDomain: "leidingskas.firebaseapp.com",
  databaseURL: "https://leidingskas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "leidingskas",
  storageBucket: "leidingskas-default-rtdb.appspot.com",
  messagingSenderId: "4767553066",
  appId: "1:4767553066:web:6018139d9ac3e044bc1553",
  measurementId: "G-XRD72XNPCR"
};

export const alleGroepen = [
  "Ribbels","Speelclubs","Rakkers","Kwiks",
  "Tippers","Toppers","Aspi","LEIDING"
];

export const groepKleuren = {
  Ribbels: "#cce5ff", Speelclubs: "#ffe5cc",
  Rakkers: "#e5ffcc", Kwiks: "#ffccf2",
  Tippers: "#d5ccff", Toppers: "#ccffd5",
  Aspi: "#ffd5cc", LEIDING: "#dddddd"
};

// compat initialisatie
firebase.initializeApp(firebaseConfig);
export const db      = firebase.database();
export const storage = firebase.storage();

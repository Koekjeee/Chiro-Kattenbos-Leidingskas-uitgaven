// 1. Configuratie en initialisatie (dit moet helemaal bovenaan)
const firebaseConfig = {
  apiKey: "AIzaSyA2--5vxLThr-jq5WHHboSakHgbjyBSFm0",
  authDomain: "leidingskas.firebaseapp.com",
  databaseURL: "https://leidingskas-default-rtdb.europe-west1.firebasedatabase.app/",  // <-- pas aan!
  projectId: "leidingskas",
  storageBucket: "leidingskas.firebasestorage.app",
  messagingSenderId: "4767553066",
  appId: "1:4767553066:web:6018139d9ac3e044bc1553",
  measurementId: "G-XRD72XNPCR"
};

// Firebase init
firebase.initializeApp(firebaseConfig);

// Verwijs naar je Realtime Database
const db = firebase.database();


// 2. Functie om nieuwe uitgave toe te voegen
document.getElementById("uitgaveForm").addEventListener("submit", function(e) {
  e.preventDefault();

  // lees formulierwaarden uit
  const uitgave = {
    groep: document.getElementById("groep").value,
    bedrag: parseFloat(document.getElementById("bedrag").value) || 0,
    activiteit: document.getElementById("activiteit").value,
    datum: document.getElementById("datum").value,
    betaald: document.getElementById("betaald").checked
  };

  // push naar Firebase
  db.ref("uitgaven").push(uitgave)
    .then(() => {
      console.log("Uitgave opgeslagen:", uitgave);
      // formulier leegmaken
      document.getElementById("uitgaveForm").reset();
    })
    .catch(err => console.error("Fout bij opslaan:", err));
});


// 3. Functie om uitgaven realtime weer te geven in de tabel
db.ref("uitgaven").on("value", function(snapshot) {
  const tbody = document.querySelector("#overzicht tbody");
  tbody.innerHTML = "";  // eerst leegmaken

  snapshot.forEach(childSnapshot => {
    const data = childSnapshot.val();
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${data.groep}</td>
      <td>€${data.bedrag.toFixed(2)}</td>
      <td>${data.activiteit}</td>
      <td>${data.datum}</td>
      <td>${data.betaald ? "✅" : "❌"}</td>
    `;
    tbody.appendChild(row);
  });
});

document.getElementById("uitgaveForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const uitgave = {
    groep: document.getElementById("groep").value,
    bedrag: parseFloat(document.getElementById("bedrag").value),
    activiteit: document.getElementById("activiteit").value,
    datum: document.getElementById("datum").value,
    betaald: document.getElementById("betaald").checked
  };

  db.ref("uitgaven").push(uitgave);
});

db.ref("uitgaven").on("value", function(snapshot) {
  const tbody = document.querySelector("#overzicht tbody");
  tbody.innerHTML = "";

  snapshot.forEach(function(childSnapshot) {
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



// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA2--5vxLThr-jq5WHHboSakHgbjyBSFm0",
  authDomain: "leidingskas.firebaseapp.com",
  projectId: "leidingskas",
  storageBucket: "leidingskas.firebasestorage.app",
  messagingSenderId: "4767553066",
  appId: "1:4767553066:web:6018139d9ac3e044bc1553",
  measurementId: "G-XRD72XNPCR"
};

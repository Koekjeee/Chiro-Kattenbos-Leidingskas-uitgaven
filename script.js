document.addEventListener("DOMContentLoaded", function () {
  const alleGroepen = [
    "Ribbels", "Speelclubs", "Rakkers", "Kwiks",
    "Tippers", "Toppers", "Aspi", "LEIDING"
  ];

  const groepKleuren = {
    Ribbels: "#cce5ff", Speelclubs: "#ffe5cc", Rakkers: "#e5ffcc",
    Kwiks: "#ffccf2", Tippers: "#d5ccff", Toppers: "#ccffd5",
    Aspi: "#ffd5cc", LEIDING: "#dddddd"
  };

  let huidigeGebruiker = null;
  let gebruikersData = null;

  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/<jouw-cloud-name>/upload";
  const CLOUDINARY_PRESET = "chiro_upload_fotos";

  async function uploadBewijs(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  function setupSummaryToggle() {
    const btn = document.getElementById("toggleSummary");
    const content = document.getElementById("summaryContent");
    btn.addEventListener("click", () => {
      const open = content.style.display === "block";
      content.style.display = open ? "none" : "block";
      btn.textContent = (open ? "▸" : "▾") + " Toon uitgaven per groep";
      if (!open) renderSamenvatting();
    });
  }

  function renderSamenvatting() {
    const lijst = document.getElementById("groepSamenvatting");
    lijst.innerHTML = "";
    const totals = {};
    alleGroepen.forEach(g => totals[g] = 0);

    firebase.database().ref("uitgaven").once("value", snapshot => {
      const data = snapshot.val() || {};
      Object.values(data).forEach(u => {
        if (magZien(u.groep)) {
          totals[u.groep] += parseFloat(u.bedrag);
        }
      });

      alleGroepen.forEach(groep => {
        const bedrag = totals[groep].toFixed(2);
        const li = document.createElement("li");
        li.style.backgroundColor = groepKleuren[groep] || "#fff";
        li.textContent = groep;
        const span = document.createElement("span");
        span.textContent = `€${bedrag}`;
        li.appendChild(span);
        lijst.appendChild(li);
      });
    });
  }

  function renderTabel(filterGroep = "", filterBetaald = "") {
    const tbody = document.querySelector("#overzicht tbody");
    tbody.innerHTML = "";
    firebase.database().ref("uitgaven").once("value", snap => {
      const data = snap.val() || {};
      Object.values(data)
        .filter(u =>
          magZien(u.groep) &&
          (!filterGroep || u.groep === filterGroep) &&
          (filterBetaald === "" || String(u.betaald) === filterBetaald)
        )
        .sort((a, b) => b.nummer - a.nummer)
        .forEach(u => {
          const rij = tbody.insertRow();
          rij.style.backgroundColor = groepKleuren[u.groep] || "#fff";

          rij.insertCell(0).textContent = u.nummer;
          rij.insertCell(1).textContent = u.groep;
          rij.insertCell(2).textContent = `€${u.bedrag}`;
          rij.insertCell(3).textContent = u.activiteit;
          rij.insertCell(4).textContent = u.datum;
          rij.insertCell(5).textContent = u.betaald ? "✅" : "❌";

          const bewijsCel = rij.insertCell(6);
          if (u.bewijsUrl) {
            const img = document.createElement("img");
            img.src = u.bewijsUrl;
            img.alt = "Bewijsstuk";
            img.style.maxWidth = "100px";
            img.style.cursor = "pointer";
            img.onclick = () => {
              document.getElementById("overlayImage").src = u.bewijsUrl;
              document.getElementById("imageOverlay").style.display = "flex";
            };
            bewijsCel.appendChild(img);
          }

          const c7 = rij.insertCell(7);
          const btn = document.createElement("button");
          btn.textContent = "Verwijder";
          btn.className = "verwijder";
          btn.onclick = () => {
            if (magBeheren(u.groep)) {
              firebase.database().ref("uitgaven/" + u.nummer).remove();
              renderTabel(
                document.getElementById("filterGroep").value,
                document.getElementById("filterBetaald").value
              );
            } else {
              alert("Je hebt geen rechten om deze uitgave te verwijderen.");
            }
          };
          c7.appendChild(btn);

          const c8 = rij.insertCell(8);
          c8.className = "betaald-toggle";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = u.betaald;
          cb.onchange = () => {
            if (magBeheren(u.groep)) {
              firebase.database().ref("uitgaven/" + u.nummer)
                .update({ betaald: cb.checked }, err => {
                  if (!err) {
                    renderTabel(
                      document.getElementById("filterGroep").value,
                      document.getElementById("filterBetaald").value
                    );
                  }
                });
            } else {
              alert("Je hebt geen rechten om dit aan te passen.");
              cb.checked = !cb.checked;
            }
          };
          c8.appendChild(cb);
        });
    });
  }

  document.getElementById("uitgaveForm").addEventListener("submit", async e => {
    e.preventDefault();
    const g = document.getElementById("groep").value;
    const b = parseFloat(document.getElementById("bedrag").value) || 0;
    const a = document.getElementById("activiteit").value;
    const d = document.getElementById("datum").value;
    const p = document.getElementById("betaald").checked;
    const file = document.getElementById("bewijsUpload").files[0];

    if (!g || isNaN(b) || !a || !d) {
      return alert("Gelieve alle velden correct in te vullen.");
    }

    if (!magIndienen(g)) {
      return alert("Je mag geen uitgave indienen voor deze groep.");
    }

    let bewijsUrl = "";
    if (file) {
      try {
        bewijsUrl = await uploadBewijs(file);
      } catch (err) {
        console.error("Upload mislukt:", err);
        return alert("Upload van bewijsstuk is mislukt.");
      }
    }

    const id = Date.now();
    const obj = {
      nummer: id,
      groep: g,
      bedrag: b.toFixed(2),
      activiteit: a,
      datum: d,
      betaald: p,
      bewijsUrl: bewijsUrl,
      status: "in_behandeling"
    };

    firebase.database().ref("uitgaven/" + id).set(obj, err => {
      if (!err) {
        document.getElementById("uitgaveForm").reset();
        renderTabel(
          document.getElementById("filterGroep").value,
          document.getElementById("filterBetaald").value
        );
      }
    });
  });

  document.getElementById("filterGroep").addEventListener("change", e =>
    renderTabel(e.target.value, document.getElementById("filterBetaald").value)
  );

  document.getElementById("filterBetaald").addEventListener("change", e =>
    renderTabel(document.getElementById("filterGroep").value, e.target.value)
  );

  // 🔐 Rechtencontrole
  function magZien(groep) {
    if (!gebruikersData) return false;
    return gebruikersData.rol === "financieel" || gebruikersData.groep === groep;
  }

  function magIndienen(groep) {
    if (!gebruikersData) return false;
    return gebruikersData.rol === "financieel

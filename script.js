document.addEventListener("DOMContentLoaded", () => {
  // → Groepen en kleuren
  const alleGroepen = [
    "Ribbels", "Speelclubs", "Rakkers", "Kwiks",
    "Tippers", "Toppers", "Aspi", "LEIDING"
  ];

  const groepKleuren = {
    Ribbels: "#cce5ff", Speelclubs: "#ffe5cc", Rakkers: "#e5ffcc",
    Kwiks: "#ffccf2", Tippers: "#d5ccff", Toppers: "#ccffd5",
    Aspi: "#ffd5cc", LEIDING: "#dddddd"
  };

  // → Cloudinary-config
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/<jouw-cloud-name>/upload";
  const CLOUDINARY_PRESET = "chiro_upload_fotos";

  let huidigeGebruiker = null;
  let gebruikersData = null;

  // → Haal gebruikersprofiel (rol + groep)
  function haalGebruikersData(uid) {
    return firebase
      .database()
      .ref("gebruikers/" + uid)
      .once("value")
      .then(snap => snap.val());
  }

  // → Permissies
  function magZien(groep) {
    return (
      gebruikersData &&
      (gebruikersData.rol === "financieel" || gebruikersData.groep === groep)
    );
  }

  function magIndienen(groep) {
    return (
      gebruikersData &&
      (gebruikersData.rol === "financieel" || gebruikersData.groep === groep)
    );
  }

  function magBeheren() {
    return gebruikersData && gebruikersData.rol === "financieel";
  }

  // → Vul groep-selectie op basis van rol
  function vulGroepSelectie() {
    const select = document.getElementById("groep");
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    const toegestane = gebruikersData.rol === "financieel"
      ? alleGroepen
      : [gebruikersData.groep];

    toegestane.forEach(g => {
      select.innerHTML += `<option>${g}</option>`;
    });
  }

  // → Toon of verberg beheerpaneel
  function toonBeheerPaneel() {
    document.getElementById("beheerPaneel").style.display = magBeheren()
      ? "block"
      : "none";
  }

  // → Samenvatting toggler
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

  // → Render samenvatting per groep
  function renderSamenvatting() {
    const lijst = document.getElementById("groepSamenvatting");
    lijst.innerHTML = "";
    const totals = {};
    alleGroepen.forEach(g => (totals[g] = 0));

    firebase
      .database()
      .ref("uitgaven")
      .once("value")
      .then(snap => {
        const data = snap.val() || {};
        Object.values(data).forEach(u => {
          if (magZien(u.groep)) {
            totals[u.groep] += parseFloat(u.bedrag);
          }
        });

        alleGroepen.forEach(g => {
          const bedrag = totals[g].toFixed(2);
          const li = document.createElement("li");
          li.style.backgroundColor = groepKleuren[g] || "#fff";
          li.textContent = g;
          const span = document.createElement("span");
          span.textContent = `€${bedrag}`;
          li.appendChild(span);
          lijst.appendChild(li);
        });
      });
  }

  // → Render uitgaven-tabel
  function renderTabel(filterGroep = "", filterBetaald = "") {
    const tbody = document.querySelector("#overzicht tbody");
    tbody.innerHTML = "";

    // Bouw de query: leiding alleen eigen groep, financieel alles
    let query = firebase.database().ref("uitgaven");
    if (gebruikersData && gebruikersData.rol === "leiding") {
      query = query.orderByChild("groep").equalTo(gebruikersData.groep);
    }

    // Haal de data één keer op
    query
      .once("value")
      .then(snap => {
        const data = snap.val() || {};
        Object.values(data)
          .filter(u =>
            (!filterGroep || u.groep === filterGroep) &&
            (filterBetaald === "" || String(u.betaald) === filterBetaald)
          )
          .sort((a, b) => b.nummer - a.nummer)
          .forEach(u => {
            const rij = tbody.insertRow();

            // Groep
            rij.insertCell(0).textContent = u.groep;
            // Bedrag
            rij.insertCell(1).textContent = `€${u.bedrag}`;
            // Activiteit
            rij.insertCell(2).textContent = u.activiteit;
            // Datum
            rij.insertCell(3).textContent = u.datum;
            // Bewijs
            const bewijsCell = rij.insertCell(4);
            if (u.bewijsUrl) {
              const link = document.createElement("a");
              link.href = u.bewijsUrl;
              link.textContent = "Bekijk";
              link.target = "_blank";
              bewijsCell.appendChild(link);
            } else {
              bewijsCell.textContent = "-";
            }
            // Status
            rij.insertCell(5).textContent = u.status || "";

            // Verwijder-knop
            const c6 = rij.insertCell(6);
            const btn = document.createElement("button");
            btn.textContent = "Verwijder";
            btn.className = "verwijder";
            btn.disabled = !magBeheren();
            btn.onclick = () => {
              if (magBeheren()) {
                firebase.database().ref("uitgaven/" + u.nummer).remove();
                renderTabel(
                  document.getElementById("filterGroep").value,
                  document.getElementById("filterBetaald").value
                );
              }
            };
            c6.appendChild(btn);

            // Checkbox betaald
            const c7 = rij.insertCell(7);
            c7.className = "betaald-toggle";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = u.betaald;
            cb.disabled = !magBeheren();
            cb.onchange = () => {
              if (magBeheren()) {
                firebase
                  .database()
                  .ref("uitgaven/" + u.nummer)
                  .update({ betaald: cb.checked }, err => {
                    if (!err) {
                      renderTabel(
                        document.getElementById("filterGroep").value,
                        document.getElementById("filterBetaald").value
                      );
                    }
                  });
              } else {
                cb.checked = !cb.checked;
              }
            };
            c7.appendChild(cb);
          });
      })
      .catch(err => {
        console.error("Lezen uitgaven mislukt:", err);
      });
  }

  // → PDF-export setup
  function setupPdfExport() {
    const btn = document.getElementById("exportPdfBtn");
    btn.addEventListener("click", async () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Timestamp
      const now = new Date();
      const timestamp = now.toLocaleString("nl-NL", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(10);
      doc.text(timestamp, pageWidth - 20, 10, { align: "right" });

      // Titel
      let y = 20;
      doc.setFontSize(16);
      doc.text("Uitgaven activiteitenkas per groep", 20, y);
      y += 10;

      // Data per groep
      const perGroep = {};
      alleGroepen.forEach(g => (perGroep[g] = []));
      const snap = await firebase.database().ref("uitgaven").once("value");
      const data = snap.val() || {};
      Object.values(data).forEach(u => {
        if (magZien(u.groep)) perGroep[u.groep].push(u);
      });

      alleGroepen.forEach(groep => {
        const items = perGroep[groep];
        if (!items.length) return;

        doc.setFontSize(14);
        doc.text(groep, 20, y);
        y += 8;
        doc.setFontSize(11);

        items.forEach(u => {
          const regel = `${u.datum} – €${u.bedrag} – ${u.activiteit} ` +
                        (u.betaald ? "(Betaald)" : "(Niet betaald)");
          doc.text(regel, 25, y);
          y += 6;
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
        });

        y += 8;
      });

      doc.save("uitgaven_activiteitenkas_per_groep.pdf");
    });
  }

  // → Upload bewijsstuk
  async function uploadBewijs(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    return data.secure_url;
  }

  // → Login
  document.getElementById("loginKnop").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value;
    const wachtwoord = document.getElementById("loginWachtwoord").value;
    const fout = document.getElementById("loginFout");
    firebase.auth()
      .signInWithEmailAndPassword(email, wachtwoord)
      .catch(err => { fout.textContent = "Login mislukt: " + err.message; });
  });

  // → Logout
  document.getElementById("logoutKnop").addEventListener("click", () => {
    firebase.auth().signOut();
  });

  // → Auth-state & initialisatie
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      huidigeGebruiker = user;
      gebruikersData = (await haalGebruikersData(user.uid)) || {};

      document.getElementById("loginScherm").style.display = "none";
      document.getElementById("appInhoud").style.display = "block";
      document.getElementById("loginFout").textContent = "";

      document.getElementById("gebruikerInfo").textContent =
        `Ingelogd als ${gebruikersData.rol} (${gebruikersData.groep})`;

      vulGroepSelectie();
      setupSummaryToggle();
      setupPdfExport();
      renderTabel();
      toonBeheerPaneel();
    } else {
      document.getElementById("appInhoud").style.display = "none";
      document.getElementById("loginScherm").style.display = "block";
      document.getElementById("loginFout").textContent = "";
    }
  });

  // → Gebruiker rollen toewijzen
  document.getElementById("rolForm").addEventListener("submit", e => {
    e.preventDefault();
    const uid = document.getElementById("userUid").value.trim();
    const groep = document.getElementById("userGroep").value;
    const rol = document.getElementById("userRol").value;
    if (!uid || !groep || !rol) return alert("Vul alle velden in.");

    firebase.database().ref("gebruikers/" + uid).set({ groep, rol })
      .then(() => {
        alert("Gebruiker opgeslagen");
        document.getElementById("rolForm").reset();
      })
      .catch(err => alert("Opslaan mislukt: " + err.message));
  });

  // → Uitgave toevoegen
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
      try { bewijsUrl = await uploadBewijs(file); }
      catch { return alert("Upload bewijsstuk mislukt."); }
    }

    const id = Date.now();
    firebase.database().ref("uitgaven/" + id).set({
      nummer: id,
      groep: g,
      bedrag: b.toFixed(2),
      activiteit: a,
      datum: d,
      betaald: p,
      bewijsUrl,
      status: "in_behandeling"
    })
    .then(() => {
      document.getElementById("uitgaveForm").reset();
      renderTabel(
        document.getElementById("filterGroep").value,
        document.getElementById("filterBetaald").value
      );
    })
    .catch(err => alert("Opslaan mislukt: " + err.message));
  });

  // → Filters
  document.getElementById("filterGroep").addEventListener("change", e => {
    renderTabel(e.target.value, document.getElementById("filterBetaald").value);
  });
  document.getElementById("filterBetaald").addEventListener("change", e => {
    renderTabel(document.getElementById("filterGroep").value, e.target.value);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  // Groepen en kleuren
  const alleGroepen = [
    "Ribbels", "Speelclubs", "Rakkers", "Kwiks",
    "Tippers", "Toppers", "Aspi", "LEIDING"
  ];
  const groepKleuren = {
    Ribbels: "#cce5ff", Speelclubs: "#ffe5cc", Rakkers: "#e5ffcc",
    Kwiks: "#ffccf2", Tippers: "#d5ccff", Toppers: "#ccffd5",
    Aspi: "#ffd5cc", LEIDING: "#dddddd"
  };

  // Cloudinary-config
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/<jouw-cloud-name>/upload";
  const CLOUDINARY_PRESET = "chiro_upload_fotos";

  let huidigeGebruiker = null;
  let gebruikersData = null;
  let ledenPerGroep = {};

  // Firebase helpers
  function haalGebruikersData(uid) {
    return firebase.database().ref("gebruikers/" + uid).once("value").then(snap => snap.val());
  }
  function haalLedenPerGroep() {
    return firebase.database().ref("ledenPerGroep").once("value").then(snap => snap.val() || {});
  }
  function haalLedenPerGroep() {
  return firebase.database().ref("ledenPerGroep").once("value").then(snap => snap.val() || {});
}

  // Permissies
  function magZien(groep) {
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magIndienen(groep) {
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magBeheren() {
    return gebruikersData && gebruikersData.rol === "financieel";
  }

  // UI helpers
  function toonBeheerPaneel() {
    document.getElementById("beheerPaneel").style.display = magBeheren() ? "block" : "none";
  }
  function vulGroepSelectie() {
    const select = document.getElementById("groep");
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    const toegestane = gebruikersData.rol === "financieel" ? alleGroepen : [gebruikersData.groep];
    toegestane.forEach(g => { select.innerHTML += `<option>${g}</option>`; });
  }
  function toonFinancieelFeatures() {
    const summaryBtn = document.getElementById("toggleSummary");
    const exportBtn = document.getElementById("exportPdfBtn");
    if (magBeheren()) {
      if (summaryBtn) summaryBtn.style.display = "block";
      if (exportBtn) exportBtn.style.display = "block";
    } else {
      if (summaryBtn) summaryBtn.style.display = "none";
      if (exportBtn) exportBtn.style.display = "none";
    }
  }
  function toonFinancieelKolommen() {
    const betaaldKolom = document.querySelector("#overzicht th:nth-child(6), #overzicht td:nth-child(6)");
    const actieKolom = document.querySelector("#overzicht th:nth-child(7), #overzicht td:nth-child(7)");
    const toggle = magBeheren();
    if (betaaldKolom) betaaldKolom.style.display = toggle ? "table-cell" : "none";
    if (actieKolom) actieKolom.style.display = toggle ? "table-cell" : "none";
  }

  // Samenvatting per groep (met ledenaantal bewerkbaar)
  function renderSamenvatting() {
    const tbody = document.querySelector("#groepSamenvattingTabel tbody");
    tbody.innerHTML = "";
    const totals = {};
    alleGroepen.forEach(g => (totals[g] = 0));

    firebase.database().ref("uitgaven").once("value").then(snap => {
      const data = snap.val() || {};
      Object.values(data).forEach(u => {
        if (magZien(u.groep)) totals[u.groep] += parseFloat(u.bedrag);
      });

      alleGroepen.forEach(g => {
        const bedrag = totals[g].toFixed(2);
        const leden = ledenPerGroep[g] || 0;
        const euroPerKind = leden > 0 ? (totals[g] / leden).toFixed(2) : "0.00";
        const rij = document.createElement("tr");
        rij.style.backgroundColor = groepKleuren[g] || "#fff";
        rij.innerHTML = `
          <td><b>${g}</b></td>
          <td>
            ${magBeheren() 
              ? `<input type="number" min="0" name="${g}" value="${leden}" style="width:60px;">`
              : leden}
          </td>
          <td>€${bedrag}</td>
          <td><span style="color:#27ae60">€${euroPerKind}</span></td>
        `;
        tbody.appendChild(rij);
      });

      document.getElementById("ledenOpslaanBtn").style.display = magBeheren() ? "inline-block" : "none";
    });
  }

  // Uitgaven-tabel
  function renderTabel(filterGroep = "", filterBetaald = "") {
    const tbody = document.querySelector("#overzicht tbody");
    tbody.innerHTML = "";

    let query = firebase.database().ref("uitgaven");
    if (gebruikersData && gebruikersData.rol === "leiding") {
      query = query.orderByChild("groep").equalTo(gebruikersData.groep);
    }

    query.once("value").then(snap => {
      const data = snap.val() || {};
      Object.values(data)
        .filter(u =>
          (!filterGroep || u.groep === filterGroep) &&
          (filterBetaald === "" || String(u.betaald) === filterBetaald)
        )
        .sort((a, b) => a.nummer - b.nummer)
        .forEach(u => {
          const rij = tbody.insertRow();
          rij.style.backgroundColor = groepKleuren[u.groep] || "#ffd5f2";
          rij.insertCell(0).textContent = u.nummer || "-";
          rij.insertCell(1).textContent = u.groep || "-";
          rij.insertCell(2).textContent = u.bedrag ? `€${u.bedrag}` : "-";
          rij.insertCell(3).textContent = u.activiteit || "-";
          rij.insertCell(4).textContent = u.datum || "-";
          const betaaldStatusCell = rij.insertCell(5);
          betaaldStatusCell.className = "betaald-status";
          betaaldStatusCell.textContent = u.betaald ? "✓" : "✗";
          betaaldStatusCell.style.color = u.betaald ? "#27ae60" : "#e74c3c";

          if (magBeheren()) {
            const actieCell = rij.insertCell(6);
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
            actieCell.appendChild(btn);

            const betaaldCell = rij.insertCell(7);
            betaaldCell.className = "betaald-toggle";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = u.betaald;
            cb.disabled = !magBeheren();
            cb.onchange = () => {
              if (magBeheren()) {
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
                cb.checked = !cb.checked;
              }
            };
            betaaldCell.appendChild(cb);
          }
        });
    }).catch(err => {
      console.error("Lezen uitgaven mislukt:", err);
    });
  }

  // PDF-export
  function setupPdfExport() {
    const btn = document.getElementById("exportPdfBtn");
    btn.addEventListener("click", async () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const now = new Date();
      const timestamp = now.toLocaleString("nl-NL", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(10);
      doc.text(timestamp, pageWidth - 20, 10, { align: "right" });
      let y = 20;
      doc.setFontSize(16);
      doc.text("Uitgaven activiteitenkas per groep", 20, y);
      y += 10;
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
          const regel = `#${u.nummer} – ${u.datum} – €${u.bedrag} – ${u.activiteit} ` +
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

  // Cloudinary upload bewijsstuk
  async function uploadBewijs(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  // Auth & initialisatie
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      huidigeGebruiker = user;
      gebruikersData = (await haalGebruikersData(user.uid)) || {};
      ledenPerGroep = await haalLedenPerGroep();
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
      toonFinancieelFeatures();
      toonFinancieelKolommen();
    } else {
      document.getElementById("appInhoud").style.display = "none";
      document.getElementById("loginScherm").style.display = "block";
      document.getElementById("loginFout").textContent = "";
    }
  });

  // Login/Logout
  document.getElementById("loginKnop").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value;
    const wachtwoord = document.getElementById("loginWachtwoord").value;
    const fout = document.getElementById("loginFout");
    firebase.auth()
      .signInWithEmailAndPassword(email, wachtwoord)
      .catch(err => { fout.textContent = "Login mislukt: " + err.message; });
  });
  document.getElementById("logoutKnop").addEventListener("click", () => {
    firebase.auth().signOut();
  });

  // Gebruiker rollen toewijzen
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

  // Uitgave toevoegen
  document.getElementById("uitgaveForm").addEventListener("submit", async e => {
    e.preventDefault();
    const g = document.getElementById("groep").value;
    const b = parseFloat(document.getElementById("bedrag").value) || 0;
    const a = document.getElementById("activiteit").value;
    const d = document.getElementById("datum").value;
    const p = document.getElementById("betaald").checked;
    const rekeningNummer = document.getElementById("rekeningNummer").value.trim();
    if (!rekeningNummer) return alert("Vul je rekeningnummer in.");
    const file = document.getElementById("bewijsUpload").files[0];
    if (!file) return alert("Upload een bewijsstuk.");
    if (!g || isNaN(b) || !a || !d) return alert("Gelieve alle velden correct in te vullen.");
    if (!magIndienen(g)) return alert("Je mag geen uitgave indienen voor deze groep.");

    let bewijsUrl = "";
    if (file) {
      try { bewijsUrl = await uploadBewijs(file); }
      catch { return alert("Upload bewijsstuk mislukt."); }
    }

    // Uniek nummer genereren
    const uitgavenRef = firebase.database().ref("uitgaven");
    uitgavenRef.once("value").then(snap => {
      const data = snap.val() || {};
      const nummers = Object.values(data).map(u => u.nummer || 0);
      let nieuwNummer;
      do {
        nieuwNummer = Math.floor(1000 + Math.random() * 9000);
      } while (nummers.includes(nieuwNummer));

      uitgavenRef.child(nieuwNummer).set({
        nummer: nieuwNummer,
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
  });

  // Filters
  document.getElementById("filterGroep").addEventListener("change", e => {
    renderTabel(e.target.value, document.getElementById("filterBetaald").value);
  });
  document.getElementById("filterBetaald").addEventListener("change", e => {
    renderTabel(document.getElementById("filterGroep").value, e.target.value);
  });

  // Samenvatting toggler
  function setupSummaryToggle() {
    const btn = document.getElementById("toggleSummary");
    const content = document.getElementById("summaryContent");
    if (!btn || !content) return;
    btn.addEventListener("click", () => {
      const open = content.style.display === "block";
      content.style.display = open ? "none" : "block";
      btn.textContent = (open ? "▸" : "▾") + " Toon uitgaven per groep";
      if (!open) renderSamenvatting();
    });
  }

  // Leden per groep opslaan via samenvattingstabel
  document.getElementById("ledenSamenvattingForm").addEventListener("submit", function(e) {
    e.preventDefault();
    if (!magBeheren()) return;
    const inputs = document.querySelectorAll("#groepSamenvattingTabel input");
    const nieuweLeden = {};
    inputs.forEach(inp => {
      nieuweLeden[inp.name] = parseInt(inp.value) || 0;
    });
    firebase.database().ref("ledenPerGroep").set(nieuweLeden)
      .then(() => {
        ledenPerGroep = nieuweLeden;
        alert("Leden per groep opgeslagen!");
        renderSamenvatting();
      })
      .catch(err => alert("Opslaan mislukt: " + err.message));
  });

  // Initieel: verberg beheer-paneel en financieel functies
  toonBeheerPaneel();
  toonFinancieelFeatures();
  toonFinancieelKolommen();
});

document.addEventListener("DOMContentLoaded", () => {
  // --- Config / constants ---
  const alleGroepen = ["Ribbels","Speelclubs","Rakkers","Kwiks","Tippers","Toppers","Aspi","LEIDING"];
  const groepKleuren = {
    Ribbels:"#cce5ff",Speelclubs:"#ffe5cc",Rakkers:"#e5ffcc",
    Kwiks:"#ffccf2",Tippers:"#d5ccff",Toppers:"#ccffd5",
    Aspi:"#ffd5cc",LEIDING:"#dddddd"
  };
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/<jouw-cloud-name>/upload";
  const CLOUDINARY_PRESET = "chiro_upload_fotos";

  // --- State ---
  let huidigeGebruiker = null;
  let gebruikersData = null;
  let ledenPerGroep = {};

  // --- Helpers ---
  const $ = id => document.getElementById(id);
  function safeOn(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  // --- Firebase helpers ---
  function haalGebruikersData(uid) {
    return firebase.database().ref("gebruikers/" + uid).once("value").then(snap => snap.val());
  }
  function haalLedenPerGroep() {
    return firebase.database().ref("ledenPerGroep").once("value").then(snap => snap.val() || {});
  }

  // --- Permissions ---
  function magZien(groep) {
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magIndienen(groep) {
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magBeheren() {
    return gebruikersData && gebruikersData.rol === "financieel";
  }

  // --- UI helpers ---
  function toonBeheerPaneel() {
    const paneel = $("beheerPaneel");
    if (paneel) paneel.style.display = magBeheren() ? "block" : "none";
  }
  function vulGroepSelectie() {
    const select = $("groep");
    if (!select || !gebruikersData) return;
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    const toegestane = gebruikersData.rol === "financieel" ? alleGroepen : [gebruikersData.groep];
    toegestane.forEach(g => { select.innerHTML += `<option value="${g}">${g}</option>`; });
  }
  function toonFinancieelFeatures() {
    const summaryBtn = $("toggleSummary");
    const exportBtn = $("exportPdfBtn");
    const show = magBeheren();
    if (summaryBtn) summaryBtn.style.display = show ? "block" : "none";
    if (exportBtn) exportBtn.style.display = show ? "block" : "none";
  }
  function toonFinancieelKolommen() {
    const betaaldTh = document.querySelector("#overzicht th:nth-child(6)");
    const actieTh = document.querySelector("#overzicht th:nth-child(7)");
    const betaaldTds = document.querySelectorAll("#overzicht td:nth-child(6)");
    const actieTds = document.querySelectorAll("#overzicht td:nth-child(7)");
    const show = magBeheren();
    if (betaaldTh) betaaldTh.style.display = show ? "table-cell" : "none";
    if (actieTh) actieTh.style.display = show ? "table-cell" : "none";
    betaaldTds.forEach(td => td.style.display = show ? "table-cell" : "none");
    actieTds.forEach(td => td.style.display = show ? "table-cell" : "none");
  }

  // --- Render summary (leden + euro per kind) ---
  function renderSamenvatting() {
    const tbody = document.querySelector("#groepSamenvattingTabel tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const totals = {};
    alleGroepen.forEach(g => totals[g] = 0);

    firebase.database().ref("uitgaven").once("value")
      .then(snap => {
        const data = snap.val() || {};
        Object.values(data).forEach(u => {
          if (u && u.groep && magZien(u.groep)) totals[u.groep] += parseFloat(u.bedrag) || 0;
        });

        alleGroepen.forEach(g => {
          const bedrag = totals[g].toFixed(2);
          const leden = Number(ledenPerGroep[g] || 0);
          const euroPerKind = leden > 0 ? (totals[g] / leden).toFixed(2) : "0.00";
          const rij = document.createElement("tr");
          rij.style.backgroundColor = groepKleuren[g] || "#fff";
          rij.innerHTML = `
            <td><b>${g}</b></td>
            <td>${magBeheren() ? `<input type="number" min="0" name="${g}" value="${leden}" style="width:60px;">` : leden}</td>
            <td>€${bedrag}</td>
            <td><span style="color:#27ae60">€${euroPerKind}</span></td>
          `;
          tbody.appendChild(rij);
        });

        const opslaanBtn = $("ledenOpslaanBtn");
        if (opslaanBtn) opslaanBtn.style.display = magBeheren() ? "inline-block" : "none";
      })
      .catch(err => {
        console.error("Lezen uitgaven mislukt:", err);
      });
  }

  // --- Render uitgaven tabel ---
  function renderTabel(filterGroep = "", filterBetaald = "") {
    const tbody = document.querySelector("#overzicht tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    let query = firebase.database().ref("uitgaven");
    if (gebruikersData && gebruikersData.rol === "leiding") {
      query = query.orderByChild("groep").equalTo(gebruikersData.groep);
    }

    query.once("value").then(snap => {
      const data = snap.val() || {};
      Object.values(data)
        .filter(u => (!filterGroep || u.groep === filterGroep) && (filterBetaald === "" || String(u.betaald) === filterBetaald))
        .sort((a, b) => (a.nummer || 0) - (b.nummer || 0))
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
            btn.onclick = () => {
              if (!magBeheren()) return;
              firebase.database().ref("uitgaven/" + u.nummer).remove()
                .then(() => renderTabel($("filterGroep")?.value, $("filterBetaald")?.value))
                .catch(err => alert("Verwijderen mislukt: " + err.message));
            };
            actieCell.appendChild(btn);

            const betaaldCell = rij.insertCell(7);
            const cb = document.createElement("input");
            cb.type = "checkbox"; cb.checked = !!u.betaald;
            cb.onchange = () => {
              if (!magBeheren()) { cb.checked = !cb.checked; return; }
              firebase.database().ref("uitgaven/" + u.nummer).update({ betaald: cb.checked })
                .then(() => renderTabel($("filterGroep")?.value, $("filterBetaald")?.value))
                .catch(err => alert("Updaten mislukt: " + err.message));
            };
            betaaldCell.appendChild(cb);
          }
        });
    }).catch(err => console.error("Lezen uitgaven mislukt:", err));
  }

  // --- PDF export (unchanged) ---
  function setupPdfExport() {
    const btn = $("exportPdfBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const now = new Date();
      const timestamp = now.toLocaleString("nl-NL", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      doc.setFontSize(10);
      doc.text(timestamp, doc.internal.pageSize.getWidth() - 20, 10, { align: "right" });
      let y = 20;
      doc.setFontSize(16); doc.text("Uitgaven activiteitenkas per groep", 20, y); y += 10;
      const perGroep = {}; alleGroepen.forEach(g => perGroep[g] = []);
      const snap = await firebase.database().ref("uitgaven").once("value");
      const data = snap.val() || {};
      Object.values(data).forEach(u => { if (magZien(u.groep)) perGroep[u.groep].push(u); });
      alleGroepen.forEach(g => {
        const items = perGroep[g];
        if (!items.length) return;
        doc.setFontSize(14); doc.text(g, 20, y); y += 8; doc.setFontSize(11);
        items.forEach(u => {
          const regel = `#${u.nummer} – ${u.datum} – €${u.bedrag} – ${u.activiteit} ${u.betaald ? "(Betaald)" : "(Niet betaald)"}`;
          doc.text(regel, 25, y); y += 6;
          if (y > 280) { doc.addPage(); y = 20; }
        });
        y += 8;
      });
      doc.save("uitgaven_activiteitenkas_per_groep.pdf");
    });
  }

  // --- Cloudinary upload bewijsstuk ---
  async function uploadBewijs(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  // --- Auth state: alleen ledenPerGroep lezen voor financieel ---
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      huidigeGebruiker = user;
      try {
        gebruikersData = (await haalGebruikersData(user.uid)) || {};
      } catch (err) {
        console.error("Fout bij ophalen gebruikersData:", err);
        gebruikersData = {};
      }

      // Alleen ophalen wanneer financiële rol — voorkomt permission_denied voor anderen
      if (gebruikersData.rol === "financieel") {
        try {
          ledenPerGroep = await haalLedenPerGroep();
        } catch (err) {
          console.warn("Kon ledenPerGroep niet lezen (perm.): fallback naar lege waarden.", err);
          ledenPerGroep = {};
        }
      } else {
        ledenPerGroep = {};
      }

      if ($("loginScherm")) $("loginScherm").style.display = "none";
      if ($("appInhoud")) $("appInhoud").style.display = "block";
      if ($("loginFout")) $("loginFout").textContent = "";

      if ($("gebruikerInfo")) $("gebruikerInfo").textContent = `Ingelogd als ${gebruikersData.rol || 'onbekend'} (${gebruikersData.groep || 'ALL'})`;

      vulGroepSelectie();
      setupSummaryToggle();
      setupPdfExport();
      renderTabel();
      toonBeheerPaneel();
      toonFinancieelFeatures();
      toonFinancieelKolommen();
    } else {
      if ($("appInhoud")) $("appInhoud").style.display = "none";
      if ($("loginScherm")) $("loginScherm").style.display = "block";
      if ($("loginFout")) $("loginFout").textContent = "";
      huidigeGebruiker = null;
      gebruikersData = null;
      ledenPerGroep = {};
    }
  });

  // --- Safe event listeners ---
  safeOn($("loginKnop"), "click", async () => {
    const email = $("loginEmail")?.value || "";
    const wachtwoord = $("loginWachtwoord")?.value || "";
    const fout = $("loginFout");
    try {
      await firebase.auth().signInWithEmailAndPassword(email, wachtwoord);
      if (fout) fout.textContent = "";
    } catch (err) {
      if (fout) fout.textContent = "Login mislukt: Firebase: " + (err && err.message ? err.message : err);
      console.warn("Login fout:", err);
    }
  });

  safeOn($("logoutKnop"), "click", () => firebase.auth().signOut());

  safeOn($("rolForm"), "submit", e => {
    e.preventDefault();
    if (!magBeheren()) return alert("Geen rechten.");
    const uid = $("userUid")?.value.trim();
    const groep = $("userGroep")?.value;
    const rol = $("userRol")?.value;
    if (!uid || !groep || !rol) return alert("Vul alle velden in.");
    firebase.database().ref("gebruikers/" + uid).set({ groep, rol })
      .then(() => { alert("Gebruiker opgeslagen"); $("rolForm").reset(); })
      .catch(err => alert("Opslaan mislukt: " + err.message));
  });

  safeOn($("uitgaveForm"), "submit", async e => {
    e.preventDefault();
    const g = $("groep")?.value;
    const b = parseFloat($("bedrag")?.value) || 0;
    const a = $("activiteit")?.value;
    const d = $("datum")?.value;
    const p = $("betaald") ? $("betaald").checked : false;
    const rekeningNummer = $("rekeningNummer")?.value.trim();
    if (!rekeningNummer) return alert("Vul je rekeningnummer in.");
    const file = $("bewijsUpload")?.files?.[0];
    if (!file) return alert("Upload een bewijsstuk.");
    if (!g || isNaN(b) || !a || !d) return alert("Gelieve alle velden correct in te vullen.");
    if (!magIndienen(g)) return alert("Je mag geen uitgave indienen voor deze groep.");

    let bewijsUrl = "";
    try { bewijsUrl = await uploadBewijs(file); } catch { return alert("Upload bewijsstuk mislukt."); }

    const uitgavenRef = firebase.database().ref("uitgaven");
    uitgavenRef.once("value").then(snap => {
      const data = snap.val() || {};
      const nummers = Object.values(data).map(u => u.nummer || 0);
      let nieuwNummer;
      do { nieuwNummer = Math.floor(1000 + Math.random() * 9000); } while (nummers.includes(nieuwNummer));
      uitgavenRef.child(nieuwNummer).set({
        nummer: nieuwNummer, groep: g, bedrag: b.toFixed(2),
        activiteit: a, datum: d, betaald: p, bewijsUrl, status: "in_behandeling"
      })
      .then(() => { $("uitgaveForm")?.reset(); renderTabel($("filterGroep")?.value, $("filterBetaald")?.value); })
      .catch(err => alert("Opslaan mislukt: " + err.message));
    });
  });

  safeOn($("filterGroep"), "change", e => renderTabel(e.target.value, $("filterBetaald")?.value));
  safeOn($("filterBetaald"), "change", e => renderTabel($("filterGroep")?.value, e.target.value));

  // Toggle samenvatting
  function setupSummaryToggle() {
    const btn = $("toggleSummary");
    const content = $("summaryContent");
    if (!btn || !content) return;
    btn.addEventListener("click", () => {
      const open = content.style.display === "block";
      content.style.display = open ? "none" : "block";
      btn.textContent = (open ? "▸" : "▾") + " Toon uitgaven per groep";
      if (!open) renderSamenvatting();
    });
  }

  // Leden opslaan via samenvattingstabel
  safeOn($("ledenSamenvattingForm"), "submit", function(e) {
    e.preventDefault();
    if (!magBeheren()) return alert("Geen rechten om leden te bewerken.");
    const inputs = document.querySelectorAll("#groepSamenvattingTabel input");
    const nieuweLeden = {};
    inputs.forEach(inp => { nieuweLeden[inp.name] = parseInt(inp.value) || 0; });
    firebase.database().ref("ledenPerGroep").set(nieuweLeden)
      .then(() => { ledenPerGroep = nieuweLeden; alert("Leden per groep opgeslagen!"); renderSamenvatting(); })
      .catch(err => {
        console.error("Opslaan ledenPerGroep mislukt:", err);
        alert("Opslaan mislukt (geen permissie of fout). Controleer database regels.");
      });
  });

  // Init UI (hidden until auth)
  toonBeheerPaneel();
  toonFinancieelFeatures();
  toonFinancieelKolommen();
});

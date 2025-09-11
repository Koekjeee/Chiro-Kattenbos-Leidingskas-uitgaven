document.addEventListener("DOMContentLoaded", () => {
  // --- Config / constants ---
  const alleGroepen = ["Ribbels","Speelclubs","Rakkers","Kwiks","Tippers","Toppers","Aspi","LEIDING"];
  const groepKleuren = {
    Ribbels:"#cce5ff",Speelclubs:"#ffe5cc",Rakkers:"#e5ffcc",
    Kwiks:"#ffccf2",Tippers:"#d5ccff",Toppers:"#ccffd5",
    Aspi:"#ffd5cc",LEIDING:"#dddddd"
  };

  // Cloudinary config
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxizebpwn/upload";
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
    // Financieel mag alles zien, leiding alleen eigen groep
    return gebruikersData && (
      gebruikersData.rol === "financieel" ||
      gebruikersData.groep === groep
    );
  }

  function magIndienen(groep) {
    // Financieel mag alles indienen, leiding alleen eigen groep
    return gebruikersData && (
      gebruikersData.rol === "financieel" ||
      gebruikersData.groep === groep
    );
  }

  function magBeheren() {
    // Alleen financieel mag beheren
    return gebruikersData && gebruikersData.rol === "financieel";
  }

  // --- UI helpers ---
  function vulGroepSelectie() {
    const select = $("groep");
    if (!select || !gebruikersData) return;
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    let toegestane;
    if (gebruikersData.rol === "financieel") {
      toegestane = alleGroepen;
    } else {
      toegestane = [gebruikersData.groep];
    }
    toegestane.forEach(g => { select.innerHTML += `<option value="${g}">${g}</option>`; });
  }

  // --- Upload bewijsstuk (Cloudinary) ---
  async function uploadBewijs(file) {
    if (!file) throw new Error("Geen bestand opgegeven voor upload.");
    if (!CLOUDINARY_URL || CLOUDINARY_URL.includes("<") || CLOUDINARY_URL.toLowerCase().includes("your")) {
      throw new Error("Cloudinary niet ingesteld: zet je CLOUDINARY_URL en CLOUDINARY_PRESET in script.js");
    }
    if (!CLOUDINARY_PRESET || CLOUDINARY_PRESET.includes("<")) {
      throw new Error("Cloudinary preset niet ingesteld: controleer CLOUDINARY_PRESET in script.js");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Upload geweigerd (HTTP ${res.status}). Controleer CLOUDINARY_URL en preset. Server says: ${text}`);
      }
      throw new Error(`Upload naar Cloudinary mislukt (HTTP ${res.status}). Response: ${text}`);
    }

    const data = await res.json().catch(() => null);
    if (!data || !data.secure_url) {
      throw new Error("Cloudinary-respons bevat geen secure_url. Controleer preset en account.");
    }
    return data.secure_url;
  }

  // --- Uitgaven toevoegen (submit handler) ---
  safeOn($("uitgaveForm"), "submit", async e => {
    e.preventDefault();

    const g = $("groep")?.value;
    const bRaw = $("bedrag")?.value;
    const b = parseFloat(bRaw);
    const a = $("activiteit")?.value;
    const d = $("datum")?.value;
    const rekeningNummer = $("rekeningNummer")?.value.trim();
    const file = $("bewijsUpload")?.files?.[0];

    if (!g || isNaN(b) || !a || !d) return alert("Gelieve alle velden correct in te vullen.");
    if (!magIndienen(g)) return alert("Je mag geen uitgave indienen voor deze groep.");
    if (!rekeningNummer) return alert("Vul je rekeningnummer in.");
    if (!file) return alert("Upload een bewijsstuk.");

    let bewijsUrl = "";
    try {
      bewijsUrl = await uploadBewijs(file);
    } catch (err) {
      alert("Upload bewijsstuk mislukt:\n" + (err && err.message ? err.message : err));
      return;
    }

    const uitgavenRef = firebase.database().ref("uitgaven");
    try {
      const snap = await uitgavenRef.once("value");
      const data = snap.val() || {};
      const nummers = Object.values(data).map(u => u.nummer || 0);
      let nieuwNummer;
      do { nieuwNummer = Math.floor(1000 + Math.random() * 9000); } while (nummers.includes(nieuwNummer));

      const entry = {
        nummer: nieuwNummer,
        groep: g,
        bedrag: b.toFixed(2),
        activiteit: a,
        datum: d,
        betaald: false,
        bewijsUrl: bewijsUrl || "",
        status: "in_behandeling",
        rekeningNummer: rekeningNummer
      };

      Object.keys(entry).forEach(k => { if (entry[k] === undefined) entry[k] = null; });

      await uitgavenRef.child(nieuwNummer).set(entry);
      $("uitgaveForm")?.reset();
      renderTabel($("filterGroep")?.value, $("filterBetaald")?.value);
    } catch (err) {
      alert("Opslaan mislukt: " + (err && err.message ? err.message : err));
    }
  });

  // --- Rendering functies ---
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

          // Betaald status
          const betaaldStatusCell = rij.insertCell(5);
          betaaldStatusCell.className = "betaald-status";
          betaaldStatusCell.textContent = u.betaald ? "✓" : "✗";
          betaaldStatusCell.style.color = u.betaald ? "#27ae60" : "#e74c3c";

          // Actie: Verwijder-knop
          const actieCell = rij.insertCell(6);
          if (magBeheren()) {
            const verwijderBtn = document.createElement("button");
            verwijderBtn.textContent = "🗑️";
            verwijderBtn.title = "Verwijder uitgave";
            verwijderBtn.style.cursor = "pointer";
            verwijderBtn.onclick = async () => {
              if (confirm("Weet je zeker dat je deze uitgave wilt verwijderen?")) {
                await firebase.database().ref("uitgaven/" + u.nummer).remove();
                renderTabel(filterGroep, filterBetaald);
              }
            };
            actieCell.appendChild(verwijderBtn);
          }

          // Betaald aanvinken (checkbox)
          const betaaldCell = rij.insertCell(7);
          if (magBeheren()) {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = !!u.betaald;
            checkbox.title = "Markeer als betaald";
            checkbox.onchange = async () => {
              await firebase.database().ref("uitgaven/" + u.nummer).update({ betaald: checkbox.checked });
              renderTabel(filterGroep, filterBetaald);
            };
            betaaldCell.appendChild(checkbox);
          }

          // Rekeningnummer
          rij.insertCell(8).textContent = u.rekeningNummer || "-";

          // Bewijsstuk afbeelding/document
          const bewijsCell = rij.insertCell(9);
          if (u.bewijsUrl) {
            const link = document.createElement("a");
            link.href = u.bewijsUrl;
            link.target = "_blank";
            link.rel = "noopener";
            link.title = "Bekijk bewijsstuk";
            if (u.bewijsUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
              const img = document.createElement("img");
              img.src = u.bewijsUrl;
              img.alt = "Bewijs";
              img.style.maxWidth = "40px";
              img.style.maxHeight = "40px";
              link.appendChild(img);
            } else {
              link.textContent = "📄";
            }
            bewijsCell.appendChild(link);
          }
        });
    }).catch(err => console.error("Lezen uitgaven mislukt:", err));
  }

  function renderSamenvatting() {
    const tbody = document.querySelector("#groepSamenvattingTabel tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const groepen = Object.keys(ledenPerGroep || {});
    groepen.forEach(groep => {
      let totaal = 0;
      firebase.database().ref("uitgaven").orderByChild("groep").equalTo(groep).once("value").then(snap => {
        const uitgaven = snap.val() || {};
        Object.values(uitgaven).forEach(u => {
          totaal += parseFloat(u.bedrag || 0);
        });
        const leden = ledenPerGroep[groep] || 0;
        const perKind = leden > 0 ? (totaal / leden).toFixed(2) : "-";
        const rij = tbody.insertRow();
        rij.style.backgroundColor = groepKleuren[groep] || "#ffd5f2";
        rij.insertCell(0).textContent = groep;
        rij.insertCell(1).textContent = leden;
        rij.insertCell(2).textContent = `€${totaal.toFixed(2)}`;
        rij.insertCell(3).textContent = perKind;
      });
    });
  }

  // --- Auth state & init ---
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      huidigeGebruiker = user;
      try { gebruikersData = (await haalGebruikersData(user.uid)) || {}; }
      catch (err) { gebruikersData = {}; }

      if (gebruikersData.rol === "financieel") {
        try { ledenPerGroep = await haalLedenPerGroep(); }
        catch (err) { ledenPerGroep = {}; }
      } else {
        ledenPerGroep = {};
      }

      $("loginScherm") && ($("loginScherm").style.display = "none");
      $("appInhoud") && ($("appInhoud").style.display = "block");
      $("gebruikerInfo") && ($("gebruikerInfo").textContent = `Ingelogd als ${gebruikersData.rol || 'onbekend'} (${gebruikersData.groep || 'ALL'})`);

      vulGroepSelectie();
      toonFinancieelFeatures();
      toonFinancieelKolommen();
      setupSummaryToggle();
      if (typeof renderSamenvatting === "function" && magBeheren()) {
        renderSamenvatting();
      }
      renderTabel();
      toonLogoutKnop();
    } else {
      $("appInhoud") && ($("appInhoud").style.display = "none");
      $("loginScherm") && ($("loginScherm").style.display = "block");
      $("loginFout") && ($("loginFout").textContent = "");
      huidigeGebruiker = null;
      gebruikersData = null;
      ledenPerGroep = {};
    }
  });

  // --- Safe event listeners (rest of UI) ---
  safeOn($("loginKnop"), "click", async () => {
    const email = $("loginEmail")?.value || "";
    const wachtwoord = $("loginWachtwoord")?.value || "";
    const fout = $("loginFout");
    try {
      await firebase.auth().signInWithEmailAndPassword(email, wachtwoord);
      if (fout) fout.textContent = "";
    } catch (err) {
      if (fout) fout.textContent = "Login mislukt" + (err && err.message ? err.message : err);
    }
  });
  safeOn($("logoutKnop"), "click", () => firebase.auth().signOut());

  // Filters
  safeOn($("filterGroep"), "change", e => renderTabel(e.target.value, $("filterBetaald")?.value));
  safeOn($("filterBetaald"), "change", e => renderTabel($("filterGroep")?.value, e.target.value));

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

  function setupSummaryToggle() {
    const btn = document.getElementById("toggleSummary");
    const summary = document.getElementById("summaryContent");
    if (!btn || !summary) return;
    btn.onclick = () => {
      summary.style.display = summary.style.display === "none" ? "block" : "none";
      btn.textContent = summary.style.display === "none"
        ? "Toon"
        : "Verberg";
    };
  }

  function toonLogoutKnop() {
    const logoutBtn = $("logoutKnop");
    if (logoutBtn) logoutBtn.style.display = "block";

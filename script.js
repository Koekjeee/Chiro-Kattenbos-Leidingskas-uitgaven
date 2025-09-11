document.addEventListener("DOMContentLoaded", () => {
  // --- Config / constants ---
  const alleGroepen = ["Ribbels","Speelclubs","Rakkers","Kwiks","Tippers","Toppers","Aspi","LEIDING"];
  const groepKleuren = {
    Ribbels:"#cce5ff",Speelclubs:"#ffe5cc",Rakkers:"#e5ffcc",
    Kwiks:"#ffccf2",Tippers:"#d5ccff",Toppers:"#ccffd5",
    Aspi:"#ffd5cc",LEIDING:"#dddddd"
  };

  // >>> VERVANG HIER je cloud name en preset door jouw waarden <<<
  // Bijvoorbeeld: https://api.cloudinary.com/v1_1/voorbeeldcloud/upload
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

  // --- UI helpers (kort gehouden) ---
  function vulGroepSelectie() {
    const select = $("groep");
    if (!select || !gebruikersData) return;
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    const toegestane = gebruikersData.rol === "financieel" ? alleGroepen : [gebruikersData.groep];
    toegestane.forEach(g => { select.innerHTML += `<option value="${g}">${g}</option>`; });
  }

  // --- Upload bewijsstuk (Cloudinary) ---
  async function uploadBewijs(file) {
    // Basischecks en duidelijke foutmeldingen
    if (!file) throw new Error("Geen bestand opgegeven voor upload.");
    if (!CLOUDINARY_URL || CLOUDINARY_URL.includes("<") || CLOUDINARY_URL.toLowerCase().includes("your")) {
      throw new Error("Cloudinary niet ingesteld: zet je CLOUDINARY_URL (vervang <jouw-cloud-name>) en CLOUDINARY_PRESET in script.js");
    }
    if (!CLOUDINARY_PRESET || CLOUDINARY_PRESET.includes("<")) {
      throw new Error("Cloudinary preset niet ingesteld: controleer CLOUDINARY_PRESET in script.js");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    // Check op HTTP success; bij 401/403/4xx geef duidelijke instructie
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // als 401 Unauthorized, geef gerichte tip
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Upload geweigerd (HTTP ${res.status}). Controleer CLOUDINARY_URL (cloud name) en preset. Server says: ${text}`);
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

    // Lees en valideer velden
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

    // Upload eerst het bewijs en stop bij fout (zodat we geen undefined naar DB schrijven)
    let bewijsUrl = "";
    try {
      bewijsUrl = await uploadBewijs(file);
    } catch (err) {
      console.error("Upload bewijsstuk mislukt:", err);
      // toon duidelijke melding voor gebruiker
      alert("Upload bewijsstuk mislukt:\n" + (err && err.message ? err.message : err));
      return; // stop submit — geen DB write met undefined
    }

    // Schrijf uitgave naar Firebase: gebruik veilige waarden (nooit undefined)
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
        status: "in_behandeling"
      };

      // Voorkom undefined velden - Firebase weigert undefined in object
      Object.keys(entry).forEach(k => { if (entry[k] === undefined) entry[k] = null; });

      await uitgavenRef.child(nieuwNummer).set(entry);
      // reset formulier en herlaad tabel
      $("uitgaveForm")?.reset();
      renderTabel($("filterGroep")?.value, $("filterBetaald")?.value);
    } catch (err) {
      console.error("Opslaan uitgave mislukt:", err);
      alert("Opslaan mislukt: " + (err && err.message ? err.message : err));
    }
  });

  // --- Rendering functies (kort) ---
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
        });
    }).catch(err => console.error("Lezen uitgaven mislukt:", err));
  }

  // --- Auth state & init (kort) ---
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      huidigeGebruiker = user;
      try { gebruikersData = (await haalGebruikersData(user.uid)) || {}; } catch (err) { gebruikersData = {}; console.warn("haalGebruikersData faalde:", err); }
      // alleen ledenPerGroep ophalen voor financieel (vermijdt permission_denied)
      if (gebruikersData.rol === "financieel") {
        try { ledenPerGroep = await haalLedenPerGroep(); } catch (err) { ledenPerGroep = {}; console.warn("geen toegang tot ledenPerGroep:", err); }
      } else ledenPerGroep = {};

      $("loginScherm") && ($("loginScherm").style.display = "none");
      $("appInhoud") && ($("appInhoud").style.display = "block");
      $("gebruikerInfo") && ($("gebruikerInfo").textContent = `Ingelogd als ${gebruikersData.rol || 'onbekend'} (${gebruikersData.groep || 'ALL'})`);
      vulGroepSelectie();
      renderTabel();
    } else {
      $("appInhoud") && ($("appInhoud").style.display = "none");
      $("loginScherm") && ($("loginScherm").style.display = "block");
      huidigeGebruiker = null; gebruikersData = null; ledenPerGroep = {};
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
      if (fout) fout.textContent = "Login mislukt: Firebase: " + (err && err.message ? err.message : err);
    }
  });
  safeOn($("logoutKnop"), "click", () => firebase.auth().signOut());

  // Filters
  safeOn($("filterGroep"), "change", e => renderTabel(e.target.value, $("filterBetaald")?.value));
  safeOn($("filterBetaald"), "change", e => renderTabel($("filterGroep")?.value, e.target.value));
});

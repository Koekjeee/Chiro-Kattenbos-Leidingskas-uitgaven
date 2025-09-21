document.addEventListener("DOMContentLoaded", () => {
  // --- Config / constants ---
  const alleGroepen = ["Ribbels","Speelclubs","Rakkers","Kwiks","Tippers","Toppers","Aspi","LEIDING"];
  const groepKleuren = {
    Ribbels:"#cce5ff",Speelclubs:"#ffe5cc",Rakkers:"#e5ffcc",
    Kwiks:"#ffccf2",Tippers:"#d5ccff",Toppers:"#ccffd5",
    Aspi:"#ffd5cc",LEIDING:"#dddddd"
  };

  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxizebpwn/upload";
  const CLOUDINARY_PRESET = "chiro_upload_fotos";

  let huidigeGebruiker = null;
  let gebruikersData = null;
  let ledenPerGroep = {};

  const $ = id => document.getElementById(id);
  function safeOn(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  function haalGebruikersData(uid) {
    return firebase.database().ref("gebruikers/" + uid).once("value").then(snap => snap.val());
  }
  function haalLedenPerGroep() {
    return firebase.database().ref("ledenPerGroep").once("value").then(snap => snap.val() || {});
  }

  function magZien(groep) {
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magIndienen(groep) {
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magBeheren() {
    return gebruikersData && gebruikersData.rol === "financieel";
  }

  function vulGroepSelectie() {
    const select = $("groep");
    if (!select || !gebruikersData) return;
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    const toegestane = gebruikersData.rol === "financieel" ? alleGroepen : [gebruikersData.groep];
    toegestane.forEach(g => { select.innerHTML += `<option value="${g}">${g}</option>`; });
  }

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

  safeOn($("uitgaveForm"), "submit", async e => {
    e.preventDefault();

    const g = $("groep")?.value;
    const bRaw = $("bedrag")?.value;
    const b = parseFloat(bRaw);
    const a = $("activiteit")?.value;
    const d = $("datum")?.value;
    const rekeningNummer = $("rekeningNummer")?.value.trim();
    const file = $("bewijsUpload")?.files?.[0];
    const naam = $("naam")?.value?.trim();

    if (!g || isNaN(b) || !a || !d) return alert("Gelieve alle velden correct in te vullen.");
    if (!magIndienen(g)) return alert("Je mag geen uitgave indienen voor deze groep.");
    if (!rekeningNummer) return alert("Vul je rekeningnummer in.");
    if (!file) return alert("Upload een bewijsstuk.");
    if (!naam) return alert("Vul je naam in.");

    let bewijsUrl = "";
    try {
      bewijsUrl = await uploadBewijs(file);
    } catch (err) {
      console.error("Upload bewijsstuk mislukt:", err);
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
        rekeningNummer: rekeningNummer,
        naam: naam
      };

      Object.keys(entry).forEach(k => { if (entry[k] === undefined) entry[k] = null; });

      await uitgavenRef.child(nieuwNummer).set(entry);
      $("uitgaveForm")?.reset();
      renderTabel($("filterGroep")?.value, $("filterBetaald")?.value);
    } catch (err) {
      console.error("Opslaan uitgave mislukt:", err);
      alert("Opslaan mislukt: " + (err && err.message ? err.message : err));
    }
  });

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
          rij.insertCell(5).textContent = u.naam || "-";

          const betaaldStatusCell = rij.insertCell(6);
          betaaldStatusCell.className = "betaald-status";
          betaaldStatusCell.textContent = u.betaald ? "✓" : "✗";
          betaaldStatusCell.style.color = u.betaald ? "#27ae60" : "#e74c3c";

          const actieCell = rij.insertCell(7);
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

          const betaaldCell = rij.insertCell(8);
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

          rij.insertCell(9).textContent = u.rekeningNummer || "-";

          const bewijsCell = rij.insertCell(10);
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

  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      huidigeGebruiker = user;
      try { gebruikersData = (await haalGebruikersData(user.uid)) || {}; }
      catch (err) { gebruikersData = {}; console.warn("haalGebruikersData faalde:", err); }

      if (gebruikersData.rol === "financieel") {
        try { ledenPerGroep = await haalLedenPerGroep(); }
        catch (err) { ledenPerGroep = {}; console.warn("geen toegang tot ledenPerGroep:", err); }
      } else {
        ledenPerGroep = {};
      }

      $("loginScherm") && ($("loginScherm").style.display = "none");
      $("appInhoud") && ($("appInhoud").style.display = "block");
      $("gebruikerInfo") && ($("gebruikerInfo").textContent = `Ingelogd als ${gebruikersData.rol || 'onbekend'} (${gebruikersData.groep || 'ALL'})`);

      vulGroepSelectie();
      renderTabel();
      toonLogoutKnop();
      toonFinancieelFeatures();
      toonBeheerPaneel();
    } else {
      $("appInhoud") && ($("appInhoud").style.display = "none");
      $("loginScherm") && ($("loginScherm").style.display = "block");
      $("loginFout") && ($("loginFout").textContent = "");
      huidigeGebruiker = null;
      gebruikersData = null;
      ledenPerGroep = {};
    }
  });

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

  safeOn($("filterGroep"), "change", e => renderTabel(e.target.value, $("filterBetaald")?.value));
  safeOn($("filterBetaald"), "change", e => renderTabel($("filterGroep")?.value, e.target.value));

  function toonLogoutKnop() {
    const logoutBtn = $("logoutKnop");
    if (logoutBtn) logoutBtn.style.display = "block";
  }

  function toonFinancieelFeatures() {
    const exportBtn = $("exportPdfBtn");
    const summaryBtn = $("toggleSummary");
    if (exportBtn) exportBtn.style.display = magBeheren() ? "block" : "none";
    if (summaryBtn) summaryBtn.style.display = magBeheren() ? "block" : "none";
  }

  function toonBeheerPaneel() {
    const paneel = $("beheerPaneel");
    const toggleBtn = $("toggleBeheerPaneel");
    if (!paneel || !toggleBtn) return;
    const show = magBeheren();
    toggleBtn.style.display = show ? "block" : "none";
    paneel.style.display = "none";
  }
});

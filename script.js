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
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magIndienen(groep) {
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magBeheren() {
    return gebruikersData && gebruikersData.rol === "financieel";
  }

  // --- UI helpers ---
  function vulGroepSelectie() {
    const select = $("groep");
    if (!select || !gebruikersData) return;
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    const toegestane = gebruikersData.rol === "financieel" ? alleGroepen : [gebruikersData.groep];
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

    // Lees en valideer velden
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
    if (gebruikersData.rol === "leiding" && !naam) return alert("Vul je naam in.");

    // Upload eerst het bewijs en stop bij fout
    let bewijsUrl = "";
    try {
      bewijsUrl = await uploadBewijs(file);
    } catch (err) {
      console.error("Upload bewijsstuk mislukt:", err);
      alert("Upload bewijsstuk mislukt:\n" + (err && err.message ? err.message : err));
      return;
    }

    // Schrijf uitgave naar Firebase
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
        naam: gebruikersData.rol === "leiding" ? naam : (gebruikersData.naam || "")
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
          rij.insertCell(5).textContent = u.naam || "-";

          // Betaald status
          const betaaldStatusCell = rij.insertCell(6);
          betaaldStatusCell.className = "betaald-status";
          betaaldStatusCell.textContent = u.betaald ? "✓" : "✗";
          betaaldStatusCell.style.color = u.betaald ? "#27ae60" : "#e74c3c";

          // Actie: Verwijder-knop
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

          // Betaald aanvinken (checkbox)
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

          // Rekeningnummer
          rij.insertCell(9).textContent = u.rekeningNummer || "-";

          // Bewijsstuk afbeelding/document
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

  // --- Auth state & init ---
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
      toonBeheerPaneel();
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
    }
  });
  safeOn($("logoutKnop"), "click", () => firebase.auth().signOut());

  safeOn($("filterGroep"), "change", e => renderTabel(e.target.value, $("filterBetaald")?.value));
  safeOn($("filterBetaald"), "change", e => renderTabel($("filterGroep")?.value, e.target.value));

  function toonBeheerPaneel() {
    const paneel = $("beheerPaneel");
    const toggleBtn = $("toggleBeheerPaneel");
    if (!paneel || !toggleBtn) return;
    const show = magBeheren();
    toggleBtn.style.display = show ? "block" : "none";
    paneel.style.display = "none";
    renderGebruikersLijst();
  }

  function toonFinancieelFeatures() {
    const summaryBtn = $("toggleSummary");
    const exportBtn = $("exportPdfBtn");
    const show = magBeheren();
    if (summaryBtn) summaryBtn.style.display = show ? "block" : "none";
    if (exportBtn) exportBtn.style.display = show ? "block" : "none";
  }

  function toonFinancieelKolommen() {
    const betaaldTh = document.querySelector("#overzicht th:nth-child(7)");
    const actieTh = document.querySelector("#overzicht th:nth-child(8)");
    const betaaldTds = document.querySelectorAll("#overzicht td:nth-child(7)");
    const actieTds = document.querySelectorAll("#overzicht td:nth-child(8)");
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
        ? "Toon overzicht uitgaven per groep"
        : "Verberg overzicht uitgaven per groep";
    };
  }

  safeOn($("exportPdfBtn"), "click", async () => {
    const doc = new window.jspdf.jsPDF();
    doc.setFontSize(14);
    doc.text("Uitgavenoverzicht per groep", 10, 10);

    const uitgavenSnap = await firebase.database().ref("uitgaven").once("value");
    const uitgaven = Object.values(uitgavenSnap.val() || {});

    const groepen = {};
    uitgaven.forEach(u => {
      if (!groepen[u.groep]) groepen[u.groep] = [];
      groepen[u.groep].push(u);
    });

    let y = 20;
    Object.keys(groepen).forEach(groep => {
      doc.setFont(undefined, "bold");
      doc.text(groep, 10, y);
      y += 8;
      doc.setFont(undefined, "normal");
      groepen[groep].sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
      groepen[groep].forEach(u => {
        doc.text(
          `${u.nummer || "-"} | `,
          10, y
        );
        doc.setFont(undefined, "bold");
        doc.text(`€${u.bedrag || "-"}`, 35, y);
        doc.setFont(undefined, "normal");
        doc.text(
          `| ${u.datum || "-"} | ${u.activiteit || "-"} | ${u.naam || "-"} | ${u.betaald ? "Betaald" : "Niet betaald"}`,
          70, y
        );
        y += 8;
        if (y > 280) { doc.addPage(); y = 10; }
      });
      y += 4;
    });

    doc.save("uitgaven_per_groep.pdf");
  });

  safeOn($("rolForm"), "submit", async e => {
    e.preventDefault();
    const uid = $("userUid")?.value.trim();
    const groep = $("userGroep")?.value;
    const rol = $("userRol")?.value;
    if (!uid || !groep || !rol) return alert("Vul alle velden in.");

    try {
      await firebase.database().ref("gebruikers/" + uid).update({ groep, rol });
      alert("Gebruiker succesvol aangepast!");
      $("rolForm").reset();
    } catch (err) {
      alert("Opslaan mislukt: " + (err && err.message ? err.message : err));
    }
  });

  safeOn($("toggleBeheerPaneel"), "click", () => {
    const paneel = $("beheerPaneel");
    if (!paneel) return;
    if (paneel.style.display === "none" || paneel.style.display === "") {
      paneel.style.display = "block";
    } else {
      paneel.style.display = "none";
    }
  });

  function toonLogoutKnop() {
    const logoutBtn = $("logoutKnop");
    if (logoutBtn) logoutBtn.style.display = "block";
  }

  async function renderGebruikersLijst() {
    const paneel = document.getElementById("gebruikersLijstPaneel");
    const tbody = document.getElementById("gebruikersLijstBody");
    if (!paneel || !tbody) return;
    if (!magBeheren()) {
      paneel.style.display = "none";
      return;
    }
    paneel.style.display = "block";
    tbody.innerHTML = "";

    const snap = await firebase.database().ref("gebruikers").once("value");
    const gebruikers = snap.val() || {};

    const allUsers = [];
    for (const uid in gebruikers) {
      allUsers.push({ uid, ...gebruikers[uid] });
    }

    const currentUid = firebase.auth().currentUser?.uid;

    allUsers.forEach(user => {
      const tr = document.createElement("tr");
      const statusTd = document.createElement("td");
      const bol = document.createElement("span");
      bol.style.display = "inline-block";
      bol.style.width = "14px";
      bol.style.height = "14px";
      bol.style.borderRadius = "50%";
      bol.style.background = user.uid === currentUid ? "#27ae60" : "#e74c3c";
      bol.title = user.uid === currentUid ? "Online" : "Offline";
      statusTd.appendChild(bol);
      tr.appendChild(statusTd);

      const emailTd = document.createElement("td");
      emailTd.textContent = user.email || "-";
      tr.appendChild(emailTd);

      const uidTd = document.createElement("td");
      uidTd.textContent = user.uid;
      tr.appendChild(uidTd);

      const rolTd = document.createElement("td");
      rolTd.textContent = user.rol || "-";
      tr.appendChild(rolTd);

      const groepTd = document.createElement("td");
      groepTd.textContent = user.groep || "-";
      tr.appendChild(groepTd);

      tbody.appendChild(tr);
    });
  }
});


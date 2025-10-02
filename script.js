document.addEventListener("DOMContentLoaded", () => {
  // --- Config ---
  const alleGroepen = ["Ribbels","Speelclubs","Rakkers","Kwiks","Tippers","Toppers","Aspi","LEIDING"];
  const groepKleuren = {
    Ribbels: "rgba(59,130,246,0.18)",
    Speelclubs: "rgba(234,179,8,0.18)",
    Rakkers: "rgba(34,197,94,0.18)",
    Kwiks: "rgba(244,114,182,0.18)",
    Tippers: "rgba(99,102,241,0.18)",
    Toppers: "rgba(16,185,129,0.18)",
    Aspi: "rgba(249,115,22,0.18)",
    LEIDING: "rgba(148,163,184,0.18)"
  };

  // --- Globals ---
  let huidigeGebruiker = null;
  let gebruikersData = null; // { rol, groep, email, theme? }
  let ledenPerGroep = {};
  let clientIP = null;

  // --- Utility DOM helpers ---
  const $ = (id) => document.getElementById(id);
  const safeOn = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };

  // --- Small helpers ---
  function nameFromEmail(email){
    if (!email) return "-";
    const [left] = email.split("@");
    return left ? left.replace(/[._-]+/g, " ").replace(/\b\w/g, c=>c.toUpperCase()) : email;
  }
  function kleurVoorGroep(g){
    const key = (g || "").toString().trim().toLowerCase();
    const map = {
      ribbels: groepKleuren.Ribbels,
      speelclubs: groepKleuren.Speelclubs,
      rakkers: groepKleuren.Rakkers,
      kwiks: groepKleuren.Kwiks,
      tippers: groepKleuren.Tippers,
      toppers: groepKleuren.Toppers,
      aspi: groepKleuren.Aspi,
      leiding: groepKleuren.LEIDING
    };
    return map[key] || "transparent";
  }

  // --- Number helpers (comma/point) ---
  function parseEuro(input){
    if (typeof input === 'number') return input;
    const s = String(input || '').trim().replace(/\s/g,'');
    if (!s) return NaN;
    // replace comma with dot, strip thousands separators
    const norm = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const v = Number(norm);
    return isNaN(v) ? NaN : v;
  }

  // --- Theme helpers ---
  function applyTheme(theme){
    document.body.dataset.theme = theme;
  }
  async function saveThemePreference(theme){
    try {
      localStorage.setItem("theme", theme);
      if (huidigeGebruiker) {
        await firebase.firestore().collection("gebruikers").doc(huidigeGebruiker.uid).set({ theme }, { merge: true });
      }
    } catch {}
  }
  // Apply theme ASAP from localStorage (before auth)
  applyTheme(localStorage.getItem("theme") || "dark");

  // --- IP + Audit log helpers ---
  async function resolveClientIP(){
    try {
      const cached = localStorage.getItem("clientIP");
      if (cached) { clientIP = cached; return cached; }
      const r = await fetch("https://api.ipify.org?format=json");
      const j = await r.json();
      clientIP = j && j.ip ? j.ip : null;
      if (clientIP) localStorage.setItem("clientIP", clientIP);
      return clientIP;
    } catch { return null; }
  }

  const ALLOW_CLIENT_DISCORD = false; // laat op false, gebruik backend proxy indien gewenst
  const DISCORD_WEBHOOK_URL = ""; // NIET client-side gebruiken zonder proxy

  async function logActie(action, details){
    try {
      const user = firebase.auth().currentUser;
      const email = user?.email || gebruikersData?.email || "-";
      const rol = gebruikersData?.rol || "-";
      const naam = nameFromEmail(email);
      const isAdmin = (rol === "financieel");
      const emoji = isAdmin ? "🛡️" : "👤";
      const ip = clientIP || await resolveClientIP();
      const entry = {
        action,
        details: details || {},
        uid: user?.uid || null,
        email,
        naam,
        rol,
        isAdmin,
        emoji,
        ip: ip || null,
        ua: navigator.userAgent,
        at: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await firebase.firestore().collection("auditLogs").add(entry);
      if (ALLOW_CLIENT_DISCORD && DISCORD_WEBHOOK_URL){
        const content = `${emoji} ${naam} (${rol}) -> ${action} ${details && Object.keys(details).length? "`"+JSON.stringify(details).slice(0,400)+"`" : ""}`;
        fetch(DISCORD_WEBHOOK_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ content }) }).catch(()=>{});
      }
    } catch(err){ console.warn("audit log faalde", err); }
  }

  // --- Permissions ---
  function magZien(groep){
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magIndienen(groep){
    return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.groep === groep);
  }
  function magBeheren(){
    return gebruikersData && gebruikersData.rol === "financieel";
  }

  // --- Data helpers ---
  async function haalGebruikersData(uid){
    const d = await firebase.firestore().collection("gebruikers").doc(uid).get();
    return d.exists ? d.data() : null;
  }
  async function haalLedenPerGroep(){
    const d = await firebase.firestore().collection("config").doc("ledenPerGroep").get();
    return d.exists ? d.data() : {};
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
  function vulGroepSelectie(){
    const select = $("groep");
    if (!select || !gebruikersData) return;
    select.innerHTML = `<option value="">-- Kies een groep --</option>`;
    const toegestane = gebruikersData.rol === "financieel" ? alleGroepen : [gebruikersData.groep];
    toegestane.forEach(g => { select.innerHTML += `<option value="${g}">${g}</option>`; });
  }

  // --- Bewijs upload: Cloudinary (optioneel) of Firebase Storage (fallback) ---
  // Vul deze in als je Cloudinary wilt gebruiken (unsigned upload):
  // Voorbeeld: const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/<cloud-name>/upload";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/<dxizebpwn>/upload";
const CLOUDINARY_PRESET = "<chiro_upload_fotos>";
  function sanitizeFilename(name){ return (name||'bestand').replace(/[^a-z0-9._-]/gi,'_'); }
  async function uploadBewijs(file){
    if (!file) throw new Error("Geen bestand opgegeven voor upload.");

    // 1) Cloudinary (als correct ingesteld)
    const looksLikeCloudinary = CLOUDINARY_URL.startsWith('https://api.cloudinary.com/v1_1/');
    if (looksLikeCloudinary && CLOUDINARY_PRESET){
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_PRESET);
      const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Upload geweigerd (HTTP ${res.status}). Controleer CLOUDINARY_URL en preset. Server zegt: ${text}`);
        }
        throw new Error(`Upload naar Cloudinary mislukt (HTTP ${res.status}). Response: ${text}`);
      }
      const data = await res.json().catch(() => null);
      if (!data || !data.secure_url) throw new Error("Cloudinary-respons bevat geen secure_url.");
      return data.secure_url;
    }

    // 2) Firebase Storage fallback
    try {
      if (!firebase.storage) throw new Error('Firebase Storage SDK niet geladen.');
      const app = firebase.app();
      const storage = firebase.storage();
      // Probeer default bucket; zo niet, val terug op <projectId>.appspot.com
      let rootRef;
      try {
        const bucket = app.options && app.options.storageBucket;
        const projectId = (app.options && app.options.projectId) || 'default-bucket';
        const needsOverride = !bucket || /firebasestorage\.app$/i.test(bucket) || !/appspot\.com$/i.test(bucket);
        rootRef = needsOverride ? storage.refFromURL(`gs://${projectId}.appspot.com`) : storage.ref();
      } catch(e){ rootRef = storage.ref(); }

      const uid = firebase.auth().currentUser?.uid || 'anon';
      const path = `bewijsjes/${uid}/${Date.now()}-${sanitizeFilename(file.name)}`;
      const meta = { contentType: file.type || 'application/octet-stream' };
      const snap = await rootRef.child(path).put(file, meta);
      const url = await snap.ref.getDownloadURL();
      return url;
    } catch (e){
      const hint = (e && e.message || '').toLowerCase().includes('unauthorized')
        ? 'Je hebt geen rechten om naar Firebase Storage te schrijven. Controleer Storage-regels en of je bent ingelogd.'
        : 'Controleer of Firebase Storage is ingeschakeld. Zo niet, zet in config storageBucket op <projectId>.appspot.com of laat de fallback z\'n werk doen.';
      throw new Error(`Upload naar Firebase Storage mislukt: ${(e && e.message) || e}. ${hint}`);
    }
  }

  // --- Uitgaven toevoegen (submit handler) ---
  safeOn($("uitgaveForm"), "submit", async e => {
    e.preventDefault();

    // Lees en valideer velden
    const g = $("groep")?.value;
  const bRaw = $("bedrag")?.value;
  const b = parseEuro(bRaw);
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
    try {
      // Genereer nummer (uniek) via query op bestaande nummers
  const uitgavenSnap = await firebase.firestore().collection("uitgaven").get();
      const bestaandeNummers = uitgavenSnap.docs.map(d => (d.data().nummer)||0);
      let nieuwNummer;
      do { nieuwNummer = Math.floor(1000 + Math.random() * 9000); } while (bestaandeNummers.includes(nieuwNummer));
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
        aangemaaktOp: firebase.firestore.FieldValue.serverTimestamp()
      };
  await firebase.firestore().collection("uitgaven").doc(String(nieuwNummer)).set(entry);
      logActie("uitgave_toegevoegd", { nummer: nieuwNummer, groep: g, bedrag: b.toFixed(2), activiteit: a, datum: d });
      // reset formulier en herlaad tabel
        $("uitgaveForm")?.reset();
        attachUitgavenListener($("filterGroep")?.value || "", $("filterBetaald")?.value || "");
    } catch (err) {
      console.error("Opslaan uitgave mislukt:", err);
      alert("Opslaan mislukt: " + (err && err.message ? err.message : err));
    }
  });

  // --- Rendering / realtime ---
  let uitgavenUnsub = null;
  function attachUitgavenListener(filterGroep = "", filterBetaald = "") {
    if (uitgavenUnsub) { uitgavenUnsub(); uitgavenUnsub = null; }
    const tbody = document.querySelector("#overzicht tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    let q = firebase.firestore().collection("uitgaven");
    if (gebruikersData && gebruikersData.rol === "leiding") {
      q = q.where("groep","==",gebruikersData.groep);
    }
    if (filterGroep) q = q.where("groep","==",filterGroep);
    if (filterBetaald !== "") q = q.where("betaald","==", filterBetaald === "true");
    uitgavenUnsub = q.onSnapshot(snap => {
      tbody.innerHTML = "";
      const rows = snap.docs.map(d=>d.data()).sort((a,b)=>(a.nummer||0)-(b.nummer||0));
      rows.forEach(u => {
  const rij = tbody.insertRow();
  rij.style.backgroundColor = kleurVoorGroep(u.groep);
        rij.insertCell(0).textContent = u.nummer || "-";
        rij.insertCell(1).textContent = u.groep || "-";
        rij.insertCell(2).textContent = u.bedrag ? `€${u.bedrag}` : "-";
        rij.insertCell(3).textContent = u.activiteit || "-";
        rij.insertCell(4).textContent = u.datum || "-";
        const betaaldStatusCell = rij.insertCell(5);
        betaaldStatusCell.className = "betaald-status";
        betaaldStatusCell.textContent = u.betaald ? "✓" : "✗";
        betaaldStatusCell.style.color = u.betaald ? "#27ae60" : "#e74c3c";
        const actieCell = rij.insertCell(6);
        if (magBeheren()) {
          const verwijderBtn = document.createElement("button");
          verwijderBtn.textContent = "🗑️";
          verwijderBtn.title = "Verwijder uitgave";
          verwijderBtn.onclick = async () => {
            if (confirm("Weet je zeker dat je deze uitgave wilt verwijderen?")) {
              await firebase.firestore().collection("uitgaven").doc(String(u.nummer)).delete();
              logActie("uitgave_verwijderd", { nummer: u.nummer, groep: u.groep, bedrag: u.bedrag });
            }
          };
          actieCell.appendChild(verwijderBtn);
        }
        const betaaldCell = rij.insertCell(7);
        if (magBeheren()) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = !!u.betaald;
          checkbox.onchange = async () => {
            await firebase.firestore().collection("uitgaven").doc(String(u.nummer)).update({ betaald: checkbox.checked });
            logActie("uitgave_betaald_toggle", { nummer: u.nummer, betaald: checkbox.checked });
          };
          betaaldCell.appendChild(checkbox);
        }
        rij.insertCell(8).textContent = u.rekeningNummer || "-";
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
    }, err => console.error("Realtime uitgaven mislukt:", err));
  }

  // Samenvatting UI en code verwijderd (eigen pagina)

  // --- Auth state & init (kort) ---
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      huidigeGebruiker = user;
      try { gebruikersData = (await haalGebruikersData(user.uid)) || {}; }
      catch { gebruikersData = {}; }

      if (gebruikersData.rol === "financieel") {
        try { ledenPerGroep = await haalLedenPerGroep(); }
        catch (err) { ledenPerGroep = {}; console.warn("geen toegang tot ledenPerGroep:", err); }
      } else {
        ledenPerGroep = {};
      }

  // UI: show/hide relevant onderdelen
      $("loginScherm") && ($("loginScherm").style.display = "none");
      $("appInhoud") && ($("appInhoud").style.display = "block");
      $("gebruikerInfo") && ($("gebruikerInfo").textContent = `Ingelogd als ${gebruikersData.rol || 'onbekend'} (${gebruikersData.groep || 'ALL'})`);

  // Navbar tonen + role based links
  const nav = document.getElementById('mainNav');
  if (nav) nav.style.display = 'flex';
  const navSam = document.getElementById('navSamenvatting');
  const navBeh = document.getElementById('navBeheer');
  const navEven = document.getElementById('navEvenementen');
  const navOnk = document.getElementById('navOnkostennota');
  const navExport = document.getElementById('navExportPdf');
  const navTheme = document.getElementById('navTheme');
  const navLogout = document.getElementById('navLogout');
  const isFin = gebruikersData.rol === 'financieel';
  if (navSam) navSam.style.display = isFin ? 'inline' : 'none';
  if (navBeh) navBeh.style.display = isFin ? 'inline' : 'none';
  const hasEventRoles = !!(gebruikersData && gebruikersData.evenementen && Object.values(gebruikersData.evenementen).some(Boolean));
  if (navEven) navEven.style.display = (isFin || hasEventRoles) ? 'inline' : 'none';
  if (navExport) navExport.style.display = isFin ? 'inline' : 'none';
  if (navOnk) navOnk.style.display = isFin ? 'inline' : 'none';
  if (navLogout) navLogout.style.display = 'inline';
  if (navTheme) { navTheme.style.display = 'inline'; navTheme.textContent = document.body.dataset.theme === 'light' ? '🌞' : '🌙'; }

      // vul selects / render tabelen
      vulGroepSelectie();

      // herstel zichtbaarheidsregels voor financieel
      toonBeheerPaneel();
      toonFinancieelFeatures();
      toonFinancieelKolommen();

  // Samenvatting is verwijderd

  attachUitgavenListener();
  // Logout knop zit in de navbar; geen floating knop meer
  // Koppel de uitlog-actie aan de navbar knop
  safeOn($("navLogout"), "click", async () => { await logActie("logout", {}); firebase.auth().signOut(); });
  // Theme toggle
  safeOn($("navTheme"), "click", async () => {
    const current = document.body.dataset.theme || localStorage.getItem('theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (document.getElementById('navTheme')) document.getElementById('navTheme').textContent = next==='light' ? '🌞' : '🌙';
    await saveThemePreference(next);
    logActie("theme_changed", { theme: next });
  });
    } else {
      // logged out
      $("appInhoud") && ($("appInhoud").style.display = "none");
      $("loginScherm") && ($("loginScherm").style.display = "block");
      $("loginFout") && ($("loginFout").textContent = "");
      huidigeGebruiker = null;
      gebruikersData = null;
      ledenPerGroep = {};
      // Verberg nav-items wanneer uitgelogd
      const navSam = document.getElementById('navSamenvatting');
      const navBeh = document.getElementById('navBeheer');
  const navEven = document.getElementById('navEvenementen');
      const navOnk = document.getElementById('navOnkostennota');
      const navExport = document.getElementById('navExportPdf');
      const navLogout = document.getElementById('navLogout');
      const nav = document.getElementById('mainNav');
      if (navSam) navSam.style.display = 'none';
      if (navBeh) navBeh.style.display = 'none';
  if (navEven) navEven.style.display = 'none';
      if (navOnk) navOnk.style.display = 'none';
      if (navExport) navExport.style.display = 'none';
      if (navLogout) navLogout.style.display = 'none';
      if (nav) nav.style.display = 'none';
    }
  });

  // --- Safe event listeners (rest of UI) ---
  safeOn($("loginKnop"), "click", async () => {
    const emailInput = $("loginEmail");
    const passInput = $("loginWachtwoord");
    const loginBtn = $("loginKnop");
    const fout = $("loginFout");
    const email = (emailInput?.value || "").trim();
    const wachtwoord = (passInput?.value || "").trim();
    if (!email || !wachtwoord) {
      if (fout) fout.textContent = "Vul e-mail en wachtwoord in.";
      return;
    }
    if (loginBtn) loginBtn.disabled = true;
    if (fout) fout.textContent = "Bezig met inloggen...";
    try {
      console.debug("Attempt login", { email, projectId: firebase.app().options.projectId });
      await firebase.auth().signInWithEmailAndPassword(email, wachtwoord);
  logActie("login", {});
      if (fout) fout.textContent = "";
    } catch (err) {
      let msg = (err && err.message) ? err.message : String(err);
      // Bekende auth codes verduidelijken
      const code = err && err.code ? err.code : "";
      switch (code) {
        case "auth/invalid-email": msg = "Ongeldig e-mailadres"; break;
        case "auth/user-not-found": msg = "Geen account met dit e-mailadres"; break;
        case "auth/wrong-password": msg = "Onjuist wachtwoord"; break;
        case "auth/too-many-requests": msg = "Te veel pogingen, probeer later opnieuw"; break;
        case "auth/invalid-login-credentials": msg = "Combinatie e-mail/wachtwoord ongeldig"; break;
      }
      if (fout) fout.textContent = "Login mislukt: " + msg;
      console.warn("Login error", err);
    } finally {
      if (loginBtn) loginBtn.disabled = false;
    }
  });

  // Filters
  safeOn($("filterGroep"), "change", e => attachUitgavenListener(e.target.value, $("filterBetaald")?.value));
  safeOn($("filterBetaald"), "change", e => attachUitgavenListener($("filterGroep")?.value, e.target.value));

  // toon/verberg beheerpaneel en financieel features/kolommen
  function toonBeheerPaneel() {
    const paneel = $("beheerPaneel");
    const toggleBtn = $("toggleBeheerPaneel");
    if (!paneel || !toggleBtn) return;
    const show = magBeheren();
    toggleBtn.style.display = show ? "block" : "none";
    if (!show) {
      paneel.style.display = "none";
      return;
    }
    // standaard ingeklapt
    if (paneel.style.display === "") paneel.style.display = "none";
    renderGebruikersLijst();
  }

  function toonFinancieelFeatures() {
    const summaryBtn = $("toggleSummary");
    const show = magBeheren();
    if (summaryBtn) summaryBtn.style.display = show ? "block" : "none";
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

  // (Dubbele definitie van setupSummaryToggle verwijderd)

  safeOn($("navExportPdf"), "click", async () => {
    const doc = new window.jspdf.jsPDF();
    doc.setFontSize(14);
    doc.text("Uitgavenoverzicht per groep", 10, 10);

    // Haal alle uitgaven op
  const uitgavenSnap = await firebase.firestore().collection("uitgaven").get();
  const uitgaven = uitgavenSnap.docs.map(d => d.data());

    // Groepeer per groep
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
      // Sorteer op datum
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
          `| ${u.datum || "-"} | ${u.activiteit || "-"} | ${u.betaald ? "Betaald" : "Niet betaald"}`,
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
      await firebase.firestore().collection("gebruikers").doc(uid).set({ groep, rol }, { merge: true });
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

  // Zorg dat de knop zichtbaar is voor financieel
  // (Dubbele toonBeheerPaneel definitie verwijderd bovenaan geconsolideerd)

  // Floating logout knop verwijderd

  // Toon gebruikerslijst met statusbolletjes
  async function renderGebruikersLijst() {
    const tbody = document.getElementById("gebruikersLijstBody");
    if (!tbody) return;
    if (!magBeheren()) { tbody.innerHTML = ""; return; }
    tbody.innerHTML = "";

    // Haal alle gebruikers uit Firebase
  const gebruikersSnap = await firebase.firestore().collection("gebruikers").get();
    const allUsers = gebruikersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

    // Haal online status op via presence (of alleen huidige user als je geen presence gebruikt)
    // Simpel: alleen huidige gebruiker is online
    const currentUid = firebase.auth().currentUser?.uid;

    allUsers.forEach(user => {
      const tr = document.createElement("tr");
      // E-mail
      const emailTd = document.createElement("td");
      emailTd.textContent = user.email || "-";
      tr.appendChild(emailTd);

      // UID
      const uidTd = document.createElement("td");
      uidTd.textContent = user.uid;
      tr.appendChild(uidTd);

      // Rol
      const rolTd = document.createElement("td");
      rolTd.textContent = user.rol || "-";
      tr.appendChild(rolTd);

      // Groep
      const groepTd = document.createElement("td");
      groepTd.textContent = user.groep || "-";
      tr.appendChild(groepTd);

      tbody.appendChild(tr);
    });
  }

  // Roep deze functie aan na het tonen van het beheerpaneel:
  // (Laatste dubbele toonBeheerPaneel verwijderd - gebruik geconsolideerde versie)
});





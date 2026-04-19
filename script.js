document.addEventListener("DOMContentLoaded", () => {
  // --- Config ---
  const alleGroepen = ["Ribbels","Speelclubs","Rakkers","Kwiks","Tippers","Toppers","Aspi","Keti's","4uurtje","Algemeen","LEIDING"]; // Basale vaste groepen + Keti's + 4uurtje + Algemeen
  const groepKleuren = {
    Ribbels: "rgba(59,130,246,0.18)",
    Speelclubs: "rgba(234,179,8,0.18)",
    Rakkers: "rgba(34,197,94,0.18)",
    Kwiks: "rgba(244,114,182,0.18)",
    Tippers: "rgba(99,102,241,0.18)",
    Toppers: "rgba(16,185,129,0.18)",
    Aspi: "rgba(249,115,22,0.18)",
    "Keti's": "rgba(56,189,248,0.18)",
    "4uurtje": "rgba(168,85,247,0.18)",
    Algemeen: "rgba(0,0,0,0.12)", // neutrale lichte grijstint voor algemene kosten
    LEIDING: "rgba(148,163,184,0.18)",
    Overige: "rgba(120,120,120,0.25)" // synthetische groep alleen zichtbaar voor financieel
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
      "keti's": groepKleuren["Keti's"],
      "4uurtje": groepKleuren["4uurtje"],
      algemeen: groepKleuren.Algemeen,
      leiding: groepKleuren.LEIDING,
      overige: groepKleuren.Overige
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
    // Voeg "Overige" optioneel toe voor financieel
    const toegestane = gebruikersData.rol === "financieel" ? [...alleGroepen, "Overige"] : [gebruikersData.groep];
    toegestane.forEach(g => { select.innerHTML += `<option value="${g}">${g}</option>`; });
  }

  // --- Bewijs upload: Cloudinary (optioneel) of Firebase Storage (fallback) ---
  // Zet echte waarden in deze twee constants om Cloudinary te activeren; laat < > placeholders staan om automatisch Storage te gebruiken
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxizebpwn/upload"; // bv: https://api.cloudinary.com/v1_1/mijncloud/upload
  const CLOUDINARY_PRESET = "chiro_upload_fotos"; // bv: chiro_bewijs_unsigned
  function sanitizeFilename(name){ return (name||'bestand').replace(/[^a-z0-9._-]/gi,'_'); }
  async function uploadBewijs(file){
    if (!file) throw new Error("Geen bestand opgegeven voor upload.");

    // Zorg dat user echt ingelogd is voordat we een pad met uid construeren
    const authUser = firebase.auth().currentUser;
    if (!authUser) {
      throw new Error("Niet ingelogd (currentUser is null) op moment van upload.");
    }
    try {
      // Forceer een vers ID token (kan 1e seconden nog ontbreken)
      await authUser.getIdToken(true);
    } catch (e) {
      console.warn("Kon ID token niet vernieuwen", e);
    }

    const cloudinaryConfigured = (
      /^https:\/\/api\.cloudinary\.com\/v1_1\/[^<>\s]+\/upload$/i.test(CLOUDINARY_URL) &&
      CLOUDINARY_PRESET &&
      !CLOUDINARY_URL.includes('<') &&
      !CLOUDINARY_PRESET.includes('<')
    );

    if (cloudinaryConfigured) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_PRESET);
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json().catch(()=>null);
          if (data && data.secure_url) return data.secure_url;
          console.warn('Cloudinary zonder secure_url, fallback naar Storage');
        } else {
          console.warn('Cloudinary upload status', res.status, 'fallback naar Storage');
        }
      } catch (err) {
        console.warn('Cloudinary uitzondering, fallback naar Storage', err);
      }
    }

    // Firebase Storage fallback
    if (!firebase.storage) throw new Error('Firebase Storage SDK niet geladen.');
    const app = firebase.app();
    const storage = firebase.storage();
    let rootRef;
    try {
      const bucket = app.options && app.options.storageBucket;
      const projectId = (app.options && app.options.projectId) || 'default-bucket';
      const needsOverride = !bucket || /firebasestorage\.app$/i.test(bucket) || !/appspot\.com$/i.test(bucket);
      rootRef = needsOverride ? storage.refFromURL(`gs://${projectId}.appspot.com`) : storage.ref();
    } catch(e){ rootRef = storage.ref(); }

    const uid = authUser.uid;
    const path = `bewijsjes/${uid}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const meta = { contentType: file.type || 'application/octet-stream' };
    try {
      console.debug('[uploadBewijs] attempt', { bucket: (firebase.app().options||{}).storageBucket, resolvedRoot: !!rootRef, path, contentType: meta.contentType });
      const snap = await rootRef.child(path).put(file, meta);
      return await snap.ref.getDownloadURL();
    } catch(e){
      const msg = (e && e.message) || String(e);
      if (/cors|preflight|network/i.test(msg)) {
        throw new Error('Upload mislukt door CORS/permissie. Controleer Storage rules & allowed origins. Details: '+msg);
      }
      throw new Error('Upload naar Firebase Storage mislukt: '+msg);
    }
  }

  function setUploading(state){
    const btn = document.querySelector('#uitgaveForm button[type="submit"]');
    if (!btn) return;
    if (state){ btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = 'Bezig...'; }
    else { btn.disabled = false; if (btn.dataset.prevText) btn.textContent = btn.dataset.prevText; }
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
    const overigeWrap = $("overigeGroepenWrap");
    const overigeInput = $("overigeGroepen");
    let overigeGroepenArr = [];

    if (g === "Overige") {
      if (gebruikersData?.rol !== 'financieel') { alert("Alleen financieel mag 'Overige' gebruiken."); return; }
      const raw = (overigeInput?.value || "").trim();
      overigeGroepenArr = raw.split(",").map(s=>s.trim()).filter(Boolean);
      if (!overigeGroepenArr.length) { alert("Vul minstens één groep in voor Overige (kommagescheiden)."); return; }
      // Valideer dat alle subgroepen echte bestaande basisgroepen zijn (geen LEIDING / Overige)
      const basisSet = new Set(alleGroepen.filter(x => x !== 'LEIDING'));
      const invalid = overigeGroepenArr.filter(x => !basisSet.has(x));
      if (invalid.length) { alert("Ongeldige subgroep(en): " + invalid.join(", ")); return; }
    }

    if (!g || isNaN(b) || !a || !d) return alert("Gelieve alle velden correct in te vullen.");
    if (!magIndienen(g)) return alert("Je mag geen uitgave indienen voor deze groep.");
    if (!rekeningNummer) return alert("Vul je rekeningnummer in.");
    if (!file) return alert("Upload een bewijsstuk.");

    // Upload eerst het bewijs en stop bij fout (zodat we geen undefined naar DB schrijven)
    let bewijsUrl = "";
    try {
      setUploading(true);
      bewijsUrl = await uploadBewijs(file);
    } catch (err) {
      console.error("Upload bewijsstuk mislukt:", err);
      // toon duidelijke melding voor gebruiker
      alert("Upload bewijsstuk mislukt:\n" + (err && err.message ? err.message : err));
      return; // stop submit — geen DB write met undefined
    }

    // Schrijf uitgave naar Firebase: gebruik veilige waarden (nooit undefined)
    try {
      console.debug('[DEBUG submit-uitgave] gebruikersData=', gebruikersData, 'authUid=', firebase.auth().currentUser?.uid, 'groepForm=', g);
      // Probeer bestaand overzicht op te halen om uniek nummer te genereren; bij permissie-fout val terug op random.
      let bestaandeNummers = [];
      try {
        const uitgavenSnap = await firebase.firestore().collection("uitgaven").get();
        bestaandeNummers = uitgavenSnap.docs.map(d => (d.data().nummer)||0);
      } catch(readErr){
        console.warn('[DEBUG submit-uitgave] kon uitgaven niet lezen (val terug op random nummer):', readErr && readErr.code, readErr);
      }
      let nieuwNummer; let attempts=0;
      do { nieuwNummer = Math.floor(1000 + Math.random() * 9000); attempts++; } while (bestaandeNummers.includes(nieuwNummer) && attempts < 25);
      if (attempts>=25) console.warn('[DEBUG submit-uitgave] veel pogingen voor uniek nummer; accepteer', nieuwNummer);
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
        aangemaaktDoorUid: firebase.auth().currentUser?.uid || null,
        aangemaaktOp: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (g === 'Overige' && overigeGroepenArr.length) {
        entry.overigeGroepen = overigeGroepenArr;
      }
      console.debug('[DEBUG submit-uitgave] schrijf doc', entry);
      await firebase.firestore().collection("uitgaven").doc(String(nieuwNummer)).set(entry);
      console.debug('[DEBUG submit-uitgave] SUCCES nummer', nieuwNummer);
      logActie("uitgave_toegevoegd", { nummer: nieuwNummer, groep: g, bedrag: b.toFixed(2), activiteit: a, datum: d });
      // reset formulier en herlaad tabel
      $("uitgaveForm")?.reset();
      if (overigeWrap) overigeWrap.style.display = 'none';
      if (overigeInput) overigeInput.value = '';
      attachUitgavenListener($("filterGroep")?.value || "", $("filterBetaald")?.value || "");
    } catch (err) {
      console.error("Opslaan uitgave mislukt:", err, 'code=', err && err.code);
      alert("Opslaan mislukt: " + (err && err.message ? err.message : err));
    } finally { setUploading(false); }
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
        const groepCell = rij.insertCell(1);
        if (u.groep === 'Overige' && Array.isArray(u.overigeGroepen) && u.overigeGroepen.length) {
          groepCell.textContent = `Overige (${u.overigeGroepen.join(', ')})`;
          groepCell.title = 'Subgroepen: ' + u.overigeGroepen.join(', ');
        } else {
          groepCell.textContent = u.groep || '-';
        }
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
      try {
        gebruikersData = (await haalGebruikersData(user.uid)) || {};
        if (!gebruikersData || Object.keys(gebruikersData).length === 0) {
          console.warn('[auth] Geen gebruikersdoc gevonden – maak standaard doc aan');
          // Probeer standaard doc aan te maken met rol "leiding" tenzij email lijkt op finance
          const defaultRol = /fin|boek|kas|treasurer|finance/i.test(user.email||'') ? 'financieel' : 'leiding';
            const defaultGroep = 'Ribbels';
          await firebase.firestore().collection('gebruikers').doc(user.uid).set({
            email: user.email || '',
            rol: defaultRol,
            groep: defaultGroep,
            aangemaaktOp: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          gebruikersData = (await haalGebruikersData(user.uid)) || { rol: defaultRol, groep: defaultGroep };
          console.info('[auth] Standaard gebruikersdoc aangemaakt', gebruikersData);
        }
      } catch (e) {
        console.error('[auth] Fout bij ophalen/aanmaken gebruikersdoc', e);
        gebruikersData = gebruikersData || {};
      }

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
  console.debug('[auth] Loaded gebruikersData', gebruikersData);

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
      // koppel change event voor Overige toggle
      safeOn($("groep"), 'change', () => {
        const sel = $("groep")?.value;
        const wrap = $("overigeGroepenWrap");
        if (!wrap) return;
        if (sel === 'Overige' && gebruikersData?.rol === 'financieel') {
          wrap.style.display = 'block';
        } else {
          wrap.style.display = 'none';
          const input = $("overigeGroepen"); if (input) input.value='';
        }
      });

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
    try {
      const jspdfNS = window.jspdf || window.jspdf_default || {};
      const jsPDF = jspdfNS.jsPDF || (window.jspdf && window.jspdf.jsPDF);
      if (!jsPDF || !('autoTable' in (jsPDF.API || {}))) {
        alert('PDF bibliotheek niet geladen. Controleer je internetverbinding.');
        return;
      }

      // Haal alle uitgaven op (zichtbaar voor financieel)
      const uitgavenSnap = await firebase.firestore().collection("uitgaven").get();
      const rowsRaw = uitgavenSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Verrijk en sorteer: Groep ASC, Datum ASC, Nummer ASC
      const normDate = (s) => (s || '').toString();
      const toEuro = (v) => `€${(Number(v)||0).toFixed(2)}`;
      const niceGroep = (u) => {
        if (u.groep === 'Overige' && Array.isArray(u.overigeGroepen) && u.overigeGroepen.length) {
          return `Overige (${u.overigeGroepen.join(', ')})`;
        }
        return u.groep || '-';
      };
      const rows = rowsRaw
        .sort((a,b)=>{
          const g = (a.groep||'').localeCompare(b.groep||'');
          if (g !== 0) return g;
          const d = normDate(a.datum).localeCompare(normDate(b.datum));
          if (d !== 0) return d;
          return (a.nummer||0) - (b.nummer||0);
        })
        .map(u => ([
          niceGroep(u),
          String(u.nummer || '-'),
          normDate(u.datum) || '-',
          u.activiteit || '-',
          toEuro(u.bedrag),
          (u.betaald ? 'Ja' : 'Nee')
        ]));

      const doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
      const margin = 36;
      const pageWidth = doc.internal.pageSize.getWidth();
      const title = 'Uitgavenoverzicht';
      const now = new Date();
      const datum = now.toLocaleString('nl-BE', { dateStyle:'medium', timeStyle:'short' });

      // Header
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text(title, margin, margin + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`Gegenereerd op ${datum}`, margin, margin + 20);
      doc.setTextColor(0);

      // AutoTable
      const head = [[ 'Groep', '#', 'Datum', 'Activiteit', 'Bedrag', 'Betaald' ]];
      doc.autoTable({
        head,
        body: rows,
        startY: margin + 36,
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
        headStyles: { fillColor: [44,62,80], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245,247,250] },
        columnStyles: {
          0: { cellWidth: 120 },        // Groep
          1: { cellWidth: 36, halign:'right' }, // #
          2: { cellWidth: 70 },         // Datum
          3: { cellWidth: 'auto' },     // Activiteit (flex)
          4: { cellWidth: 70, halign:'right' }, // Bedrag
          5: { cellWidth: 50, halign:'center' } // Betaald
        },
        didDrawPage: function(data){
          // Footer met paginanummers
          const pageCount = doc.internal.getNumberOfPages();
          const footerY = doc.internal.pageSize.getHeight() - 16;
          doc.setFontSize(9); doc.setTextColor(120);
          doc.text(`Pagina ${data.pageNumber} van ${pageCount}`, pageWidth - margin, footerY, { align:'right' });
          doc.setTextColor(0);
        }
      });

      // Opslaan
      const filename = `uitgaven_overzicht_${now.toISOString().slice(0,10)}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Export PDF fout:', err);
      alert('Exporteren mislukt. Zie console voor details.');
    }
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






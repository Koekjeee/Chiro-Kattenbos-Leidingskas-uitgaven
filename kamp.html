<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chiro Kattenbos – Kamp Uitgavenbeheer</title>
  <link rel="stylesheet" href="style.css?v=20250926" />

  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-storage-compat.js"></script>
  <script>
const firebaseConfig = {
  apiKey: "AIzaSyC-UaXhh5juhV4raXWnzku9fSZZD75-y9w",
  authDomain: "uitgavebeheerch.firebaseapp.com",
  databaseURL: "https://uitgavebeheerch-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "uitgavebeheerch",
  storageBucket: "uitgavebeheerch.appspot.com",
  messagingSenderId: "461673562296",
  appId: "1:461673562296:web:d90a026cd685400139f44d",
  measurementId: "G-K8NYLSE5EF"
};
    firebase.initializeApp(firebaseConfig);
  </script>
</head>
<body>
  <nav id="mainNav">
    <span>Chiro Kattenbos</span>
    <a href="index.html">Home</a>
    <a id="navKamp" href="kamp.html" class="active">Kamp</a>
    <a id="navSamenvatting" href="samenvatting.html" target="_blank">Samenvatting</a>
    <a id="navEvenementen" href="evenementen.html">Evenementen</a>
    <a id="navBeheer" href="gebruikersbeheer.html">Gebruikersbeheer</a>
    <button id="navTheme" title="Schakel thema" style="display:none;">🌙</button>
    <button id="navLogout">Uitloggen</button>
  </nav>
  <div class="container">
  <div id="loginScherm">
    <h2>Inloggen</h2>
    <input type="email" id="loginEmail" placeholder="E-mailadres" required />
    <input type="password" id="loginWachtwoord" placeholder="Wachtwoord" required />
    <button id="loginKnop">Inloggen</button>
    <p id="loginFout" style="color: red;"></p>
  </div>

  <div id="appInhoud" style="display: none;">
    <h1>Chiro Kattenbos – Kamp Uitgavenbeheer</h1>
    <p id="gebruikerInfo"></p>

    <!-- Beheer panel: alleen voor financieel -->
    <div id="beheerPaneel" style="display:none; margin-bottom: 2rem; padding: 1rem; background: transparent; border-radius: 8px;">
      <button id="toggleBeheerPaneel" style="background: #2c3e50; color: white; border: none; padding: 10px 15px; cursor: pointer; border-radius: 4px; font-weight: bold;">▼ Gebruikerstoegang beheren</button>
      <div id="beheerPaneelContent" style="display:none; margin-top: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
        <p style="font-size: 0.9rem; color: #666;">Vink de gebruikers aan die toegang hebben tot deze kamp-pagina.</p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>UID</th>
                <th>Rol</th>
                <th>Groep</th>
                <th>Kamp-toegang</th>
              </tr>
            </thead>
            <tbody id="kampAccessBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <form id="uitgaveForm">
      <label for="groep">Groep:</label>
      <select id="groep" required>
        <option value="">-- Kies een groep --</option>
        <option value="Ribbels">Ribbels</option>
        <option value="Speelclubs">Speelclubs</option>
        <option value="Rakkers">Rakkers</option>
        <option value="Kwiks">Kwiks</option>
        <option value="Tippers">Tippers</option>
        <option value="Toppers">Toppers</option>
        <option value="Aspi">Aspi</option>
        <option value="Keti's">Keti's</option>
        <option value="4uurtje">4uurtje</option>
        <option value="LEIDING">LEIDING</option>
      </select>
      <label for="bedrag">Bedrag (€):</label>
      <input type="text" id="bedrag" inputmode="decimal" pattern="^\d+(?:[\.,]\d{1,2})?$" placeholder="bv. 12,30" required />
      <label for="activiteit">Activiteit/Omschrijving:</label>
      <input type="text" id="activiteit" required />
      <label for="datum">Datum:</label>
      <input type="date" id="datum" required />
      <label for="rekeningNummer">Rekeningnummer:</label>
      <input type="text" id="rekeningNummer" required placeholder="BE00 0000 0000 0000" />
      <label for="bewijsUpload">Upload bewijsstuk (verplicht):</label>
      <input type="file" id="bewijsUpload" accept="image/*,application/pdf" required />
      <button type="submit">Toevoegen</button>
    </form>

    <div class="filter">
      <label for="filterBetaald">Filter op betaald:</label>
      <select id="filterBetaald">
        <option value="">Alles</option>
        <option value="true">Betaald</option>
        <option value="false">Niet betaald</option>
      </select>
    </div>
    <div class="table-scroll">
    <table id="overzicht">
      <thead>
        <tr>
          <th>#</th>
          <th>Groep</th>
          <th>Bedrag</th>
          <th>Activiteit</th>
          <th>Datum</th>
          <th>Actie</th>
          <th>Terug betaald?</th>
          <th>Rekeningnummer</th>
          <th>Bewijs</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
    </div>
  </div>
  </div>

  <script>
    const db = firebase.firestore();
    let huidigeGebruiker = null;
    let gebruikersData = null;
    let clientIP = null;
    const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxizebpwn/upload";
    const CLOUDINARY_PRESET = "chiro_upload_fotos";

    // Utility
    const $ = (id) => document.getElementById(id);
    const safeOn = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };

    function nameFromEmail(email){
      if (!email) return "-";
      const [left] = email.split("@");
      return left ? left.replace(/[._-]+/g, " ").replace(/\b\w/g, c=>c.toUpperCase()) : email;
    }

    function parseEuro(input){
      if (typeof input === 'number') return input;
      const s = String(input || '').trim().replace(/\s/g,'');
      if (!s) return NaN;
      const norm = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
      const v = Number(norm);
      return isNaN(v) ? NaN : v;
    }

    function applyTheme(theme){
      document.body.dataset.theme = theme;
    }

    async function saveThemePreference(theme){
      try {
        localStorage.setItem("theme", theme);
        if (huidigeGebruiker) {
          await db.collection("gebruikers").doc(huidigeGebruiker.uid).set({ theme }, { merge: true });
        }
      } catch {}
    }

    applyTheme(localStorage.getItem("theme") || "dark");

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

    async function logActie(action, details){
      try {
        const user = firebase.auth().currentUser;
        const email = user?.email || gebruikersData?.email || "-";
        const rol = gebruikersData?.rol || "-";
        const naam = nameFromEmail(email);
        const isAdmin = (rol === "financieel");
        const emoji = isAdmin ? "🛡️" : "👤";
        const ip = clientIP || await resolveClientIP();
        await db.collection("auditLogs").add({
          action, details: details || {}, uid: user?.uid || null, email, naam, rol, isAdmin, emoji,
          ip: ip || null, ua: navigator.userAgent, at: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch(err){ console.warn("audit log faalde", err); }
    }

    function magBeheren(){
      return gebruikersData && gebruikersData.rol === "financieel";
    }

    function magKampAccessen(){
      return gebruikersData && (gebruikersData.rol === "financieel" || gebruikersData.kampAccess === true);
    }

    async function haalGebruikersData(uid){
      const d = await db.collection("gebruikers").doc(uid).get();
      return d.exists ? d.data() : null;
    }

    function sanitizeFilename(name){ return (name||'bestand').replace(/[^a-z0-9._-]/gi,'_'); }

    async function uploadBewijs(file){
      if (!file) throw new Error("Geen bestand opgegeven voor upload.");
      const authUser = firebase.auth().currentUser;
      if (!authUser) throw new Error("Niet ingelogd.");
      try { await authUser.getIdToken(true); } catch (e) { console.warn("Kon ID token niet vernieuwen", e); }

      const cloudinaryConfigured = (
        /^https:\/\/api\.cloudinary\.com\/v1_1\/[^<>\s]+\/upload$/i.test(CLOUDINARY_URL) &&
        CLOUDINARY_PRESET && !CLOUDINARY_URL.includes('<') && !CLOUDINARY_PRESET.includes('<')
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
          }
        } catch (err) { console.warn('Cloudinary uitzondering, fallback naar Storage', err); }
      }

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
      const snap = await rootRef.child(path).put(file, meta);
      return await snap.ref.getDownloadURL();
    }

    function setUploading(state){
      const btn = document.querySelector('#uitgaveForm button[type="submit"]');
      if (!btn) return;
      if (state){ btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = 'Bezig...'; }
      else { btn.disabled = false; if (btn.dataset.prevText) btn.textContent = btn.dataset.prevText; }
    }

    safeOn($("uitgaveForm"), "submit", async e => {
      e.preventDefault();
      const g = $("groep")?.value;
      const bRaw = $("bedrag")?.value;
      const b = parseEuro(bRaw);
      const a = $("activiteit")?.value;
      const d = $("datum")?.value;
      const rekeningNummer = $("rekeningNummer")?.value.trim();
      const file = $("bewijsUpload")?.files?.[0];

      if (!g) return alert("Kies een groep.");
      if (isNaN(b) || !a || !d) return alert("Gelieve alle velden correct in te vullen.");
      if (!rekeningNummer) return alert("Vul je rekeningnummer in.");
      if (!file) return alert("Upload een bewijsstuk.");

      let bewijsUrl = "";
      try {
        setUploading(true);
        bewijsUrl = await uploadBewijs(file);
      } catch (err) {
        console.error("Upload bewijsstuk mislukt:", err);
        alert("Upload bewijsstuk mislukt:\n" + (err && err.message ? err.message : err));
        return;
      }

      try {
        let bestaandeNummers = [];
        try {
          const uitgavenSnap = await db.collection("kampuitgaven").get();
          bestaandeNummers = uitgavenSnap.docs.map(d => (d.data().nummer)||0);
        } catch(readErr){ console.warn("Kon kampuitgaven niet lezen", readErr); }

        let nieuwNummer = 1 + Math.max(0, ...bestaandeNummers);
        const nu = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection("kampuitgaven").add({
          nummer: nieuwNummer,
          groep: g,
          bedrag: b,
          activiteit: a,
          datum: d,
          rekeningNummer: rekeningNummer,
          bewijsUrl: bewijsUrl,
          email: huidigeGebruiker?.email || '-',
          ingediendOp: nu,
          betaald: false,
          terugBetaald: false
        });

        alert("Uitgave succesvol toegevoegd!");
        $("uitgaveForm").reset();
        attachUitgavenListener($("filterBetaald")?.value || "");
        await logActie("kamp_uitgave_added", { groep: g, bedrag: b, activiteit: a });
      } catch (err) {
        console.error("Opslaan mislukt:", err);
        alert("Opslaan mislukt: " + (err && err.message ? err.message : err));
      } finally {
        setUploading(false);
      }
    });

    function attachUitgavenListener(filterBetaaldVal){
      const tbody = $("overzicht")?.querySelector("tbody");
      if (!tbody) return;

      return db.collection("kampuitgaven").onSnapshot(snap => {
        tbody.innerHTML = '';
        const filter = filterBetaaldVal?.toString();
        const isFin = magBeheren();

        snap.docs.forEach(doc => {
          const u = doc.data();
          if (filter === 'true' && !u.betaald) return;
          if (filter === 'false' && u.betaald) return;

          const row = tbody.insertRow();
          row.insertCell(0).textContent = u.nummer || '-';
          row.insertCell(1).textContent = u.groep || '-';
          row.insertCell(2).textContent = `€${(u.bedrag||0).toFixed(2)}`;
          row.insertCell(3).textContent = u.activiteit || '-';
          row.insertCell(4).textContent = u.datum || '-';

          const actieCell = row.insertCell(5);
          if (isFin) {
            // Voeg verwijder-knop toe
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Verwijderen";
            deleteBtn.style.background = "#e74c3c";
            deleteBtn.style.color = "white";
            deleteBtn.style.border = "none";
            deleteBtn.style.padding = "4px 8px";
            deleteBtn.style.cursor = "pointer";
            deleteBtn.style.borderRadius = "4px";
            deleteBtn.addEventListener("click", async () => {
              if (confirm("Weet je zeker dat je deze uitgave wilt verwijderen?")) {
                try {
                  await db.collection("kampuitgaven").doc(doc.id).delete();
                  await logActie("kamp_uitgave_deleted", { nummer: u.nummer, activiteit: u.activiteit });
                } catch(err) { alert("Verwijderen mislukt: " + err.message); }
              }
            });
            actieCell.appendChild(deleteBtn);
          } else {
            actieCell.style.display = "none";
          }

          const betaaldCell = row.insertCell(6);
          if (isFin) {
            const check = document.createElement("input");
            check.type = "checkbox";
            check.checked = u.terugBetaald || false;
            check.addEventListener("change", async () => {
              try {
                await db.collection("kampuitgaven").doc(doc.id).update({ terugBetaald: check.checked });
              } catch(err) { alert("Update mislukt: " + err.message); }
            });
            betaaldCell.appendChild(check);
            betaaldCell.style.display = isFin ? "table-cell" : "none";
          } else {
            betaaldCell.style.display = "none";
          }

          row.insertCell(7).textContent = u.rekeningNummer || '-';

          const bewijsCell = row.insertCell(8);
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
      }, err => console.error("Realtime kampuitgaven mislukt:", err));
    }

    async function renderKampAccessUsers() {
      const tbody = $("kampAccessBody");
      if (!tbody) return;
      if (!magBeheren()) { tbody.innerHTML = ""; return; }
      
      tbody.innerHTML = "";
      const gebruikersSnap = await db.collection("gebruikers").get();
      const allUsers = gebruikersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

      allUsers.forEach(user => {
        const tr = document.createElement("tr");
        
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

        const accessTd = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = user.kampAccess || false;
        checkbox.addEventListener("change", async () => {
          try {
            await db.collection("gebruikers").doc(user.uid).update({ kampAccess: checkbox.checked });
            await logActie("kamp_access_updated", { email: user.email, kampAccess: checkbox.checked });
          } catch(err) { alert("Update mislukt: " + err.message); }
        });
        accessTd.appendChild(checkbox);
        tr.appendChild(accessTd);

        tbody.appendChild(tr);
      });
    }

    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        huidigeGebruiker = user;
        try {
          gebruikersData = (await haalGebruikersData(user.uid)) || {};
          if (!gebruikersData || Object.keys(gebruikersData).length === 0) {
            const defaultRol = /fin|boek|kas|treasurer|finance/i.test(user.email||'') ? 'financieel' : 'leiding';
            const defaultGroep = 'Ribbels';
            await db.collection('gebruikers').doc(user.uid).set({
              email: user.email || '',
              rol: defaultRol,
              groep: defaultGroep,
              aangemaaktOp: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            gebruikersData = (await haalGebruikersData(user.uid)) || { rol: defaultRol, groep: defaultGroep };
          }
        } catch (e) {
          console.error('[auth] Fout bij ophalen/aanmaken gebruikersdoc', e);
          gebruikersData = gebruikersData || {};
        }

        $("loginScherm") && ($("loginScherm").style.display = "none");
        $("appInhoud") && ($("appInhoud").style.display = "block");
        $("gebruikerInfo") && ($("gebruikerInfo").textContent = `Ingelogd als ${gebruikersData.rol || 'onbekend'}`);

        const nav = document.getElementById('mainNav');
        if (nav) nav.style.display = 'flex';
        const navBeh = document.getElementById('navBeheer');
        const navTheme = document.getElementById('navTheme');
        const navLogout = document.getElementById('navLogout');
        const navSam = document.getElementById('navSamenvatting');
        const navEven = document.getElementById('navEvenementen');
        const isFin = gebruikersData.rol === 'financieel';
        const hasKampAccess = magKampAccessen();

        // Controleer of gebruiker dus kamp-toegang heeft
        if (!hasKampAccess) {
          alert('Je hebt geen toegang tot deze pagina. Je wordt teruggestuurd.');
          window.location.href = 'index.html';
          return;
        }

        // Verberg navigatie-items die niet beschikbaar zijn
        if (navBeh) navBeh.style.display = isFin ? 'inline' : 'none';
        if (navSam) navSam.style.display = isFin ? 'inline' : 'none';
        if (navEven) navEven.style.display = 'none'; // Events niet zichtbaar op kamp-pagina
        if (navLogout) navLogout.style.display = 'inline';
        if (navTheme) { navTheme.style.display = 'inline'; navTheme.textContent = document.body.dataset.theme === 'light' ? '🌞' : '🌙'; }

        // Toon beheer panel voor financieel
        const beheerPanel = $("beheerPaneel");
        if (beheerPanel) beheerPanel.style.display = isFin ? 'block' : 'none';
        if (isFin) renderKampAccessUsers();

        attachUitgavenListener($("filterBetaald")?.value || "");
      } else {
        $("appInhoud") && ($("appInhoud").style.display = "none");
        $("loginScherm") && ($("loginScherm").style.display = "block");
        $("loginFout") && ($("loginFout").textContent = "");
        huidigeGebruiker = null;
        gebruikersData = null;
        const nav = document.getElementById('mainNav');
        if (nav) nav.style.display = 'none';
      }
    });

    safeOn($("loginKnop"), "click", async () => {
      const emailInput = $("loginEmail");
      const passInput = $("loginWachtwoord");
      const fout = $("loginFout");
      const email = (emailInput?.value || "").trim();
      const wachtwoord = (passInput?.value || "").trim();
      if (!email || !wachtwoord) { if (fout) fout.textContent = "Vul e-mail en wachtwoord in."; return; }
      try {
        await firebase.auth().signInWithEmailAndPassword(email, wachtwoord);
        logActie("login", {});
        if (fout) fout.textContent = "";
      } catch (err) {
        let msg = (err && err.message) ? err.message : String(err);
        const code = err && err.code ? err.code : "";
        switch (code) {
          case "auth/invalid-email": msg = "Ongeldig e-mailadres"; break;
          case "auth/user-not-found": msg = "Geen account met dit e-mailadres"; break;
          case "auth/wrong-password": msg = "Onjuist wachtwoord"; break;
          case "auth/too-many-requests": msg = "Te veel pogingen, probeer later opnieuw"; break;
          case "auth/invalid-login-credentials": msg = "Combinatie e-mail/wachtwoord ongeldig"; break;
        }
        if (fout) fout.textContent = "Login mislukt: " + msg;
      }
    });

    safeOn($("filterBetaald"), "change", e => attachUitgavenListener(e.target.value));

    // Toggle beheer panel
    safeOn($("toggleBeheerPaneel"), "click", () => {
      const content = document.getElementById("beheerPaneelContent");
      const btn = document.getElementById("toggleBeheerPaneel");
      if (!content || !btn) return;
      if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
        btn.textContent = "▲ Gebruikerstoegang beheren";
      } else {
        content.style.display = "none";
        btn.textContent = "▼ Gebruikerstoegang beheren";
      }
    });

    safeOn($("navLogout"), "click", async () => { await logActie("logout", {}); firebase.auth().signOut(); });
    safeOn($("navTheme"), "click", async () => {
      const current = document.body.dataset.theme || localStorage.getItem('theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      if (document.getElementById('navTheme')) document.getElementById('navTheme').textContent = next==='light' ? '🌞' : '🌙';
      await saveThemePreference(next);
      logActie("theme_changed", { theme: next });
    });
  </script>
</body>
</html>








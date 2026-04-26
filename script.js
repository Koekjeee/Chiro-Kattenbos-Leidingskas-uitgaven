document.addEventListener("DOMContentLoaded", () => {

  // --- Config ---
  const alleGroepen = [
    "Ribbels","Speelclubs","Rakkers","Kwiks","Tippers",
    "Toppers","Aspi","Keti's","4uurtje","Algemeen","LEIDING"
  ];

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
    Algemeen: "rgba(0,0,0,0.12)",
    LEIDING: "rgba(148,163,184,0.18)",
    Overige: "rgba(120,120,120,0.25)"
  };

  // --- Globals ---
  let huidigeGebruiker = null;
  let gebruikersData = null;
  let ledenPerGroep = {};
  let clientIP = null;
  let uitgavenUnsub = null;

  // --- DOM Helpers ---
  const $ = (id) => document.getElementById(id);

  const safeOn = (el, ev, fn) => {
    if (el) el.addEventListener(ev, fn);
  };

  // --- Helpers ---
  function nameFromEmail(email){
    if (!email) return "-";
    const [left] = email.split("@");
    return left
      ? left.replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      : email;
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

  function parseEuro(input){
    if (typeof input === "number") return input;

    const s = String(input || "").trim().replace(/\s/g, "");
    if (!s) return NaN;

    const norm = s
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");

    const v = Number(norm);
    return isNaN(v) ? NaN : v;
  }

  // --- Theme ---
  function applyTheme(theme){
    document.body.dataset.theme = theme;
  }

  async function saveThemePreference(theme){
    try {
      localStorage.setItem("theme", theme);

      if (huidigeGebruiker) {
        await firebase.firestore()
          .collection("gebruikers")
          .doc(huidigeGebruiker.uid)
          .set({ theme }, { merge: true });
      }
    } catch {}
  }

  applyTheme(localStorage.getItem("theme") || "dark");

  // --- IP / Audit ---
  async function resolveClientIP(){
    try {
      const cached = localStorage.getItem("clientIP");

      if (cached) {
        clientIP = cached;
        return cached;
      }

      const r = await fetch("https://api.ipify.org?format=json");
      const j = await r.json();

      clientIP = j && j.ip ? j.ip : null;

      if (clientIP) localStorage.setItem("clientIP", clientIP);

      return clientIP;
    } catch {
      return null;
    }
  }

  const ALLOW_CLIENT_DISCORD = false;
  const DISCORD_WEBHOOK_URL = "";

  async function logActie(action, details){
    try {
      const user = firebase.auth().currentUser;
      const email = user?.email || gebruikersData?.email || "-";
      const rol = gebruikersData?.rol || "-";
      const naam = nameFromEmail(email);
      const isAdmin = rol === "financieel";
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
        at: firebase.firestore.FieldValue.serverTimestamp()
      };

      await firebase.firestore()
        .collection("auditLogs")
        .add(entry);

    } catch(err){
      console.warn("audit log faalde", err);
    }
  }

  // --- Permissions ---
  function magZien(groep){
    return gebruikersData &&
      (gebruikersData.rol === "financieel" ||
       gebruikersData.groep === groep);
  }

  function magIndienen(groep){
    return gebruikersData &&
      (gebruikersData.rol === "financieel" ||
       gebruikersData.groep === groep);
  }

  function magBeheren(){
    return gebruikersData &&
      gebruikersData.rol === "financieel";
  }

  // --- Firebase Data ---
  async function haalGebruikersData(uid){
    const d = await firebase.firestore()
      .collection("gebruikers")
      .doc(uid)
      .get();

    return d.exists ? d.data() : null;
  }

  async function haalLedenPerGroep(){
    const d = await firebase.firestore()
      .collection("config")
      .doc("ledenPerGroep")
      .get();

    return d.exists ? d.data() : {};
  }

  // --- UI ---
  function vulGroepSelectie(){
    const select = $("groep");
    if (!select || !gebruikersData) return;

    select.innerHTML = `<option value="">-- Kies een groep --</option>`;

    const toegestane =
      gebruikersData.rol === "financieel"
        ? [...alleGroepen, "Overige"]
        : [gebruikersData.groep];

    toegestane.forEach(g => {
      select.innerHTML += `<option value="${g}">${g}</option>`;
    });
  }

  function toonBeheerPaneel(){
    const paneel = $("beheerPaneel");
    const toggleBtn = $("toggleBeheerPaneel");

    if (!paneel || !toggleBtn) return;

    const show = magBeheren();

    toggleBtn.style.display = show ? "block" : "none";

    if (!show) {
      paneel.style.display = "none";
      return;
    }

    if (paneel.style.display === "") {
      paneel.style.display = "none";
    }

    renderGebruikersLijst();
  }

  function toonFinancieelFeatures(){
    const summaryBtn = $("toggleSummary");
    const show = magBeheren();

    if (summaryBtn) {
      summaryBtn.style.display = show ? "block" : "none";
    }
  }

  function toonFinancieelKolommen(){
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

  // --- Users list ---
  async function renderGebruikersLijst(){
    const tbody = $("gebruikersLijstBody");
    if (!tbody) return;

    if (!magBeheren()) {
      tbody.innerHTML = "";
      return;
    }

    tbody.innerHTML = "";

    const gebruikersSnap = await firebase.firestore()
      .collection("gebruikers")
      .get();

    const allUsers = gebruikersSnap.docs.map(d => ({
      uid: d.id,
      ...d.data()
    }));

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

      tbody.appendChild(tr);
    });
  }

});

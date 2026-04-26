document.addEventListener("DOMContentLoaded", () => {

  // =====================================================
  // CONFIG
  // =====================================================

  const alleGroepen = [
    "Ribbels",
    "Speelclubs",
    "Rakkers",
    "Kwiks",
    "Tippers",
    "Toppers",
    "Aspi",
    "Keti's",
    "4uurtje",
    "Algemeen",
    "LEIDING"
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

  // =====================================================
  // GLOBALS
  // =====================================================

  let huidigeGebruiker = null;
  let gebruikersData = null;
  let ledenPerGroep = {};
  let clientIP = null;

  // =====================================================
  // HELPERS
  // =====================================================

  const $ = (id) => document.getElementById(id);

  const safeOn = (el, ev, fn) => {
    if (el) el.addEventListener(ev, fn);
  };

  function nameFromEmail(email) {
    if (!email) return "-";

    const [left] = email.split("@");

    return left
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function kleurVoorGroep(groep) {
    return groepKleuren[groep] || "transparent";
  }

  function parseEuro(input) {
    if (typeof input === "number") return input;

    const s = String(input || "")
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");

    const v = Number(s);

    return isNaN(v) ? NaN : v;
  }

  function euro(v) {
    return "€" + (Number(v) || 0).toFixed(2);
  }

  // =====================================================
  // THEME
  // =====================================================

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
  }

  async function saveThemePreference(theme) {
    localStorage.setItem("theme", theme);

    if (huidigeGebruiker) {
      await firebase.firestore()
        .collection("gebruikers")
        .doc(huidigeGebruiker.uid)
        .set({ theme }, { merge: true });
    }
  }

  applyTheme(localStorage.getItem("theme") || "dark");

  // =====================================================
  // PERMISSIONS
  // =====================================================

  function magBeheren() {
    return gebruikersData?.rol === "financieel";
  }

  function magIndienen(groep) {
    return magBeheren() || gebruikersData?.groep === groep;
  }

  // =====================================================
  // FIREBASE HELPERS
  // =====================================================

  async function haalGebruikersData(uid) {
    const snap = await firebase.firestore()
      .collection("gebruikers")
      .doc(uid)
      .get();

    return snap.exists ? snap.data() : {};
  }

  async function haalLedenPerGroep() {
    const snap = await firebase.firestore()
      .collection("config")
      .doc("ledenPerGroep")
      .get();

    return snap.exists ? snap.data() : {};
  }

  // =====================================================
  // UI
  // =====================================================

  function vulGroepSelectie() {
    const select = $("groep");
    if (!select || !gebruikersData) return;

    select.innerHTML = `<option value="">-- Kies een groep --</option>`;

    const groepen = magBeheren()
      ? [...alleGroepen, "Overige"]
      : [gebruikersData.groep];

    groepen.forEach(g => {
      select.innerHTML += `<option value="${g}">${g}</option>`;
    });
  }

  function toonLogin() {
    if ($("loginScherm")) $("loginScherm").style.display = "block";
    if ($("appInhoud")) $("appInhoud").style.display = "none";
  }

  function toonApp() {
    if ($("loginScherm")) $("loginScherm").style.display = "none";
    if ($("appInhoud")) $("appInhoud").style.display = "block";
  }

  // =====================================================
  // UITGAVEN TABEL
  // =====================================================

  let unsubUitgaven = null;

  function attachUitgavenListener() {

    const tbody = document.querySelector("#overzicht tbody");
    if (!tbody) return;

    if (unsubUitgaven) unsubUitgaven();

    unsubUitgaven = firebase.firestore()
      .collection("uitgaven")
      .onSnapshot(snapshot => {

        tbody.innerHTML = "";

        const docs = snapshot.docs
          .map(d => d.data())
          .sort((a, b) => (a.nummer || 0) - (b.nummer || 0));

        docs.forEach(u => {

          const tr = document.createElement("tr");
          tr.style.backgroundColor = kleurVoorGroep(u.groep);

          tr.innerHTML = `
            <td>${u.nummer || "-"}</td>
            <td>${u.groep || "-"}</td>
            <td>${euro(u.bedrag)}</td>
            <td>${u.activiteit || "-"}</td>
            <td>${u.datum || "-"}</td>
            <td>${u.betaald ? "✓" : "✗"}</td>
            <td>${u.rekeningNummer || "-"}</td>
          `;

          tbody.appendChild(tr);
        });
      });
  }

  // =====================================================
  // LOGIN
  // =====================================================

  safeOn($("loginKnop"), "click", async () => {

    const email = $("loginEmail")?.value.trim();
    const wachtwoord = $("loginWachtwoord")?.value.trim();

    if (!email || !wachtwoord) {
      $("loginFout").textContent = "Vul alles in.";
      return;
    }

    try {
      await firebase.auth()
        .signInWithEmailAndPassword(email, wachtwoord);

      $("loginFout").textContent = "";

    } catch (err) {
      $("loginFout").textContent = "Login mislukt.";
      console.error(err);
    }
  });

  // =====================================================
  // AUTH STATE
  // =====================================================

  firebase.auth().onAuthStateChanged(async user => {

    if (!user) {
      huidigeGebruiker = null;
      gebruikersData = null;
      toonLogin();
      return;
    }

    huidigeGebruiker = user;
    gebruikersData = await haalGebruikersData(user.uid);

    if (magBeheren()) {
      ledenPerGroep = await haalLedenPerGroep();
    }

    toonApp();

    if ($("gebruikerInfo")) {
      $("gebruikerInfo").textContent =
        `Ingelogd als ${gebruikersData.rol || "-"} (${gebruikersData.groep || "-"})`;
    }

    if ($("navBeheer")) {
      $("navBeheer").style.display =
        magBeheren() ? "inline" : "none";
    }

    if ($("navLogout")) {
      $("navLogout").style.display = "inline";
    }

    if ($("navTheme")) {
      $("navTheme").style.display = "inline";
      $("navTheme").textContent =
        document.body.dataset.theme === "light" ? "🌞" : "🌙";
    }

    vulGroepSelectie();
    attachUitgavenListener();
  });

  // =====================================================
  // LOGOUT
  // =====================================================

  safeOn($("navLogout"), "click", async () => {
    await firebase.auth().signOut();
  });

  // =====================================================
  // THEME TOGGLE
  // =====================================================

  safeOn($("navTheme"), "click", async () => {

    const huidig =
      document.body.dataset.theme || "dark";

    const nieuw =
      huidig === "dark" ? "light" : "dark";

    applyTheme(nieuw);
    await saveThemePreference(nieuw);

    $("navTheme").textContent =
      nieuw === "light" ? "🌞" : "🌙";
  });

});

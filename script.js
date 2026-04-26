document.addEventListener("DOMContentLoaded", () => {
  // --- Config ---
  const alleGroepen = [
    "Ribbels",
    "Speelclubs",
    "Rakkers",
    "Kwiks",
    "Tippers",
    "Toppers",
    "Aspi",
    "Keti",
    "4 uurtje",
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
    Keti: "rgba(56,189,248,0.18)",
    "4 uurtje": "rgba(168,85,247,0.18)",
    Algemeen: "rgba(0,0,0,0.12)",
    LEIDING: "rgba(148,163,184,0.18)",
    Overige: "rgba(120,120,120,0.25)"
  };

  // --- Globals ---
  let huidigeGebruiker = null;
  let gebruikersData = null;
  let ledenPerGroep = {};
  let clientIP = null;

  // --- Helpers ---
  const $ = (id) => document.getElementById(id);
  const safeOn = (el, ev, fn) => {
    if (el) el.addEventListener(ev, fn);
  };

  function kleurVoorGroep(groep) {
    return groepKleuren[groep] || "transparent";
  }

  async function haalLedenPerGroep() {
    const ref = firebase.firestore().collection("config").doc("ledenPerGroep");
    const snap = await ref.get();

    if (!snap.exists) {
      const basis = {};
      alleGroepen.forEach((groep) => {
        basis[groep] = 0;
      });

      await ref.set(basis);
      return basis;
    }

    const data = snap.data();

    // Vul ontbrekende groepen automatisch aan
    let gewijzigd = false;

    alleGroepen.forEach((groep) => {
      if (data[groep] === undefined) {
        data[groep] = 0;
        gewijzigd = true;
      }
    });

    if (gewijzigd) {
      await ref.set(data, { merge: true });
    }

    return data;
  }

  function vulGroepSelectie() {
    const select = $("groep");
    if (!select || !gebruikersData) return;

    select.innerHTML = `<option value="">-- Kies een groep --</option>`;

    const toegestane =
      gebruikersData.rol === "financieel"
        ? [...alleGroepen, "Overige"]
        : [gebruikersData.groep];

    toegestane.forEach((groep) => {
      select.innerHTML += `<option value="${groep}">${groep}</option>`;
    });
  }

  async function syncLedenPerGroepVanGebruikers() {
    const gebruikers = await firebase.firestore().collection("gebruikers").get();

    const telling = {};

    alleGroepen.forEach((groep) => {
      telling[groep] = 0;
    });

    gebruikers.forEach((doc) => {
      const data = doc.data();
      const groep = data.groep;

      if (telling[groep] !== undefined) {
        telling[groep]++;
      }
    });

    await firebase
      .firestore()
      .collection("config")
      .doc("ledenPerGroep")
      .set(telling, { merge: true });

    ledenPerGroep = telling;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;

    huidigeGebruiker = user;

    const gebruikerSnap = await firebase
      .firestore()
      .collection("gebruikers")
      .doc(user.uid)
      .get();

    gebruikersData = gebruikerSnap.data();

    if (!gebruikersData) return;

    if (gebruikersData.rol === "financieel") {
      await syncLedenPerGroepVanGebruikers();
      ledenPerGroep = await haalLedenPerGroep();
    }

    vulGroepSelectie();
  });
});

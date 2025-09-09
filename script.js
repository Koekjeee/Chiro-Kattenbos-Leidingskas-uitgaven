document.addEventListener("DOMContentLoaded", function () {
  const correctWachtwoord = "chiro2025";

  const alleGroepen = [
    "Ribbels", "Speelclubs", "Rakkers", "Kwiks",
    "Tippers", "Toppers", "Aspi", "LEIDING"
  ];

  const groepKleuren = {
    Ribbels: "#cce5ff",
    Speelclubs: "#ffe5cc",
    Rakkers: "#e5ffcc",
    Kwiks: "#ffccf2",
    Tippers: "#d5ccff",
    Toppers: "#ccffd5",
    Aspi: "#ffd5cc",
    LEIDING: "#dddddd"
  };

  // Cloudinary-configuratie
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxizebpwn/upload";
  const CLOUDINARY_PRESET = "chiro_upload_foto's";

  // Functie om een bestand naar Cloudinary te uploaden
  async function uploadBewijs(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    return data.secure_url;
  }

  // Toggle summary paneel
  function setupSummaryToggle() {
    const btn = document.getElementById("toggleSummary");
    const content = document.getElementById("summaryContent");
    btn.addEventListener("click", () => {
      const open = content.style.display === "block";
      content.style.display = open ? "none" : "block";
      btn.textContent = (open ? "▸" : "▾") + " Toon uitgaven per groep";
      if (!open) renderSamenvatting();
    });
  }

  // Render samenvatting per groep
  function renderSamenvatting() {
    const lijst = document.getElementById("groepSamenvatting");
    lijst.innerHTML = "";
    const totals = {};
    alleGroepen.forEach(g => totals[g] = 0);

    firebase.database().ref("uitgaven").once("value", snapshot => {
      const data = snapshot.val() || {};
      Object.values(data).forEach(u => {
        totals[u.groep] += parseFloat(u.bedrag);
      });

      alleGroepen.forEach(groep => {
        const bedrag = totals[groep].toFixed(2);
        const li = document.createElement("li");
        li.style.backgroundColor = groepKleuren[groep] || "#fff";
        li.textContent = groep;
        const span = document.createElement("span");
        span.textContent = `€${bedrag}`;
        li.appendChild(span);
        lijst.appendChild(li);
      });
    });
  }

  // PDF-export
  function setupPdfExport() {
    const btn = document.getElementById("exportPdfBtn");
    btn.addEventListener("click", async () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      const now = new Date();
      const timestamp = now.toLocaleString("nl-NL", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(10);
      doc.text(timestamp, pageWidth - 20, 10, { align: "right" });

      let y = 20;
      doc.setFontSize(16);
      doc.text("Uitgaven activiteitenkas per groep", 20, y);
      y += 10;

      const perGroep = {};
      alleGroepen.forEach(g => perGroep[g] = []);

      const snap = await firebase.database().ref("uitgaven").once("value");
      const data = snap.val() || {};
      Object.values(data).forEach(u => perGroep[u.groep].push(u));

      alleGroepen.forEach(groep => {
        const items = perGroep[groep];
        if (!items.length) return;

        doc.setFontSize(14);
        doc.text(groep, 20, y);
        y += 8;
        doc.setFontSize(11);

        items.forEach(u => {
          const regel = `${u.datum} – €${u.bedrag} – ${u.activiteit} ` +
                        (u.betaald ? "(Betaald)" : "(Niet betaald)");
          doc.text(regel, 25, y);
          y += 6;
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
        });

        y += 8;
      });

      doc.save("uitgaven_activiteitenkas_per_groep.pdf");
    });
  }

  // Login/check wachtwoord
  function controleerWachtwoord() {
    const invoer = document.getElementById("wachtwoord").value;
    const fout = document.getElementById("loginFout");
    if (invoer === correctWachtwoord) {
      document.getElementById("loginScherm").style.display = "none";
      document.getElementById("appInhoud").style.display = "block";
      fout.textContent = "";
      setupSummaryToggle();
      setupPdfExport();
      renderTabel();
    } else {
      fout.textContent = "Wachtwoord is onjuist.";
    }
  }
  document.getElementById("loginKnop").addEventListener("click", controleerWachtwoord);

  // Render overzichtstabel
  function renderTabel(filterGroep = "", filterBetaald = "") {
    const tbody = document.querySelector("#overzicht tbody");
    tbody.innerHTML = "";
    firebase.database().ref("uitgaven").once("value", snap => {
      const data = snap.val() || {};
      Object.values(data)
        .filter(u =>
          (!filterGroep || u.groep === filterGroep) &&
          (filterBetaald === "" || String(u.betaald) === filterBetaald)
        )
        .sort((a, b) => b.nummer - a.nummer)
        .forEach(u => {
          const rij = tbody.insertRow();
          rij.style.backgroundColor = groepKleuren[u.groep] || "#fff";

          rij.insertCell(0).textContent = u.nummer;
          rij.insertCell(1).textContent = u.groep;
          rij.insertCell(2).textContent = `€${u.bedrag}`;
          rij.insertCell(3).textContent = u.activiteit;
          rij.insertCell(4).textContent = u.datum;
          rij.insertCell(5).textContent = u.betaald ? "✅" : "❌";

          // Bewijsstuk
          const bewijsCel = rij.insertCell(6);
          if (u.bewijsUrl) {
            const img = document.createElement("img");
            img.src = u.bewijsUrl;
            img.alt = "Bewijsstuk";
            img.style.maxWidth = "100px";
            bewijsCel.appendChild(img);
          }

          // Verwijder-knop
          const c7 = rij.insertCell(7);
          const btn = document.createElement("button");
          btn.textContent = "Verwijder";
          btn.className = "verwijder";
          btn.onclick = () => {
            firebase.database().ref("uitgaven/" + u.nummer).remove();
            renderTabel(
              document.getElementById("filterGroep").value,
              document.getElementById("filterBetaald").value
            );
          };
          c7.appendChild(btn);

          // Betaald-toggle
          const c8 = rij.insertCell(8);
          c8.className = "betaald-toggle";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = u.betaald;
          cb.onchange = () => {
            firebase.database().ref("uitgaven/" + u.nummer)
              .update({ betaald: cb.checked }, err => {
                if (!err) {
                  renderTabel(
                    document.getElementById("filterGroep").value,
                    document.getElementById("filterBetaald").value
                  );
                }
              });
          };
          c8.appendChild(cb);
        });
    });
  }

  // Nieuw uitgave toevoegen + bewijs upload
  document.getElementById("uitgaveForm").addEventListener("submit", async e => {
    e.preventDefault();
    const g = document.getElementById("groep").value;
    const b = parseFloat(document.getElementById("bedrag").value) || 0;
    const a = document.getElementById("activiteit").value;
    const d = document.getElementById("datum").value;
    const p = document.getElementById("betaald").checked;
    const file = document.getElementById("bewijsUpload").files[0];

    if (!g || isNaN(b) || !a || !d) {
      return alert("Gelieve alle velden correct in te vullen.");
    }

    let bewijsUrl = "";
    if (file) {
      try {
        bewijsUrl = await uploadBewijs(file);
      } catch (err) {
        console.error("Upload mislukt:", err);
        return alert("Upload van bewijsstuk is mislukt.");
      }
    }

    const id = Date.now();
    const obj = {
      nummer: id,
      groep: g,
      bedrag: b.toFixed(2),
      activiteit: a,
      datum: d,
      betaald: p,
      bewijsUrl: bewijsUrl,
      status: "in_behandeling"
    };

    firebase.database().ref("uitgaven/" + id).set(obj, err => {
      if (!err) {
        document.getElementById("uitgaveForm").reset();
        renderTabel(
          document.getElementById("filterGroep").value,
          document.getElementById("filterBetaald").value
        );
      }
    });
  });

  // Filters
  document.getElementById("filterGroep")
    .addEventListener("change", e =>
      renderTabel(e.target.value, document.getElementById("filterBetaald").value)
    );

  document.getElementById("filterBetaald")
    .addEventListener("change", e =>
      renderTabel(document.getElementById("filterGroep").value, e.target.value)
    );
});




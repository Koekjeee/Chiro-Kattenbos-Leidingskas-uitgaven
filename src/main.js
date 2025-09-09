// main.js
import { renderTabel, setupFilters } from "./ui.js";
import { exportPdf }                from "./pdfExport.js";
import { addUitgave }               from "./db.js";

document.addEventListener("DOMContentLoaded", () => {
  const correctWachtwoord = "chiro2025";
  const loginBtn  = document.getElementById("loginKnop");
  const exportBtn = document.getElementById("exportPdfBtn");
  const loginFout = document.getElementById("loginFout");

  loginBtn.addEventListener("click", () => {
    const invoer = document.getElementById("wachtwoord").value;
    if (invoer === correctWachtwoord) {
      document.getElementById("loginScherm").hidden = true;
      document.getElementById("appInhoud").hidden   = false;
      renderTabel();
      setupFilters(renderTabel);
    } else {
      loginFout.textContent = "Wachtwoord is onjuist.";
    }
  });

  exportBtn.addEventListener("click", exportPdf);

  document.getElementById("uitgaveForm").addEventListener("submit", async e => {
    e.preventDefault();
    const g = document.getElementById("groep").value;
    const b = parseFloat(document.getElementById("bedrag").value.replace(",", ".")) || 0;
    const a = document.getElementById("activiteit").value;
    const d = document.getElementById("datum").value;
    const p = document.getElementById("betaald").checked;

    if (!g || isNaN(b) || !a || !d) {
      return alert("Gelieve alle velden correct in te vullen.");
    }

    const id  = Date.now();
    const obj = {
      nummer: id,
      groep: g,
      bedrag: b.toFixed(2),
      activiteit: a,
      datum: d,
      betaald: p
    };

    await addUitgave(id, obj);
    e.target.reset();
    renderTabel();
  });
});

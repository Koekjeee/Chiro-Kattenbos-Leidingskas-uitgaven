// ui.js
import { alleGroepen, groepKleuren } from "./config.js";
import { fetchUitgaven, deleteUitgave, updateUitgave } from "./db.js";

export async function renderTabel(filters = {}) {
  const data = Object.values(await fetchUitgaven());
  const tbody = document.querySelector("#overzicht tbody");
  tbody.innerHTML = "";

  data
    .filter(u =>
      (!filters.groep  || u.groep === filters.groep) &&
      (filters.betaald === "" || String(u.betaald) === filters.betaald)
    )
    .sort((a, b) => b.nummer - a.nummer)
    .forEach(u => {
      const tr = tbody.insertRow();
      tr.style.backgroundColor = groepKleuren[u.groep] || "#fff";

      tr.insertCell(0).textContent = u.nummer;
      tr.insertCell(1).textContent = u.groep;
      tr.insertCell(2).textContent = `€${u.bedrag}`;
      tr.insertCell(3).textContent = u.activiteit;
      tr.insertCell(4).textContent = u.datum;
      tr.insertCell(5).textContent = u.betaald ? "✅" : "❌";

      const c6 = tr.insertCell(6);
      const delBtn = document.createElement("button");
      delBtn.textContent = "Verwijder";
      delBtn.className = "verwijder";
      delBtn.onclick = async () => {
        await deleteUitgave(u.nummer);
        await renderTabel(filters);
      };
      c6.appendChild(delBtn);

      const c7 = tr.insertCell(7);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = u.betaald;
      cb.onchange = async () => {
        await updateUitgave(u.nummer, { betaald: cb.checked });
        await renderTabel(filters);
      };
      c7.appendChild(cb);
    });
}

export function setupFilters(onChange) {
  document.getElementById("filterGroep")
    .addEventListener("change", () => onChange(getFilters()));
  document.getElementById("filterBetaald")
    .addEventListener("change", () => onChange(getFilters()));
}

function getFilters() {
  return {
    groep: document.getElementById("filterGroep").value,
    betaald: document.getElementById("filterBetaald").value
  };
}

// pdfExport.js
import { alleGroepen } from "./config.js";
import { fetchUitgaven } from "./db.js";

export async function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Datum/tijd stempel
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
  Object.values(await fetchUitgaven()).forEach(u => perGroep[u.groep].push(u));

  alleGroepen.forEach(groep => {
    const items = perGroep[groep];
    if (!items.length) return;

    doc.setFontSize(14);
    doc.text(groep, 20, y);
    y += 8;
    doc.setFontSize(11);

    items.forEach(u => {
      const regel = `${u.datum} – €${u.bedrag} – ${u.activiteit} ` +
                    (u.betaald ? "(✅)" : "(❌)");
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
}

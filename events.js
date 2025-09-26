// Shared logic for event pages (kosten/verdiensten) restricted to financieel
(function(){
  const $ = (id)=>document.getElementById(id);
  function applyTheme(theme){ document.body.dataset.theme = theme; }
  applyTheme(localStorage.getItem('theme') || 'dark');

  async function getUserProfile(uid){
    const d = await firebase.firestore().collection('gebruikers').doc(uid).get();
    return d.exists ? d.data() : null;
  }

  function renderTotals(kosten, verdiensten){
    const sum = (arr)=>arr.reduce((acc,x)=>acc + (parseFloat(x.bedrag)||0), 0);
    const tKosten = sum(kosten);
    const tVerdiensten = sum(verdiensten);
    const winst = tVerdiensten - tKosten;
    const elKosten = $('totalKosten');
    const elVerd = $('totalVerdiensten');
    const elWinst = $('totalWinst');
    if (elKosten) elKosten.textContent = `€${tKosten.toFixed(2)}`;
    if (elVerd) elVerd.textContent = `€${tVerdiensten.toFixed(2)}`;
    if (elWinst) elWinst.textContent = `€${winst.toFixed(2)}`;
  }

  function renderRows(tbodyId, items){
    const tbody = $(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    items
      .slice()
      .sort((a,b)=> (a.datum||'').localeCompare(b.datum||''))
      .forEach(it=>{
        const tr = document.createElement('tr');
        const c1 = document.createElement('td'); c1.textContent = it.datum || '-'; tr.appendChild(c1);
        const c2 = document.createElement('td'); c2.textContent = it.omschrijving || '-'; tr.appendChild(c2);
        const c3 = document.createElement('td'); c3.textContent = `€${(parseFloat(it.bedrag)||0).toFixed(2)}`; tr.appendChild(c3);
        tbody.appendChild(tr);
      });
  }

  async function boot(){
    const container = document.querySelector('[data-event-id]');
    if (!container) return;
    const eventId = container.getAttribute('data-event-id'); // e.g. zomerbar
    const eventName = container.getAttribute('data-event-name') || eventId;

    // Navbar basics
    const navTheme = document.getElementById('navTheme');
    if (navTheme) { navTheme.style.display = 'inline'; navTheme.textContent = (document.body.dataset.theme==='light') ? '🌞' : '🌙';
      navTheme.addEventListener('click', ()=>{
        const next = (document.body.dataset.theme==='dark')?'light':'dark';
        document.body.dataset.theme = next; localStorage.setItem('theme', next);
        navTheme.textContent = next==='light'?'🌞':'🌙';
      });
    }

    firebase.auth().onAuthStateChanged(async (user)=>{
      if (!user) { window.location.href = 'index.html'; return; }
      const prof = await getUserProfile(user.uid).catch(()=>null) || {};
      const isFin = prof.rol === 'financieel';
      const nav = document.getElementById('mainNav');
      const navBeheer = document.getElementById('navBeheer');
      if (nav) nav.style.display = 'flex';
      if (navBeheer) navBeheer.style.display = isFin ? 'inline' : 'none';
      const navLogout = document.getElementById('navLogout');
      if (navLogout) navLogout.onclick = ()=> firebase.auth().signOut();

      const kostenForm = $('kostenForm');
      const verdForm = $('verdForm');
      const kostenOnly = document.querySelectorAll('.fin-only');

      // Financieel only gate: if not financieel, show message and block forms/tables
      if (!isFin) {
        if (kostenForm) kostenForm.style.display = 'none';
        if (verdForm) verdForm.style.display = 'none';
        const lock = document.createElement('div');
        lock.className = 'card';
        lock.innerHTML = `<p>Alleen financieel kan dit evenement beheren.</p>`;
        document.querySelector('.container')?.prepend(lock);
        return;
      }

      // Refs
      const base = firebase.firestore().collection('evenementen').doc(eventId);
      const refKosten = base.collection('kosten');
      const refVerdiensten = base.collection('verdiensten');

      // Add handlers
      if (kostenForm) kostenForm.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const datum = $('k_datum')?.value || '';
        const omschrijving = $('k_omschrijving')?.value || '';
        const bedrag = parseFloat($('k_bedrag')?.value || '0');
        if (!datum || !omschrijving || isNaN(bedrag)) return alert('Vul alle velden in.');
        await refKosten.add({ datum, omschrijving, bedrag, at: firebase.firestore.FieldValue.serverTimestamp() });
        kostenForm.reset();
      });
      if (verdForm) verdForm.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const datum = $('v_datum')?.value || '';
        const omschrijving = $('v_omschrijving')?.value || '';
        const bedrag = parseFloat($('v_bedrag')?.value || '0');
        if (!datum || !omschrijving || isNaN(bedrag)) return alert('Vul alle velden in.');
        await refVerdiensten.add({ datum, omschrijving, bedrag, at: firebase.firestore.FieldValue.serverTimestamp() });
        verdForm.reset();
      });

      // Live lists
      let unsubKosten = refKosten.orderBy('datum').onSnapshot(s=>{
        const items = s.docs.map(d=>({ id: d.id, ...d.data() }));
        renderRows('kostenBody', items);
        firebase.firestore().collection('evenementen').doc(eventId).collection('verdiensten').get().then(s2=>{
          const vitems = s2.docs.map(d=>({ id: d.id, ...d.data() }));
          renderTotals(items, vitems);
        });
      });
      let unsubVerd = refVerdiensten.orderBy('datum').onSnapshot(s=>{
        const items = s.docs.map(d=>({ id: d.id, ...d.data() }));
        renderRows('verdienstenBody', items);
        firebase.firestore().collection('evenementen').doc(eventId).collection('kosten').get().then(s2=>{
          const kitems = s2.docs.map(d=>({ id: d.id, ...d.data() }));
          renderTotals(kitems, items);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();


// Logic for kamp hub: financieel-only roles panel + filter event cards for non-financieel with event roles
(function(){
  const $ = (id)=>document.getElementById(id);
  function applyTheme(theme){ document.body.dataset.theme = theme; }
  applyTheme(localStorage.getItem('theme') || 'dark');

  function eventKeyToId(key){
    // Map display keys to eventId used in Firestore
    switch(key){
      case 'zomerbar': return 'zomerbar';
      case 'winterbar': return 'winterbar';
      case 'schoolsInQuiz': return 'schools-in-quiz';
      default: return key;
    }
  }

  function idToEventKeys(){
    return [
      { key: 'zomerbar', id: 'zomerbar' },
      { key: 'winterbar', id: 'winterbar' },
      { key: 'schoolsInQuiz', id: 'schools-in-quiz' },
    ];
  }

  async function loadUsers(){
    const snap = await firebase.firestore().collection('gebruikers').get();
    return snap.docs.map(d=>({ id: d.id, ...d.data() }));
  }

  function renderRolesTable(users){
    const tbody = $('eventRolesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    users.forEach(u=>{
      const tr = document.createElement('tr');
      const ev = u.evenementen || {};
      const emailTd = document.createElement('td'); emailTd.textContent = u.email || '-'; tr.appendChild(emailTd);
      const uidTd = document.createElement('td'); uidTd.textContent = u.id; tr.appendChild(uidTd);
  const zomer = document.createElement('input'); zomer.type='checkbox'; zomer.checked=!!ev['zomerbar'];
  const winter = document.createElement('input'); winter.type='checkbox'; winter.checked=!!ev['winterbar'];
  const quiz = document.createElement('input'); quiz.type='checkbox'; quiz.checked=!!ev['schools-in-quiz'];
      ;['zomerbar','winterbar','schools-in-quiz'].forEach((name, idx)=>{
        const td = document.createElement('td');
        const cb = idx===0?zomer: idx===1?winter: quiz;
        cb.addEventListener('change', async ()=>{
          try {
            // Save the combined state to avoid stale overwrites
            const nieuwe = {
              'zomerbar': !!zomer.checked,
              'winterbar': !!winter.checked,
              'schools-in-quiz': !!quiz.checked,
            };
            await firebase.firestore().collection('gebruikers').doc(u.id).set({ evenementen: nieuwe }, { merge: true });
            // update local ev reference
            Object.assign(ev, nieuwe);
          } catch(err){
            console.warn('Opslaan kamprol mislukt:', err);
            alert('Opslaan mislukt: ' + (err && err.message ? err.message : err));
            cb.checked = !cb.checked; // revert
          }
        });
        td.appendChild(cb);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function filterCardsForAccess(profile){
    const cards = document.querySelectorAll('.card-grid a.card');
    if (!cards || !cards.length) return;
    const isFin = profile && profile.rol === 'financieel';
    const ev = (profile && profile.evenementen) || {};
    if (isFin) return; // financieel sees all
    // otherwise show only those with true flags
    cards.forEach(card=>{
      const href = (card.getAttribute('href')||'').toLowerCase();
      const canZomer = !!ev['zomerbar'];
      const canWinter = !!ev['winterbar'];
      const canQuiz = !!ev['schools-in-quiz'];
      const allowed = (href.includes('zomerbar') && canZomer) || (href.includes('winterbar') && canWinter) || (href.includes("school's in quiz") && canQuiz);
      if (!allowed) card.style.display = 'none';
    });
  }

  async function boot(){
    firebase.auth().onAuthStateChanged(async user =>{
      if (!user) return;
      const profSnap = await firebase.firestore().collection('gebruikers').doc(user.uid).get().catch(()=>null);
      const prof = profSnap && profSnap.exists ? profSnap.data() : {};

      // Hide Kamp nav if no access (redundant for index, but hub might be deep linked)
      const navKamp = document.getElementById('navKamp');
      const isFin = prof.rol === 'financieel';
      const hasEventRoles = !!(prof.evenementen && Object.values(prof.evenementen).some(Boolean));
      if (navKamp) navKamp.style.display = (isFin || hasEventRoles) ? 'inline' : 'none';

      // Filter cards for non-fin users with limited access
      filterCardsForAccess(prof);

      // Roles table only for financieel
      if (isFin){
        try {
          const users = await loadUsers();
          renderRolesTable(users);
        } catch(err){ console.warn('Gebruikers laden mislukt:', err); }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

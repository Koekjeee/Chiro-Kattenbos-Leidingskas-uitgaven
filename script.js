<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chiro Kattenbos – Uitgavenbeheer</title>
  <link rel="stylesheet" href="style.css" />

  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-auth-compat.js"></script>
  <!-- Verwijderd: realtime database compat (oude) -->
  <!-- <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-database-compat.js"></script> -->
  <script src="https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore-compat.js"></script>
  <script>
    const firebaseConfig = {
      apiKey: "AIzaSyA2--5vxLThr-jq5WHHboSakHgbjyBSFm0",
      authDomain: "leidingskas.firebaseapp.com",
      databaseURL: "https://leidingskas-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "leidingskas",
      storageBucket: "leidingskas.appspot.com",
      messagingSenderId: "4767553066",
      appId: "1:4767553066:web:6018139d9ac3e044bc1553",
      measurementId: "G-XRD72XNPCR"
    };
    firebase.initializeApp(firebaseConfig);
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
</head>
<body>
  <div id="loginScherm">
    <h2>Inloggen</h2>
    <input type="email" id="loginEmail" placeholder="E-mailadres" required />
    <input type="password" id="loginWachtwoord" placeholder="Wachtwoord" required />
    <button id="loginKnop">Inloggen</button>
    <p id="loginFout" style="color: red;"></p>
  </div>

  <div id="appInhoud" style="display: none;">
    <h1>Chiro Kattenbos – Uitgavenbeheer</h1>
    <p id="gebruikerInfo"></p>
    <!-- Actieknoppen rechtsboven -->
    <button id="logoutKnop" class="top-icon-btn danger" title="Uitloggen" style="display:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24">
        <path d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-10H5c-1.1 0-2 .9-2 2v6h2V5h14v14H5v-6H3v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
      </svg>
    </button>

    <!-- Gebruikersbeheer paneel -->
  <div id="beheerPaneel" style="display:none;">
        <!-- Hier komt het gebruikersbeheer -->
        <h3>Gebruikersbeheer</h3>
        <form id="rolForm">
          <label for="userUid">Gebruiker UID:</label>
          <input type="text" id="userUid" required />
          <label for="userGroep">Groep:</label>
          <select id="userGroep">
            <option value="Ribbels">Ribbels</option>
            <option value="Speelclubs">Speelclubs</option>
            <option value="Rakkers">Rakkers</option>
            <option value="Kwiks">Kwiks</option>
            <option value="Tippers">Tippers</option>
            <option value="Toppers">Toppers</option>
            <option value="Aspi">Aspi</option>
            <option value="LEIDING">LEIDING</option>
          </select>
          <label for="userRol">Rol:</label>
          <select id="userRol">
            <option value="leiding">Leiding</option>
            <option value="financieel">Financieel</option>
          </select>
          <button type="submit">Opslaan</button>
        </form>
      </div>

    <!-- Gebruikerslijst voor financieel beheer -->
    <div id="gebruikersLijstPaneel" style="display:none; margin-top:20px;">
      <h3>Gebruikers</h3>
      <table id="gebruikersLijstTabel">
        <thead>
          <tr>
            <th>Status</th>
            <th>E-mail</th>
            <th>UID</th>
            <th>Rol</th>
            <th>Groep</th>
          </tr>
        </thead>
        <tbody id="gebruikersLijstBody"></tbody>
      </table>
    </div>


    <form id="uitgaveForm">
      <label for="groep">Groep:</label>
      <select id="groep" required></select>
      <label for="bedrag">Bedrag (€):</label>
      <input type="number" id="bedrag" step="0.01" required />
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
      <label for="filterGroep">Filter op groep:</label>
      <select id="filterGroep">
        <option value="">Alle groepen</option>
        <option value="Ribbels">Ribbels</option>
        <option value="Speelclubs">Speelclubs</option>
        <option value="Rakkers">Rakkers</option>
        <option value="Kwiks">Kwiks</option>
        <option value="Tippers">Tippers</option>
        <option value="Toppers">Toppers</option>
        <option value="Aspi">Aspi</option>
        <option value="LEIDING">LEIDING</option>
      </select>
    </div>
    <div class="filter">
      <label for="filterBetaald">Filter op betaald:</label>
      <select id="filterBetaald">
        <option value="">Alles</option>
        <option value="true">Betaald</option>
        <option value="false">Niet betaald</option>
      </select>
    </div>

    <table id="overzicht">
      <thead>
        <tr>
          <th>#</th>
          <th>Groep</th>
          <th>Bedrag</th>
          <th>Activiteit</th>
          <th>Datum</th>
          <th>Betaald</th>
          <th>Actie</th>
          <th>Terug betaald?</th>
          <th>Rekeningnummer</th>
          <th>Bewijs</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>

    <!-- Overzicht uitgaven knop -->
    <button id="toggleSummary" class="top-icon-btn info" title="Overzicht per groep" style="display:none; right:120px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 8h14v-2H7v2zm0-4h14v-2H7v2zm0-6v2h14V7H7z"/>
      </svg>
    </button>
    <button id="exportPdfBtn" class="top-icon-btn success" title="Exporteer naar PDF" style="display:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24">
        <path d="M5 20h14v-2H5v2zm7-18C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10c0-5.52-4.48-10-10-10zm1 14h-2v-6H8l4-4 4 4h-3v6z"/>
      </svg>
    </button>
    <div id="summaryContent" style="display:none;">
      <form id="ledenSamenvattingForm">
        <table id="groepSamenvattingTabel">
          <thead>
            <tr>
              <th>Groep</th>
              <th>Leden</th>
              <th>Totaal (€)</th>
              <th>€ per kind</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <button type="submit" id="ledenOpslaanBtn" style="display:none;">Leden opslaan</button>
      </form>
    </div>

    <!-- Voeg deze knop toe boven je #beheerPaneel in index.html -->
    <button id="toggleBeheerPaneel" class="top-icon-btn info" style="display:none; top:70px;" title="Gebruikersbeheer">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    </button>
  </div>

  <script src="script.js"></script>
  <!-- Inline script verwijderd; logica zit in script.js -->
</body>
</html>




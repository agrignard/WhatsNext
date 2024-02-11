<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Menus déroulants</title>
</head>
<body>
  <select id="menuA"></select>
  <select id="menuB"></select>

  <script type="module">
    import { ipcRenderer } from 'electron';

    // Récupérer les listes A et B du processus principal
    ipcRenderer.send('get-listes');
    ipcRenderer.on('listes', (event, { listeA, listeB }) => {
      const menuA = document.getElementById('menuA');
      const menuB = document.getElementById('menuB');

      listeA.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.textContent = option;
        menuA.appendChild(optionElement);
      });

      listeB.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.textContent = option;
        menuB.appendChild(optionElement);
      });
    });
  </script>
</body>
</html>

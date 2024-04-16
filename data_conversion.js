const fs = require('fs');

// Lire le fichier CSV
fs.readFile('www/lyon_place.csv', 'utf8', (err, data) => {
  if (err) {
    console.error('Erreur de lecture du fichier :', err);
    return;
  }

  // Diviser les lignes du fichier
  const lines = data.split('\n');

  // Tableau pour stocker les données converties au format JSON
  const jsonData = [];

  // Parcourir chaque ligne
  lines.forEach(line => {
    // Diviser la ligne en utilisant la virgule comme séparateur
    const [name, latitude, longitude, website, genre] = line.split(',');

    // Créer un objet JSON à partir des données
    const jsonDataObj = {
      name: name.trim(),
      city: 'Lyon', // Vous avez indiqué que les données concernent Lyon
      country: 'France',
      url: website, // Vous avez indiqué que les données concernent Lyon, en France
      latitude:latitude,
      longitude:longitude,
      ID: name+`|Lyon|France`, // ID selon le format que vous avez spécifié
      aliases: [name.trim()] // Vous pouvez ajouter d'autres alias si nécessaire
      
    };

    // Ajouter l'objet JSON au tableau jsonData
    jsonData.push(jsonDataObj);
  });

  // Convertir le tableau jsonData en format JSON
  const jsonString = JSON.stringify(jsonData, null, 2);

  // Écrire les données converties dans un fichier
  fs.writeFile('output.json', jsonString, 'utf8', (err) => {
    if (err) {
      console.error('Erreur d\'écriture du fichier :', err);
      return;
    }
    console.log('Conversion terminée. Les données ont été écrites dans le fichier output.json.');
  });
});
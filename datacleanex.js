

const fsCallback = require('fs');
const fs = require('fs').promises;
const path = require('path');

const placeToCoord = new Map();

//const city = process.argv[2] || "france";

//const city="saint-etienne";
const country = "france";
console.log("***************DATACLEANEX-City: " + country + " **************");
//convertPlaceCSVtoGeoJson();
convertPlaceCSVtoGeoJsonFromFolder('www/data/places');
convertEventCSVtoGeoJson('www/data/events');

const initPlaceInformationMapping = {
  'art': 'art-gallery',
  'institut':'museum',
  'photo': 'attraction',
  'theatre': 'theatre',
  'music': 'music',
  'undefined' : 'dot-11'
};

const verbose = process.argv.includes('--verbose');
if (verbose){
  console.log('*** v=verbose mode ***');
}

async function convertPlaceCSVtoGeoJsonFromFolder(folderPath) {
  console.log("*****Converting Place CSV to GeoJson (place,lat,long,url)*****");
  var nbPlaces;
  // GeoJSON global
  const globalGeoJSON = {
    type: "FeatureCollection",
    features: []
  };

  try {
    // Lister tous les fichiers CSV dans le dossier
    const sourcefilesPath =folderPath+"/sources";
    const generatedfilesPath =folderPath+"/generated";
    const files = await fs.readdir(sourcefilesPath);
    const csvFiles = files.filter(f => f.endsWith('_place.csv'));

    for (const file of csvFiles) {
      const city = file.replace('_place.csv', ''); // extraire le nom de la ville
      const templateGeoJSONPlace = generatedfilesPath+'/place_minimal.geojson';
      const data = await fs.readFile(templateGeoJSONPlace, 'utf8');
      const cityGeoJSON = JSON.parse(data);

      const csvFilePath = path.join(sourcefilesPath, file);
      const csvData = await fs.readFile(csvFilePath, 'utf8');
      const table = csvData.split('\n').slice(1);

      table.forEach(row => {
        if (!row.trim()) return; // ignorer les lignes vides
        const columns = row.split(',');
        const place = columns[0];
        const latitude = parseFloat(columns[1]);
        const longitude = parseFloat(columns[2]);
        const url = columns[3];

        let style = columns[4];
        if (initPlaceInformationMapping[columns[4]] != null) {
          style = initPlaceInformationMapping[columns[4]];
        } else {
          style = initPlaceInformationMapping['undefined'];
        }

        const newFeature = {
          type: 'Feature',
          id: place,
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
          properties: { title: place, icon: style, description: url, city: city },
        };

        cityGeoJSON.features.push(newFeature);
        globalGeoJSON.features.push(newFeature);
      });

      const modifiedCityGeoJSONPath = path.join(generatedfilesPath, `${city}_place.geojson`);
      await fs.writeFile(modifiedCityGeoJSONPath, JSON.stringify(cityGeoJSON, null, 2), 'utf8');
      if (verbose){
        console.log(`${city}: ${table.length} places saved to ${modifiedCityGeoJSONPath}`);
      }
      
    }

    // Sauvegarde du GeoJSON global
    const globalGeoJSONPath = path.join(generatedfilesPath, `${country}_place.geojson`);
    await fs.writeFile(globalGeoJSONPath, JSON.stringify(globalGeoJSON, null, 2), 'utf8');
    console.log(globalGeoJSON.features.length + ` places in ${globalGeoJSONPath}`);

  } catch (err) {
    console.error("Error processing folder:", err);
  }
}

 
async function convertEventCSVtoGeoJson(folderPath) {
  try {
    console.log("*****Converting Event CSV*****");

    const existingGeoJSONPath = folderPath+'/generated/event_minimal.geojson';
    const data = await fs.readFile(existingGeoJSONPath, 'utf8');
    // Parse the existing GeoJSON data
    const existingGeoJSON = JSON.parse(data);

    // Fonction utilitaire pour lire et pousser les données CSV
    async function processCSV(filePath) {
      try {
        const csvData = await fs.readFile(filePath, 'utf8');
        const table = csvData.split('\n');
        pushTableInExistingGeoJsonFile(table, existingGeoJSON);
      } catch (err) {
        console.warn(`CSV file ${filePath} not found or error reading it.`);
      }
    }

    // Lire et traiter le CSV principal
    let csvFilePath = `scraping/generated/scrapexResult.csv`;
    await processCSV(csvFilePath);

    // Lire et traiter le CSV handMade si présent
    csvFilePath = `scraping/handMade/scrapexResult_handMade.csv`;
    if (fsCallback.existsSync(csvFilePath)) {
      await processCSV(csvFilePath);
    }

    // Définir le chemin pour le GeoJSON modifié
    const modifiedGeoJSONPath = `www/data/events/generated/${country}_event.geojson`;
    await fs.writeFile(modifiedGeoJSONPath, JSON.stringify(existingGeoJSON), 'utf8');

    console.log(`${existingGeoJSON.features.length} events in ${modifiedGeoJSONPath}`);

  } catch (err) {
    console.error('Error in convertEventCSVtoGeoJson:', err);
  }
}


function pushTableInExistingGeoJsonFile(_table,_existingGeoJSON){
    _table.forEach(row => {
      const columns = row.split(';'); 
      const place=columns[0];
      const title=columns[1];
      const time=parseInt(columns[2]);
      const size=parseInt(columns[3]);
      const style=columns[4];
      const detailedStyle=columns[5];
      const url=columns[6];
      const time_string=columns[7];
      if(style!="Theatre"){
        const newFeature = {
          type: 'Feature',
          id:parseInt(time*Math.random()),
          geometry:{
              type: 'Points',
              //coordinates: placeToCoord.get(place),
          },
          properties:{
              "title": title,
              "size": size,
              "icon": "marker-15",
              "place": place,
              "style": style,
              "detailedStyle": detailedStyle,
              "time":time,
              "time_string":time_string,
              "description":url
          },
          };
          _existingGeoJSON.features.push(newFeature);
      } 
  })
}
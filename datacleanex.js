const fs = require('fs');

const placeToCoord = new Map();

const city="lyon";
console.log("***************DATACLEANEX-City: " + city + " **************");
convertPlaceCSVtoGeoJson();
convertEventCSVtoGeoJson();

const initPlaceInformationMapping = {
  'art': 'art-gallery',
  'institut':'museum',
  'photo': 'attraction',
  'theatre': 'theatre',
  'music': 'music',
  'undefined' : 'dot-11'
};

async function convertPlaceCSVtoGeoJson(){
  console.log("*****Converting Place CSV to GeoJson (place,lat,long,url)*****");
  // Getting the original template source file for event
  const templateGeoJSONPplace = 'www/template/place_minimal.geojson';
  // Read the existing GeoJSON file
  fs.readFile(templateGeoJSONPplace, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading existing GeoJSON:', err);
      return;
    }
    const existingGeoJSON = JSON.parse(data);
    const csvFilePath = 'www/' + city + '_place.csv';
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const table = csvData.split('\n').slice(1);
    table.forEach(row => {
      const columns = row.split(','); 
      const place=columns[0];
      const latitude=parseFloat(columns[1]);
      const longitude=parseFloat(columns[2]);
      const url=columns[3];
      var style = columns[4];    
      if(initPlaceInformationMapping[columns[4]]!=null){
        style=initPlaceInformationMapping[columns[4]];
      }else{
        style= initPlaceInformationMapping['undefined'];
      }    
      //console.log("Place: "+place+";"+latitude+";"+longitude+";"+url);

    const newFeature = {
      type: 'Feature',
      id:place,
      geometry:{
          type: 'Point',
          coordinates: [longitude,latitude],
      },
      properties:{
          "title": place,
          "icon": style,
          "description":url
      },
      };
      existingGeoJSON.features.push(newFeature);
  });
    // Define the path to the modified GeoJSON file
    const modifiedGeoJSONPath = 'www/' + city + '_place.geojson';
    // Save the modified GeoJSON to a new file
    fs.writeFile(modifiedGeoJSONPath, JSON.stringify(existingGeoJSON), 'utf8', (err) => {
      if (err) {
        console.error('Error saving modified GeoJSON:', err);
      } else {
        console.log('Modified GeoJSON saved to', modifiedGeoJSONPath);
      }
    });
    console.log("in convertPlaceCSVtoGeoJson(): "+ table.length + " places created")
  });
}
 
async function convertEventCSVtoGeoJson(){
  // Getting the original source file for event
  console.log("*****Converting Event CSV*****");
  const existingGeoJSONPath = 'www/template/event_minimal.geojson';
  // Read the existing GeoJSON file
  fs.readFile(existingGeoJSONPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading existing GeoJSON:', err);
      return;
    }

    // Parse the existing GeoJSON data
    const existingGeoJSON = JSON.parse(data);

    const csvFilePath = 'scraping/generated/scrapexResult_'+city+'.csv';
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const table = csvData.split('\n');

    table.forEach(row => {
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
        existingGeoJSON.features.push(newFeature);
      } 
  })



    // Define the path to the modified GeoJSON file
    const modifiedGeoJSONPath = 'www/' + city + '_event.geojson';
    // Save the modified GeoJSON to a new file
    fs.writeFile(modifiedGeoJSONPath, JSON.stringify(existingGeoJSON), 'utf8', (err) => {
      if (err) {
        console.error('Error saving modified GeoJSON:', err);
      } else {
        console.log('Modified GeoJSON saved to', modifiedGeoJSONPath);
      }
    });
    console.log("in convertEventCSVtoGeoJson(): " + existingGeoJSON.features.length + " events");
  });
}

//printEachEvent();
//Getting the coordinate of each place 
function printEachEvent(){
  const placeGeoJSONPath = 'www/' + city + '_event.geojson';
  fs.readFile(placeGeoJSONPath, 'utf8', (err, data) => {
      if (err) {
          console.error('Error reading existing GeoJSON:', err);
          return;
      }
      const placeGeoJSONPath = JSON.parse(data);
      for (var i = 0; i < placeGeoJSONPath.features.length; i++) {
        console.log(placeGeoJSONPath.features[i].properties.place + "," + placeGeoJSONPath.features[i].properties.title + "," + placeGeoJSONPath.features[i].properties.time + "," + placeGeoJSONPath.features[i].properties.size + "," + placeGeoJSONPath.features[i].properties.style + "," + placeGeoJSONPath.features[i].properties.description); 
      }
  });
}

function convertGeoJsontoCSV(){
  console.log("converting geojson place to csv");
  const placeGeoJSONPath = 'www/' + city + '_place.geojson';
  var placeString="place,latitude,longitude,url\n";
  fs.readFile(placeGeoJSONPath, 'utf8', (err, data) => {
      if (err) {
          console.error('Error reading existing GeoJSON:', err);
          return;
      }
      const placeGeoJSONPath = JSON.parse(data);
      for (var i = 0; i < placeGeoJSONPath.features.length; i++) {
        placeString += placeGeoJSONPath.features[i].properties.title + "," + parseFloat(placeGeoJSONPath.features[i].geometry.coordinates[1])+ "," + parseFloat(placeGeoJSONPath.features[i].geometry.coordinates[0]) + ","  + placeGeoJSONPath.features[i].properties.description + "\n"; 
      }
      // Define the path to the modified GeoJSON file
      const modifiedPlacePath = 'www/' + city + '_place.csv';
      console.log(placeString);
      // Save the modified GeoJSON to a new file
      fs.writeFile(modifiedPlacePath, placeString, 'utf8', (err) => {
        if (err) {
          console.error('Error saving modified GeoJSON:', err);
        } else {
          console.log('Modified CSV saved to', modifiedPlacePath);
        }
      });
  });
  
}

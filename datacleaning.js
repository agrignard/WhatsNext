const fs = require('fs');


//Getting the coordinate of each place 
const placeToCoord = new Map();
const placeGeoJSONPath = 'www/lyon_place.geojson';
fs.readFile(placeGeoJSONPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading existing GeoJSON:', err);
        return;
    }
    const placeGeoJSONPath = JSON.parse(data);
    for (var i = 0; i < placeGeoJSONPath.features.length; i++) {
        placeToCoord.set(placeGeoJSONPath.features[i].properties.title,placeGeoJSONPath.features[i].geometry.coordinates);
    }
});

//printEachEvent();
//Getting the coordinate of each place 
function printEachEvent(){
  const placeGeoJSONPath = 'www/lyon_event.geojson';
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
 
   


// Getting the original source file for event
const existingGeoJSONPath = 'www/lyon_event_minimal.geojson';
// Read the existing GeoJSON file
fs.readFile(existingGeoJSONPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading existing GeoJSON:', err);
    return;
  }

  // Parse the existing GeoJSON data
  const existingGeoJSON = JSON.parse(data);

  const csvFilePath = 'www/lyon_event.csv';
  const csvData = fs.readFileSync(csvFilePath, 'utf8');
  const table = csvData.split('\n').slice(1);

  table.forEach(row => {
    const columns = row.split(','); 
    const place=columns[0];
    const title=columns[1];
    const time=parseInt(columns[2]);
    const size=parseInt(columns[3]);
    const style=columns[4];
    const url=columns[5];
    console.log(place,title,time,size,style,url);

   const newFeature = {
    type: 'Feature',
    id:parseInt(time*Math.random()),
    geometry:{
        type: 'Point',
        coordinates: placeToCoord.get(place),
    },
    properties:{
        "title": title,
        "size": size,
        "icon": "marker-15",
        "place": place,
        "style": style,
        "time":time,
        "description":"<a href='"+url+"' target='blank'title='Opens in a new window'>Prog</a>"
    },
    };
    existingGeoJSON.features.push(newFeature);
})



  // Define the path to the modified GeoJSON file
  const modifiedGeoJSONPath = 'www/lyon_event.geojson';
  // Save the modified GeoJSON to a new file
  fs.writeFile(modifiedGeoJSONPath, JSON.stringify(existingGeoJSON), 'utf8', (err) => {
    if (err) {
      console.error('Error saving modified GeoJSON:', err);
    } else {
      console.log('Modified GeoJSON saved to', modifiedGeoJSONPath);
    }
  });
});
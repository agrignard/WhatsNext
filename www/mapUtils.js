import * as dataUtils from './dataUtils.js';
var flytoOnClick=false;
const darkMode=false;
var darkstyle= 'mapbox://styles/mapbox/light-v11';
if (darkMode){
    darkstyle= 'mapbox://styles/mapbox/dark-v11';
}
var hoveredStateId =  null; 
export function initializeMap() {
    return new mapboxgl.Map({
        container: 'map',
        style: darkstyle,
        projection: 'globe',
        ...start
    });
}

//////// LAYER ADDITION /////////////////
export function addPlaces(map,placesData){
    map.addSource('places', {
    type: 'geojson',
    data: placesData
    });
    map.addLayer({
    'id': 'places-circles',
    'type': 'circle',
    'source': 'places',
    'paint': {
    'circle-radius': 4,
    'circle-stroke-width': 2,
    'circle-color': !darkMode ? 'black' : 'rgba(125,125,125,0.5)',
    'circle-stroke-color': !darkMode ? 'white' : 'black'
    }
    });
    map.addLayer({
    'id': 'place-labels',
    'type': 'symbol',
    'source': 'places',
    'layout': {
        "text-field": ['format',['get', 'title'],{ 'font-scale': 0.5 }],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-offset": [1.0, 1.0],
        "text-anchor": "top"
    },
    'paint': {
    'text-color': !darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(125,125,125,0.5)' 
    }
    });

    // When a click event occurs on a feature in the places layer, open a popup at the
// location of the feature, with description HTML from its properties.
    map.on('click', 'places-circles', (e) => {
        // Copy coordinates array.
        const coordinates = e.features[0].geometry.coordinates.slice();
        const description = e.features[0].properties.description;
        const place = e.features[0].properties.title;
        //console.log("url de " + place + ": " + description)    ;
        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }
        //CANNOT ADD THE POP UP AS BOTH ARE DISPLAYED (PLACE AND EVENT)
        if (!dataUtils.todaysEvent.has(place)) {
            const html= "<a href='"+ description +  "' target='blank'title='Opens in a new window'>"+place+"</a>";
            new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(map);
        }  
    });

// Change the cursor to a pointer when the mouse is over the places layer.
    map.on('mouseenter', 'places-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
        });
        
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'places-circles', () => {
        map.getCanvas().style.cursor = '';
    });
}

export function addEvents(map,eventsData){
    map.addSource('events', {
        'type': 'geojson',
        data: eventsData
    });
        
    map.addLayer({
        'id': 'event-circles',
        'type': 'circle',
        'source': 'events',
        'paint': {
        'circle-color': generateColorExpressions(Object.keys(categoryColors)),
        'circle-stroke-color': generateColorExpressions(Object.keys(categoryColors)),
            'circle-stroke-width': ["case",["boolean", ["feature-state", "hover"], false],10.0,2.5],
            'circle-stroke-opacity':[
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            0.5
            ],
            'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'size'],
            100,
            10,
            5000,
            10
            ]
        }
    }); 
    map.addLayer({
        'id': 'event-labels',
        'type': 'symbol',
        'source': 'events',
        'layout': {
            "text-field": ['format',['get', 'title'],{ 'font-scale': 0.9 }],
            "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
            "text-offset": [1.0, 1.0],
            "text-anchor": "top"
        },
        'paint': {
        'text-color': 'rgba(0,0,0,0.5)'
        }
    });
// When a click event occurs on a feature in the places layer, open a popup at the
// location of the feature, with description HTML from its properties.
map.on('click', 'event-circles', (e) => {

    const target = e.features[0].geometry.coordinates;
    end.center = target;
    
    if(flytoOnClick){
        map.flyTo({
        ...mapUtils.end, // Fly to the selected target
        duration: 3000, // Animate over 12 seconds
        essential: true // This animation is considered essential with
        //respect to prefers-reduced-motion
        });  
    }
     
    // Copy coordinates array.
    const coordinates = e.features[0].geometry.coordinates.slice();
    const description = e.features[0].properties.description;
    var title = e.features[0].properties.title;
    var place = e.features[0].properties.place;
    var style = e.features[0].properties.style;
    var detailedStyle = e.features[0].properties.detailedStyle;
    var time = e.features[0].properties.time;
     
    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    var eventURLString="";
    if(description.length == 1){
      eventURLString= "";
    }else{
      eventURLString= "<a href="+description+" target=   'blank'title='Opens in a new window'>"+title+"</a>";
    }
    
    var placeURLString="";
    if(description.length == 1){
        placeURLString= "";
    }else{
      
        placeURLString= "<a href="+dataUtils.placeToUrl.get(place)+" target=   'blank'title='Opens in a new window'>"+place+"</a>";
    }
    
    console.log(description);
    //console.log("urlString"+urlString);
    new mapboxgl.Popup()
    .setLngLat(coordinates)
    .setHTML("<h4>" + eventURLString + "</h4><b>Place:</b> "+place+"<br><b>Time:</b> "+new Date(time)+"<br><b>Style:</b> "+style + " (" + detailedStyle +")")
    .addTo(map);
    });

    // When the user moves their mouse over the state-fill layer, we'll update the
// feature state for the feature under the mouse.
    map.on("mousemove", "event-circles", function(e) {  
        if (e.features.length > 0) {  
        if (hoveredStateId) {
        map.setFeatureState({source: 'events', id: hoveredStateId}, { hover: false});
        }
        hoveredStateId = e.features[0].id;
        map.setFeatureState({source: 'events', id: hoveredStateId}, { hover: true});
        }
    });
     
    // When the mouse leaves the state-fill layer, update the feature state of the
    // previously hovered feature.
    map.on("mouseleave", "event-circles", function() {
        if (hoveredStateId) {
        map.setFeatureState({source: 'events', id: hoveredStateId}, { hover: false});
        }
        hoveredStateId =  null;
    });


}
////////////////////////////////////////////////////

////////////LAYER INTERACTION//////////////////////


//////////////////////////////////////////////////



////// POINT DEFINITION /////
export const start = {
    center: [4.85, 45.7465],
    zoom: 1.5,
    pitch: 45,
    bearing: 45
};

export const lyon_start = {
    center: [4.85, 45.7465],
    zoom: 11.5,
    bearing: 0,
    pitch: 0
};

export const end = {
    center: [8.11862, 46.58842],
    zoom: 16,
    bearing: 270,
    pitch: 75
};


/////////////// COLOR PALETTE ///////////
var transparency = 0.9;
var transparencyBig = 0.95;


// Your dynamic map of categories and their colors
export const categoryColors = {
    'Rock': '23, 128, 251',
    'Electro': '40, 124, 18',
    'Jazz': '255, 255, 0',
    'Rap': '165, 2, 33',
    'World': '224, 147, 40',
    'Jam': '238, 130, 238',
    'Classique': '127, 0, 255',
    'Chanson': '0, 255, 255',
    'Live': '144, 238, 214'
  };

export function generateColorExpressions(categories) {
const colorExpressions = [];

categories.forEach(category => {
    const baseColor = categoryColors[category];

    if (baseColor) {
    colorExpressions.push(
        category,
        [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        `rgba(${baseColor}, ${transparencyBig})`,
        `rgba(${baseColor}, ${transparency})`
        ]
    );
    }
});

// Add a default color at the end if needed
colorExpressions.push('#999');

// Return the complete color expression
return ['match', ['get', 'style'], ...colorExpressions];
}

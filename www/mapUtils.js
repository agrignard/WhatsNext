import * as dataUtils from './dataUtils.js';


export const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export var showPlacesAsCircle=true;

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
    if(showPlacesAsCircle){
        map.addLayer({
            'id': 'places-circles_v',
            'type': 'circle',
            'source': 'places',
            'paint': {
                'circle-radius': 3,
                'circle-stroke-width': 1,
                'circle-color': !darkMode ? 'black' : 'rgba(125,125,125,0.5)',
                'circle-stroke-color': !darkMode ? 'white' : 'black'
            }
        });
    }else{
        map.addLayer({
            'id': 'places-circles_v',
            'type': 'symbol',
            'source': 'places',
            'layout': {
                // list of icon https://labs.mapbox.com/maki-icons/ or in MapBox Studio
                'icon-image': ['get', 'icon'],
                'icon-allow-overlap': true
            }
        });

    }

    map.addLayer({
        'id': 'places-circles',
        'type': 'circle',
        'source': 'places',
        'paint': {
          'circle-radius': 10, // Larger radius for hit detection
          'circle-opacity': 0, // Hide the circles while keeping their size for hit detection
          'circle-stroke-width': 1,
          'circle-color': 'transparent', // Transparent fill color
          'circle-stroke-color': 'transparent' // Transparent stroke color
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
            if(description.length>0){
                const html= "<a href='"+ description +  "' target='blank'title='Opens in a new window'>"+place+"</a>";
                new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(html)
                .addTo(map);
            } 
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
    var time_string = e.features[0].properties.time_string;
     
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
        var popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML("<h4>" + eventURLString + "</h4><b>Place:</b> "+place+"<br><b>Time:</b> "+time_string+"<br><b>Style:</b> "+style + " (" + detailedStyle +")")
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


//////////////ADD WIDGET //////////////////////////

export function addGeolocationWidget(map){
     // Add geolocate control to the map.
     map.addControl(
        new mapboxgl.GeolocateControl({
            positionOptions: {
            enableHighAccuracy: true
            },
            // When active the map will receive updates to the device's location as it changes.
            trackUserLocation: true,
            // Draw an arrow next to the location dot to indicate which direction the device is heading.
            showUserHeading: true
        })
    );
}

export function addShareWidget(map){
    class ShareControl {
        onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-share';
        // Add Font Awesome share icon
        this.container.innerHTML = '<i class="fas fa-share"></i>';
        // Add event listener for copying the current URL
        this.container.addEventListener('click', () => {
            const currentURL = window.location.origin+"/?day="+parseInt(document.getElementById('slider').value,10);
            navigator.clipboard.writeText(currentURL)
            .then(() => {
                alert('URL copied to clipboard!' + currentURL);
            })
            .catch((error) => {
                console.error('Unable to copy URL', error);
            });
        });
        return this.container;
        }
        onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
        }
    }
    map.addControl(new ShareControl(), 'top-left');
}


//////////////////////////////////////////////////

////////////LAYER INTERACTION//////////////////////
export function filterByTime(map,value) {  
    if(!document.getElementById("showAll").checked){
        var filters = [
        "all",     
        [">=", ['get', 'time'], value],
        ["<=", ['get', 'time'], value+86400000]
        ];
        map.setFilter('event-circles', filters);
        map.setFilter('event-labels', filters);
        document.getElementById('dateSlider').textContent = days[new Date(value).getDay()] + " " + new Date(value).getDate()+ "/" + parseInt(new Date(value).getMonth()+1) + "/" + new Date(value).getFullYear();  
    }else{
        var filters = [
        "all",     
        [">=", ['get', 'time'], value]
        ];
        map.setFilter('event-circles', filters);
        map.setFilter('event-labels', filters);
        document.getElementById('dateSlider').textContent = new Date(value).getDate()+ "/" + parseInt(new Date(value).getMonth()+1)  + "/" + new Date(value).getFullYear()+ "++";
    }    
}

export function filterByStyle(map,style,time) {  
    var filters ="";
    if(style=="all"){
        filters = [
        "all",     
        [">=", ['get', 'time'], time],
        ["<=", ['get', 'time'], time+86400000]
        ];
    }else{
        if(!document.getElementById("showAll").checked){
            filters = [
                "all",    
                ["==", ['get', 'style'], style],
                [">=", ['get', 'time'], time],
                ["<=", ['get', 'time'], time+86400000]
            ];
        }else{
            filters = [
                "all",    
                ["==", ['get', 'style'], style],
                [">=", ['get', 'time'], time]
            ];
        }
        
    }
    map.setFilter('event-circles', filters);
    map.setFilter('event-labels', filters);
}

export function getActiveCircles(circles) {
    return circles.filter(circle => circle.active);
}

export function filterByStyles(map,circles,time){   
    function generateFilterConditions(activeCircles,time) {
        return activeCircles.map(circle => {
            // Check if 'style' and 'time' properties exist
            const styleCondition = ["==", ["get", "style"], circle.value];
            const timeCondition1 = [">=", ["get", "time"], time];
            const timeCondition2 = ["<=", ["get", "time"], time+86400000];
            // Filter out null conditions
            const conditions = [styleCondition, timeCondition1,timeCondition2].filter(condition => condition !== null);
            // Use 'all' if there are conditions, otherwise return null
            return conditions.length > 0 ? ["all", ...conditions] : null;
          });
    }
    // Example usage:
    const activeCircles = getActiveCircles(circles);
    const filterConditions = generateFilterConditions(activeCircles,time);

    // Now you can combine these conditions using 'any' or 'all' as needed
    const combinedFilter = ["any", ...filterConditions];
    map.setFilter('event-circles', combinedFilter);
    map.setFilter('event-labels', combinedFilter);
}

//////////////////////////////////////////////////



////// POINT DEFINITION /////
export const start = {
    center: [4.85, 45.7465],
    zoom: 1.5,
    pitch: 45,
    bearing: 45
};

export const hanoi_start = {
    center: [105.85238037071497,21.030703836681795],
    zoom: 11.5,
    bearing: 0,
    pitch: 0
};

export const lyon_start = {
    center: [4.85, 45.7465],
    zoom: 11.5,
    bearing: 0,
    pitch: 0
};


export const startLocations = new Map([
    [
      'hanoi',
      {
        center: [105.85238037071497, 21.030703836681795],
        zoom: 11.5,
        bearing: 0,
        pitch: 0
      }
    ],
    [
      'lyon',
      {
        center: [4.85, 45.7465],
        zoom: 11.5,
        bearing: 0,
        pitch: 0
      }
    ]
]);
  

export const end = {
    center: [8.11862, 46.58842],
    zoom: 16,
    bearing: 270,
    pitch: 75
};


/////////////// COLOR PALETTE ///////////
var transparency = 0.9;
var transparencyBig = 0.95;

export var categoryColors = {};

export const setCategoryColors = (city) => {
    if (city === "lyon") {
      categoryColors = { ...categoryColorsLyon };
    } else if (city === "hanoi") {
      categoryColors = { ...categoryColorsHanoi };
    }
  };

// Your dynamic map of categories and their colors
export const categoryColorsLyon = {
    'Rock': '23, 128, 251',
    'Electro': '40, 124, 18',
    'Jazz': '255, 255, 0',
    'Rap': '255, 0, 0',
    'Chanson': '0, 255, 255',
    'Live': '144, 144, 144',
    //'World': '224, 147, 40',
   // 'Jam': '238, 130, 238',
    'Classique': '127, 0, 255',
    
    //'Theatre': '165,42,42'
};

export const categoryColorsHanoi = {
    'Art': '23, 128, 251',
    'Photo': '40, 124, 18',
    'Conference': '255, 255, 0',
    'Musique': '255, 0, 0',
    'Expo': '224, 147, 40',
    'Theatre': '165,42,42'
};

export const getCategoryColorRGBA = (category) => {
    const colorString = categoryColors[category];
    if (colorString) {
        return `rgba(${colorString}, 0.5)`;
    } else {
        return 'rgba(0, 0, 0, 0.5)';
    }
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

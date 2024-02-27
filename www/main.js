import * as mapUtils from './mapUtils.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiYWdyaWduYXJkIiwiYSI6ImNqdWZ6ZjJ5MDBoenczeXBkYWU3bTk5ajYifQ.SXiCzAGs4wbMlw3RHRvxhw';

var devMode = true;
var flytoOnClick=false;
var showAllValueDiv = devMode ? true : false;
var showAllValue = false;
const showPlacesNotHandled= false;
updateCircleLegend();

const canvasShowAll = document.getElementById('showAll');
if (showAllValueDiv){
    canvasShowAll.style.display = 'block';
    canvasShowAll.checked = false;
}else{
    canvasShowAll.style.display = 'none';
}

const map = mapUtils.initializeMap();


const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const placeToCoord = new Map();
const placeToUrl = new Map();
var places= [];

var nbActiveEvent;

var currentDate = new Date(Date.now());
currentDate.setHours(2,0,0);
var appDate;
 
function filterBy(value,byday) {  
if(!showAllValue){
    var filters = [
    "all",     
    [">=", ['get', 'time'], value],
    ["<=", ['get', 'time'], value+86400000]
    ];
    map.setFilter('event-circles', filters);
    map.setFilter('event-labels', filters);
    document.getElementById('dateSlider').textContent = days[new Date(value).getDay()] + " " + new Date(value).getDate()+ "/" + parseInt(new Date(value).getMonth()+1) + "/" + new Date(value).getFullYear();  ;
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

function filterByStyle(style,time) {  
    var filters ="";
    if(style=="all"){
        filters = [
        "all",     
        [">=", ['get', 'time'], time],
        ["<=", ['get', 'time'], time+86400000]
        ];
    }else{
        
        filters = [
        "all",    
        ["==", ['get', 'style'], style],
        [">=", ['get', 'time'], time],
        ["<=", ['get', 'time'], time+86400000]
        ];
    }
    
    map.setFilter('event-circles', filters);
    map.setFilter('event-labels', filters);
}

var hoveredStateId =  null; 
map.on('load', () => {
d3.json('./lyon_event.geojson',jsonCallback);
    map.flyTo({
    ...mapUtils.lyon_start, // Fly to the selected target
    duration: 5000, // Animate over 12 seconds
    essential: true // This animation is considered essential with
    //respect to prefers-reduced-motion
    }); 
});
 
function jsonCallback(err, data) {
    if (err) {
    throw err;
    }
    //PLACES
    mapUtils.addPlaces(map,'./lyon_place.geojson');
    //EVENTS
    let unKnownPlaces = {};
    // MATCH Coordinates in link with the place
    data.features = data.features.map((d) => {
        d.geometry.type = "Point";
        if(placeToCoord.get(d.properties.place) != null){
            d.geometry.coordinates = placeToCoord.get(d.properties.place);
        }else{
            d.geometry.coordinates = [0,0];
            unKnownPlaces[d.properties.place] = (unKnownPlaces[d.properties.place] || 0) + 1;
        }
        d.properties.icon = "music";
        return d;
    });
    mapUtils.addEvents(map,data);

    map.setLayoutProperty('places-circles', 'visibility', 'visible');
    map.setLayoutProperty('place-labels', 'visibility', 'visible');



    map.style.stylesheet.layers.forEach(function(layer) {
        if (layer.type === 'symbol') {
            map.removeLayer(layer.id);
        }
    });


    //Show Places that are not well treated and the number of time it appears
    if(showPlacesNotHandled){
        console.log("THE FOLLOWING PLACES ARE NOT HANDLED");
        let occurrencesArray = Object.entries(unKnownPlaces);
        occurrencesArray.sort((a, b) => b[1] - a[1]);
        for (let [key, value] of occurrencesArray) {
            console.log(`Place ${key} : ${value} fois`);
        }
    }

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

    //  Share URL
    class ShareControl {
        onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-share';

        // Add Font Awesome share icon
        this.container.innerHTML = '<i class="fas fa-share"></i>';

        // Add event listener for copying the current URL
        this.container.addEventListener('click', () => {
            const currentURL = window.location.href;
            navigator.clipboard.writeText(currentURL)
            .then(() => {
                alert('URL copied to clipboard!');
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





    appDate=currentDate;
    filterBy(currentDate.valueOf(),false);
    document.getElementById("calendar").valueAsDate = new Date(Date.now);

    document.getElementById('slider').addEventListener('input', async (e) => {
    const sliderValue = parseInt(e.target.value, 10);
    const tmpDate= new Date(currentDate);
    const newDateAsInt = tmpDate.setDate(tmpDate.getDate() + sliderValue).valueOf();
    appDate=newDateAsInt;

    filterBy(newDateAsInt,false);
    //getNbEventPerPlace(new Date(appDate));
    const canvas = document.getElementById('eventList');
    var todayInformation;
    todayInformation = await getTodayEvents(new Date(appDate));
    canvas.textContent = todayInformation;
    updateCircleLegend();
    });


    document.getElementById('calendar').addEventListener('input', (e) => {
    const choosenCalendarDay = e.target.value;
    currentDate =new Date(e.target.value);
    document.getElementById('slider').value = 0;
    const newDateAsInt = currentDate;
    appDate=newDateAsInt;
    filterBy(currentDate.valueOf(),false);
    });

    document.getElementById('showAll').addEventListener('input', (e) => {
    showAllValue= document.getElementById("showAll").checked;
    if(showAllValue){
    document.getElementById('slider').value = 0;   
    }
    filterBy(currentDate.valueOf(),false)
    });
}




//Create a popup, but don't add it to the map yet.
var popup = new mapboxgl.Popup({
closeButton: false,
closeOnClick: false
});

// When a click event occurs on a feature in the places layer, open a popup at the
// location of the feature, with description HTML from its properties.
map.on('click', 'event-circles', (e) => {

const target = e.features[0].geometry.coordinates;
mapUtils.end.center = target;

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
  
    placeURLString= "<a href="+placeToUrl.get(place)+" target=   'blank'title='Opens in a new window'>"+place+"</a>";
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


// Change the cursor to a pointer when the mouse is over the places layer.
map.on('mouseenter', 'places-circles', () => {
map.getCanvas().style.cursor = 'pointer';
});
 
// Change it back to a pointer when it leaves.
map.on('mouseleave', 'places-circles', () => {
map.getCanvas().style.cursor = '';
});


initPlaceInformation();
//getEventInformation()
chartIt();


async function initPlaceInformation(){
    const response = await fetch('lyon_place.geojson');
    const data =   await response.json();
    for (var i = 0; i < data.features.length; i++) {
        placeToCoord.set(data.features[i].properties.title,data.features[i].geometry.coordinates);
        placeToUrl.set(data.features[i].properties.title,data.features[i].properties.description);
        places.push(data.features[i].properties.title);
    }
    console.log("Total places imported from lyon_place.geojson: " + placeToCoord.size);
}

async function getSortedNbEventPerPlaceMap(_date){
    const response = await fetch('lyon_event.geojson');
    const data =   await response.json();
    const nbEventPerPlace = new Map();
    nbActiveEvent=0;
    for (var j = 0; j < places.length;j++){
        nbEventPerPlace.set(places[j], 0);
    }
    for (var i = 0; i < data.features.length; i++) {
        if(data.features[i].properties.time>_date){
            if (nbEventPerPlace.has(data.features[i].properties.place)) {
                nbEventPerPlace.set(data.features[i].properties.place, nbEventPerPlace.get(data.features[i].properties.place) + 1);
            } else {
                nbEventPerPlace.set(data.features[i].properties.place, 1);
            }
            nbActiveEvent = nbActiveEvent+1;
        }
    }    
    function sortMapByValue(map) {
        const sortedArray = [...map].sort((a, b) => b[1] - a[1]); // Sort by values in ascending order
        return new Map(sortedArray);
    }
    const sortedMap = sortMapByValue(nbEventPerPlace);
    return sortedMap;
}

async function getSortedNbEventPerDayMap(_date){
    const response = await fetch('lyon_event.geojson');
    const data =   await response.json();
    const nbEventPerDay = new Map();
    var keyEntry;
    for (var i = 0; i < data.features.length; i++) {
        if(data.features[i].properties.time>_date){
            const tmpDate = new Date(data.features[i].properties.time);
            keyEntry = new Date(data.features[i].properties.time );
            keyEntry = new Date(keyEntry.setHours(0, 0, 0, 0));           
            if (nbEventPerDay.has(keyEntry.getTime())) {
                nbEventPerDay.set(keyEntry.getTime(), nbEventPerDay.get(keyEntry.getTime()) + 1);
            } else {
                nbEventPerDay.set(keyEntry.getTime(), 1);
            }
        }
    }
    function getDaysInYear(year) {
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${year + 1}-01-01`);
        const days = [];

        for (let current = startDate; current < endDate; current.setDate(current.getDate() + 1)) {
            current = new Date(current.setHours(0, 0, 0, 0));
            days.push(new Date(current).getTime());
        }

        return days;
    }
    const yearToDisplay = 2024;
    const allDays = getDaysInYear(yearToDisplay);

    const valuesForDaysUnixTime = new Map();
    allDays.forEach(day => {
        const value = nbEventPerDay.get(day);
        valuesForDaysUnixTime.set(day, value);
    });

    // Créer une nouvelle Map avec des dates  comme clés
    let dateMap = new Map();
    valuesForDaysUnixTime.forEach((value, unixTimestamp) => {
        const date = new Date(unixTimestamp);
        dateMap.set(date, value);
    });
    return dateMap;
}




async function chartIt(){
    const canvas = document.getElementById('eventList');
    const todayInformation = await getTodayEvents(currentDate);
    canvas.textContent = todayInformation;
    canvas.style.display = 'block';
    const canvas1 = document.getElementById('chart1');
    const canvas2 = document.getElementById('chart2');
    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');
    if(devMode){
        canvas1.style.display = 'block';
        const eventInformation = await getSortedNbEventPerPlaceMap(currentDate);
        eventInformation.forEach((value, key) => {
        if (value === 0) {
            eventInformation.delete(key);
        }
        });
        const myChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels:Array.from(eventInformation.keys()),
            datasets: [{
            label: '(Places: ' + eventInformation.size + " - Event: " + nbActiveEvent + " )",
            data:Array.from(eventInformation.values()),
            borderWidth: 1
            }]
        }
        });
        canvas2.style.display = 'block';
        const eventbydateInformation = await getSortedNbEventPerDayMap(currentDate);
        let labels = [...eventbydateInformation.keys()].map(date => {
            const jour = date.getDate();
            const mois = date.getMonth() + 1;
            return `${jour}/${mois}`;
        });
        const myChart2 = new Chart(ctx2, {
        type: 'bar',
        data: {
        labels: labels,
        datasets: [{
            label: 'Number of Events per day',
            data: [...eventbydateInformation.values()],
            borderWidth: 1
        }]
    },
        options:  {y: {
                beginAtZero: true
            }
        }
        });


    }else{
        canvas1.style.display = 'none'; 
        canvas2.style.display = 'none'; 
    } 
}


var todaysEvent = new Map();
async function getTodayEvents(_date){
    const response = await fetch('lyon_event.geojson');
    const data =   await response.json();
    var nbEventToday=0;
    todaysEvent=new Map();
    for (var i = 0; i < data.features.length; i++) {
        if(data.features[i].properties.time>_date){
            if(data.features[i].properties.time<(_date.getTime() + 86400000)){
                todaysEvent.set(data.features[i].properties.place,data.features[i].properties.title);
                nbEventToday= nbEventToday+1;
            } 
        }
    }
    let mapString = '';

    for (const [key, value] of todaysEvent) {
    mapString += " "+ key +" |";// + value + "\n";
    }
    return "";//mapString;
}

async function updateCircleLegend(){

// Get the canvas element and its 2d rendering context
const canvas = document.getElementById('myCircleCanvas');
const ctx = canvas.getContext('2d');

const circles = [
  { x: 20, y: 25, radius: 18, value: 'Rock', color: 'rgba(23,128,251,0.5)' },
  { x: 60, y: 25, radius: 18, value: 'Electro', color: 'rgba(40,124,18,0.5)' },
  { x: 100, y: 25, radius: 18, value: 'Jazz', color: 'rgba(255,255,0,0.5)' },
  { x: 140, y: 25, radius: 18, value: 'Rap', color: 'rgba(165,2,33,0.5)' },
  { x: 180, y: 25, radius: 18, value: 'Classique', color: 'rgba(127,0,255,0.5)' },
  { x: 220, y: 25, radius: 18, value: 'World', color: 'rgba(224,147,40,0.5)' },
  { x: 260, y: 25, radius: 18, value: 'Chanson', color: 'rgba(0,255,255,0.5)' },
  { x: 300, y: 25, radius: 18, value: 'Live', color: 'rgba(144,238,144,0.5)' }
];

let selectedCircle = null;

canvas.addEventListener('click', function (event) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  circles.forEach(circle => {
    const dx = mouseX - circle.x;
    const dy = mouseY - circle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= circle.radius) {
      // Toggle selection
      if (selectedCircle === circle) {
        selectedCircle = null; // Deselect the circle
        filterByStyle("all",appDate.valueOf());
      } else {
        selectedCircle = circle; // Select the circle
        filterByStyle(circle.value,appDate.valueOf());
      }

      // Redraw all circles
      drawCircles();
    }
  });
});

function drawCircles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  circles.forEach(circle => {
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);

    // Set the fill color based on the selection
    if (selectedCircle === null) {
      // When no circle is selected, retain their original color
      ctx.fillStyle = circle.color;
    } else if (selectedCircle === circle) {
      // The selected circle keeps its original color
      ctx.fillStyle = circle.color;
    } else {
      // Non-selected circles are in gray
      ctx.fillStyle = 'gray';
    }

    ctx.fill();
    ctx.strokeStyle = circle.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();

    ctx.font = '8px Arial';
    ctx.fillStyle = "black";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(circle.value, circle.x, circle.y);
  });
}

// Initial drawing of circles
drawCircles();
}
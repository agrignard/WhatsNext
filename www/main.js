import * as mapUtils from './mapUtils.js';
import * as dataUtils from './dataUtils.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiYWdyaWduYXJkIiwiYSI6ImNqdWZ6ZjJ5MDBoenczeXBkYWU3bTk5ajYifQ.SXiCzAGs4wbMlw3RHRvxhw';

var devMode = false;
var showAllValueDiv = devMode ? true : false;
export const city="lyon";


updateCircleLegend();

const canvasShowAll = document.getElementById('showAll');
if (showAllValueDiv){
    canvasShowAll.style.display = 'block';
    canvasShowAll.checked = false;
}else{
    canvasShowAll.style.display = 'none';
}

const map = mapUtils.initializeMap();
var currentDate = new Date(Date.now());
currentDate.setHours(2,0,0);
var appDate;
 
map.on('load', () => {
d3.json('./' + city + '_event.geojson',jsonCallback);
    map.flyTo({
    ...mapUtils.startLocations.get(city), // Fly to the selected target
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
    mapUtils.addPlaces(map,'./' + city + '_place.geojson');
    map.setLayoutProperty('places-circles', 'visibility', 'visible');
    map.setLayoutProperty('place-labels', 'visibility', 'visible');
    
    //EVENTS
    let unKnownPlaces = {};
    // MATCH Coordinates in link with the place
    data.features = data.features.map((d) => {
        d.geometry.type = "Point";
        if(dataUtils.placeToCoord.get(d.properties.place) != null){
            d.geometry.coordinates = dataUtils.placeToCoord.get(d.properties.place);
        }else{
            d.geometry.coordinates = [0,0];
            unKnownPlaces[d.properties.place] = (unKnownPlaces[d.properties.place] || 0) + 1;
        }
        d.properties.icon = "music";
        return d;
    });
    mapUtils.addEvents(map,data);

    

    map.style.stylesheet.layers.forEach(function(layer) {
        if (layer.type === 'symbol') {
            map.removeLayer(layer.id);
        }
    });

    mapUtils.addGeolocationWidget(map);
    mapUtils.addShareWidget(map);
    

    appDate=currentDate;
    mapUtils.filterBy(map,currentDate.valueOf(),false);

    ///HANDLE SLIDER
    document.getElementById('slider').addEventListener('input', async (e) => {

    const sliderValue = parseInt(e.target.value, 10);
    const tmpDate= new Date(currentDate);
    const newDateAsInt = tmpDate.setDate(tmpDate.getDate() + sliderValue).valueOf();
    appDate=newDateAsInt;
    mapUtils.filterBy(map,newDateAsInt,false);
    var todayInformation;
    todayInformation = await dataUtils.getTodayEvents(new Date(appDate));
    updateCircleLegend();
    });

    document.getElementById('showAll').addEventListener('input', (e) => {
    const showAllValueCkecked= document.getElementById("showAll").checked;
    if(showAllValueCkecked){
      document.getElementById('slider').value = 0;   
    }
    mapUtils.filterBy(map,currentDate.valueOf(),false)
    });
    processMapBasedOnUrl(); 
}

dataUtils.initPlaceInformation();
chartIt();

async function chartIt(){
    const todayInformation = await dataUtils.getTodayEvents(currentDate);
    const canvas1 = document.getElementById('chart1');
    const canvas2 = document.getElementById('chart2');
    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');
    if(devMode){
        canvas1.style.display = 'block';
        const eventInformation = await dataUtils.getSortedNbEventPerPlaceMap(currentDate);
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
            label: '(Places: ' + eventInformation.size + " - Event: " + dataUtils.nbActiveEvent + " )",
            data:Array.from(eventInformation.values()),
            borderWidth: 1
            }]
        }
        });
        canvas2.style.display = 'block';
        const eventbydateInformation = await dataUtils.getSortedNbEventPerDayMap(currentDate);
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

async function updateCircleLegend(){

// Get the canvas element and its 2d rendering context
const canvas = document.getElementById('myCircleCanvas');
const ctx = canvas.getContext('2d');

const circles = [
  { x: 20, y: 25, radius: 18, value: 'Rock', color: 'rgba(23,128,251)' },
  { x: 60, y: 25, radius: 18, value: 'Electro', color: 'rgba(40,124,18,0.5)' },
  { x: 100, y: 25, radius: 18, value: 'Jazz', color: 'rgba(255,255,0,0.5)' },
  { x: 140, y: 25, radius: 18, value: 'Rap', color: 'rgba(255,0,0,0.5)' },
  { x: 180, y: 25, radius: 18, value: 'Chanson', color: 'rgba(0,255,255,0.5)' },
  { x: 220, y: 25, radius: 18, value: 'World', color: 'rgba(224,147,40,0.5)' },
  { x: 260, y: 25, radius: 18, value: 'Classique', color: 'rgba(127,0,255,0.5)' },
  { x: 300, y: 25, radius: 18, value: 'Live', color: 'rgba(144,238,144,0.5)' },
  { x: 340, y: 25, radius: 18, value: 'Theatre', color: 'rgba(165,42,42,0.5)' }
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
        mapUtils.filterByStyle(map,"all",appDate.valueOf());
      } else {
        selectedCircle = circle; // Select the circle
        mapUtils.filterByStyle(map,circle.value,appDate.valueOf());
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


// Function to get the value of a query parameter from the URL
function getQueryParam(parameter) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(parameter);
}

// Function to show content based on the URL parameter
function processMapBasedOnUrl() {
    const day = getQueryParam('day');
    // Check the value of the 'type' parameter and take appropriate actions
    if (day!=null) {
        document.getElementById('slider').value = day;
        const tmpDate= new Date(currentDate);
        const newDateAsInt = tmpDate.setDate(tmpDate.getDate() + parseInt(day)).valueOf();
        appDate=newDateAsInt;
        mapUtils.filterBy(map,newDateAsInt,false);
    }else {
        // Default behavior or handle unknown types
        console.log('Unknown or no day specified');
    }
}



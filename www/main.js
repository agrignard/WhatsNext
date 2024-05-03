import * as mapUtils from './mapUtils.js';
import * as dataUtils from './dataUtils.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiYWdyaWduYXJkIiwiYSI6ImNqdWZ6ZjJ5MDBoenczeXBkYWU3bTk5ajYifQ.SXiCzAGs4wbMlw3RHRvxhw';

var devMode = false;
var showAllValueDiv = devMode ? true : false;
export var city="lyon";
processCityBasedOnUrl();
mapUtils.setCategoryColors(city);
const map = mapUtils.initializeMap();


// Array to store dynamically generated circles
const circles = [];
var selectedCircle = null;
updateCircleLegend();

const canvasShowAll = document.getElementById('showAll');
if (showAllValueDiv){
    canvasShowAll.style.display = 'block';
    canvasShowAll.checked = false;
}else{
    canvasShowAll.style.display = 'none';
}


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
            //map.removeLayer(layer.id);
        }
    });

    mapUtils.addGeolocationWidget(map);
    mapUtils.addShareWidget(map);
    appDate=currentDate;
    mapUtils.filterByTime(map,currentDate.valueOf(),false);


    ///HANDLE SLIDER
    document.getElementById('slider').addEventListener('input', async (e) => {
      const sliderValue = parseInt(e.target.value, 10);
      const tmpDate= new Date(currentDate);
      const newDateAsInt = tmpDate.setDate(tmpDate.getDate() + sliderValue).valueOf();
      appDate=newDateAsInt;
      mapUtils.filterByStyles(map,mapUtils.getActiveCircles(circles),newDateAsInt);
      document.getElementById('dateSlider').textContent = mapUtils.days[new Date(newDateAsInt).getDay()] + " " + new Date(newDateAsInt).getDate()+ "/" + parseInt(new Date(newDateAsInt).getMonth()+1) + "/" + new Date(newDateAsInt).getFullYear();  
    });

    document.getElementById('showAll').addEventListener('input', (e) => {
    const showAllValueCkecked= document.getElementById("showAll").checked;
    if(showAllValueCkecked){
      document.getElementById('slider').value = 0;   
    }
    mapUtils.filterByTime(map,currentDate.valueOf(),false)
    });
    processDayBasedOnUrl(); 
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
        if (value < 2) {
            eventInformation.delete(key);
        }
        });
        const myChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels:Array.from(eventInformation.keys()),
            datasets: [{
            label: '(Places with more than 2 events: ' + eventInformation.size + " - Event: " + dataUtils.nbActiveEvent + " )",
            data:Array.from(eventInformation.values()),
            borderWidth: 1
            }]
        },
        options: {
          scales: {
              x: {
                  ticks: {
                      maxRotation: 90,
                      minRotation: 90,
                  },
                  fontSize: 5
              }
          }
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
    //canvas.style.display= "none";
    const ctx = canvas.getContext('2d');


    let i = 0;
    // Iterate over categoryColors object
    for (const category in mapUtils.categoryColors) {
    if (mapUtils.categoryColors.hasOwnProperty(category)) {
        // Add circle object to circles array
        circles.push({
            x: 20 + i * 42, // Adjust the x-coordinate as needed
            y: 25,
            radius: 20,
            value: category,
            color: mapUtils.getCategoryColorRGBA(category),
            active:true
        });
    }
    i++;
    }


    canvas.addEventListener('click', function (event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    circles.forEach(circle => {
        const dx = mouseX - circle.x;
        const dy = mouseY - circle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= circle.radius) {
        circle.active = !circle.active;
        mapUtils.filterByStyles(map,circles.filter(circle => circle.active),appDate.valueOf());
        drawCircles();
        }
    });
    });

    function drawCircles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    circles.forEach(circle => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
        ctx.fillStyle = circle.active ? circle.color : 'gray';
        ctx.fill();
        ctx.strokeStyle = circle.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();
        ctx.font = '10px Arial';
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
function processDayBasedOnUrl() {
    const day = getQueryParam('day');
    // Check the value of the 'type' parameter and take appropriate actions
    if (day!=null) {
        console.log('Day parameter: ' + day);
        document.getElementById('slider').value = day;
        const tmpDate= new Date(currentDate);
        const newDateAsInt = tmpDate.setDate(tmpDate.getDate() + parseInt(day)).valueOf();
        appDate=newDateAsInt;
        mapUtils.filterByTime(map,newDateAsInt,false);
    }else {
    }
}

function processCityBasedOnUrl() {
  const cityUrl = getQueryParam('city');
  // Check the value of the 'type' parameter and take appropriate actions
  if (cityUrl!=null) {
      console.log('City parameter: ' + city);
      city=cityUrl;
  }
}



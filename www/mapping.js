	// TO MAKE THE MAP APPEAR YOU MUST
	// ADD YOUR ACCESS TOKEN FROM
	// https://account.mapbox.com
    mapboxgl.accessToken = 'pk.eyJ1IjoiYWdyaWduYXJkIiwiYSI6ImNqdWZ6ZjJ5MDBoenczeXBkYWU3bTk5ajYifQ.SXiCzAGs4wbMlw3RHRvxhw';

    const darkMode=false;
    var darkstyle= 'mapbox://styles/mapbox/light-v11';
    if (darkMode){
        darkstyle= 'mapbox://styles/mapbox/dark-v11';
    }
    
    var devMode = true;
    var showAllValueDiv = devMode ? true : false;
    var showAllValue = false;
    updateCircleLegend();
    
    const canvasShowAll = document.getElementById('showAll');
    if (showAllValueDiv){
        canvasShowAll.style.display = 'block';
        canvasShowAll.checked = false;
    }else{
        canvasShowAll.style.display = 'none';
    }
    
    const map = new mapboxgl.Map({
    container: 'map',
    style: darkstyle,
    projection: 'globe',
    center: [4.85, 45.7465],
    zoom: 11
    });
    
    const mapStyle = new Map();
    mapStyle.set('Rock', 'rgba(23,128,251,0.5)');
    mapStyle.set('Electro', 'rgba(40,124,18,0.5)');
    mapStyle.set('Jazz', 'rgba(255,255,0,0.5)');
    mapStyle.set('Rap', 'rgba(165,2,33,0.5)');
    mapStyle.set('Divers', 'rgba(224,147,40,0.5)');
    
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    
    const placeToCoord = new Map();
    const placeToUrl = new Map();
    var places= [];
    var todaysEvent = new Map();
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
    });
     
    function jsonCallback(err, data) {
    if (err) {
      throw err;
    }
     
    // MATCH Coordinates in link with the place
    data.features = data.features.map((d) => {
        d.geometry.type = "Point";
        if(placeToCoord.get(d.properties.place) != null){
            d.geometry.coordinates = placeToCoord.get(d.properties.place);
        }else{
            console.log(d.properties.place + " is not defined in places");
            d.geometry.coordinates = [0,0];
        }
        d.properties.icon = "music"; 
        return d;
    });
    
    var transparency = 0.9;
    var transparencyBig = 0.95;
    
    const placesFile= './lyon_place.geojson';
        map.addSource('places', {
        type: 'geojson',
        data: placesFile
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
    
    /*map.addLayer({
    'id': 'places-circles2',
    'type': 'symbol',
    'source': 'places',
    'layout': {
    // These icons are a part of the Mapbox Light style.
    // To view all images available in a Mapbox style, open
    // the style in Mapbox Studio and click the "Images" tab.
    // To add a new image to the style at runtime see
    // https://docs.mapbox.com/mapbox-gl-js/example/add-image/
    'icon-image': `${symbol}`,
    'icon-allow-overlap': true
    },
    'filter': ['==', 'icon', symbol]
    });*/
    
    map.addLayer({
    'id': 'palce-labels',
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
    
    
     
    map.addSource('events', {
    'type': 'geojson',
    data: data
    });
    
     map.addLayer({
    'id': 'event-circles',
    'type': 'circle',
    'source': 'events',
    'paint': {
    'circle-color': [
            'match',['get', 'style'],
            'Rock', ["case",["boolean", ["feature-state", "hover"], false],'rgba(23,128,251,'+ transparencyBig+')','rgba(23,128,251,'+ transparency+')'],
            'Electro', ["case",["boolean", ["feature-state", "hover"], false],'rgba(40,124,18,'+ transparencyBig+')','rgba(40,124,18,'+ transparency+')'],
            'Jazz', ["case",["boolean", ["feature-state", "hover"], false],'rgba(255,255,0,'+ transparencyBig+')','rgba(255,255,0,'+ transparency+')'],
            'Rap', ["case",["boolean", ["feature-state", "hover"], false],'rgba(165,2,33,'+ transparencyBig+')','rgba(165,2,33,'+ transparency+')'],
            'Divers', ["case",["boolean", ["feature-state", "hover"], false],'rgba(224,147,40,'+ transparencyBig+')','rgba(224,147,40,'+ transparency+')'],
            '#ccc'
            ],
    'circle-stroke-color':[
        'match',['get', 'style'],
        'Rock', ["case",["boolean", ["feature-state", "hover"], false],'rgba(23,128,251,'+ transparencyBig+')','rgba(23,128,251,'+ transparency+')'],
        'Electro', ["case",["boolean", ["feature-state", "hover"], false],'rgba(40,124,18,'+ transparencyBig+')','rgba(40,124,18,'+ transparency+')'],
        'Jazz', ["case",["boolean", ["feature-state", "hover"], false],'rgba(255,255,0,'+ transparencyBig+')','rgba(255,255,0,'+ transparency+')'],
        'Rap', ["case",["boolean", ["feature-state", "hover"], false],'rgba(165,2,33,'+ transparencyBig+')','rgba(165,2,33,'+ transparency+')'],
        'Divers', ["case",["boolean", ["feature-state", "hover"], false],'rgba(224,147,40,'+ transparencyBig+')','rgba(224,147,40,'+ transparency+')'],
        '#ccc'
        ],
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
        if (!todaysEvent.has(place)) {
            const html= "<a href='"+ description +  "' target='blank'title='Opens in a new window'>"+place+"</a>";
            new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(map);
        } 
        
    });
    
    //Create a popup, but don't add it to the map yet.
    var popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
    });
    
    
    /*map.on('mouseleave', 'event-circles', function() {
    map.getCanvas().style.cursor = '';
    popup.remove();
    });*/
    
    
    // Change the cursor to a pointer when the mouse is over the places layer.
    /*map.on('mouseenter', 'event-circles', () => {
    map.getCanvas().style.cursor = 'pointer';
    });
     
    // Change it back to a pointer when it leaves.
    map.on('mouseleave', 'event-circles', () => {
    map.getCanvas().style.cursor = '';
    });*/
    
    // When a click event occurs on a feature in the places layer, open a popup at the
    // location of the feature, with description HTML from its properties.
    map.on('click', 'event-circles', (e) => {
    // Copy coordinates array.
    const coordinates = e.features[0].geometry.coordinates.slice();
    const description = e.features[0].properties.description;
    var title = e.features[0].properties.title;
    var place = e.features[0].properties.place;
    var style = e.features[0].properties.style;
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
    .setHTML("<h4>" + eventURLString + "</h4><b>Place:</b> "+place+"<br><b>Time:</b> "+new Date(time)+"<br><b>Style:</b> "+style)
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
    
    async function getNbEventPerPlace(_date){
        const response = await fetch('lyon_event.geojson');
        const data =   await response.json();
        const nbEventPerPlace = new Map();
        nbActiveEvent=0;
        //Initialize the number of event per place to 0
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
    
    async function getNbEventPerDay(_date){
        const response = await fetch('lyon_event.geojson');
        const data =   await response.json();
        const nbEventPerDay = new Map();
        for (var i = 0; i < data.features.length; i++) {
            if(data.features[i].properties.time>_date){
                const tmpDate = new Date(data.features[i].properties.time);
                tmpDate.setHours(4,0,0);
                keyEntry = days[tmpDate.getDay()] + " " + tmpDate.getDate() + "/" + (parseInt(tmpDate.getMonth())+1);
                           
                if (nbEventPerDay.has(keyEntry)) {
                    nbEventPerDay.set(keyEntry, nbEventPerDay.get(keyEntry) + 1);
                } else {
                    nbEventPerDay.set(keyEntry, 1);
                }
            }
        }
        const keysArray = Array.from(nbEventPerDay.keys());
        keysArray.sort((a, b) => a - b);
        const sortedMap = new Map();
    
        for (const key of keysArray) {
        sortedMap.set(key, nbEventPerDay.get(key));
        }
        return sortedMap;
    }
    
    
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
        //console.log( todaysEvent);
        let mapString = '';
    
        for (const [key, value] of todaysEvent) {
        mapString += " "+ key +" |";// + value + "\n";
        }
        return mapString;
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
            const eventInformation = await getNbEventPerPlace(currentDate);
            const myChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels:Array.from(eventInformation.keys()),
                datasets: [{
                label: 'Number of Event per Places (Places: ' + eventInformation.size + " - Event: " + nbActiveEvent + " )",
                data:Array.from(eventInformation.values()),
                borderWidth: 1
                }]
            },
            options: {
                scales: {
                y: {
                    beginAtZero: true
                }
                }
            }
            });
            canvas2.style.display = 'block';
            const eventbydateInformation = await getNbEventPerDay(currentDate);
            
            const myChart2 = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels:Array.from(eventbydateInformation.keys()),
                datasets: [{
                label: 'Number of Event per Days (Days: ' +eventbydateInformation.size +')',
                data:Array.from(eventbydateInformation.values()),
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
      { x: 50, y: 25, radius: 15, value: 'Rock', color: 'rgba(23,128,251,0.5)' },
      { x: 100, y: 25, radius: 15, value: 'Electro', color: 'rgba(40,124,18,0.5)' },
      { x: 150, y: 25, radius: 15, value: 'Jazz', color: 'rgba(255,255,0,0.5)' },
      { x: 200, y: 25, radius: 15, value: 'Rap', color: 'rgba(165,2,33,0.5)' },
      { x: 250, y: 25, radius: 15, value: 'Divers', color: 'rgba(224,147,40,0.5)' }
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
const webSources = '../webSources';
const imports = '../../import/';

const fs = require('fs');
const cheerio = require('cheerio');
const {parseDocument} = require('htmlparser2');
const {app, Menu, ipcRenderer} = require('electron');
const {loadVenuesJSONFile, loadVenueJSON, loadVenueScrapInfofromFile, initializeVenue} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks, extractBody, convertToLowerCase} = require(imports+'stringUtilities.js');
const {getFilesContent} = require(imports+'fileUtilities.js');

//const midnightHourOptions = ['none','sameday','previousday'];


const venues = loadVenuesJSONFile();
const venueID = sessionStorage.getItem('currentVenue');
const venue = loadVenueJSON(venueID,venues);
initializeVenue(venue,webSources);
const scrapInfo = loadScrapInfoFile();
if (scrapInfo.hasOwnProperty(venueID)){
  console.log('ok');
}
const venueScrapInfo = scrapInfo.hasOwnProperty(venueID)?scrapInfo[venueID]:{};
if (!venueScrapInfo.hasOwnProperty('mainPage')){
  venueScrapInfo.mainPage = {};
}



const venueInfo = document.getElementById('infos');
const rightPanel = document.getElementById('rightPanel');
const leftPanel = document.getElementById('letPanel');

venueInfo.textContent = venue.name+' ('+venue.city+', '+venue.country+')';

const delimiterTagEl = document.getElementById('delimiterTag');
delimiterTagEl.value = venue.hasOwnProperty('eventsDelimiterTag')?venue.eventsDelimiterTag:'';

const eventNameStrings = document.getElementById('eventNameStrings');
eventNameStrings.value = venueScrapInfo.mainPage.hasOwnProperty('eventNameStrings')?venueScrapInfo.mainPage.eventNameStrings:'Enter event name';
const eventNameTags = document.getElementById('eventNameTags');
eventNameTags.value = venue.scrap.hasOwnProperty('eventNameTags')?venue.scrap.eventNameTags:'';


const sourcePath = webSources+'/'+venue.country+'/'+venue.city+'/'+venue.name+'/';
//const inputFile = webSources+'/'+venue.country+'/'+venue.city+'/'+venue.name+'/'+venue.name+'.html';

let localPage = getFilesContent(sourcePath);
const parsedHtml = parseDocument(convertToLowerCase(localPage));
const $ = cheerio.load(parsedHtml);
$(venue.eventsDelimiterTag).each((index, element) => {
    $(element).addClass('encadre');
    //let ev = $(element).html();
});
rightPanel.innerHTML = $.html();


//console.log(localPage);

//const fileContent = fs.readFileSync(inputFile, 'utf8');

// rightPanel.innerHTML = localPage;

//rightPanel.innerHTML = extractBody(sourcePath);

//getPageFromUrl();

// prevent href links to be clicked
rightPanel.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault(); 
    });
  });

//console.log(venue);

function getPageFromUrl(){
    console.log(venue.url);
    fetch(venue.url)
  .then(response => response.text())
  .then(html => {
    // Insérer le contenu chargé dans la balise <div>
    rightPanel.innerHTML = html;

    // Désactiver les liens hypertextes à l'intérieur de la balise
    rightPanel.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault(); // Empêcher le comportement par défaut du lien
      });
    });
  })
  .catch(error => console.error('Erreur de chargement de la page :', error));

//     const response = await fetch(venue.url);
//   //  console.log(response);
//     rightPanel.innerHTML = response.text();
}


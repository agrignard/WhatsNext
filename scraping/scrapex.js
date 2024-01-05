const fs = require('fs');
const fs2 = require('fs').promises;
const { parse, isValid } = require('date-fns');
const cheerio = require('cheerio');

// Chemin vers le fichier à lire
const filePath = './venues-test.json';
const sourcePath = './webSources/';

const dateConversionFile = './dateConversion.json';
var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
var outFile = "generated/scrapexResult.csv";
var months;

fs2.readFile(dateConversionFile, 'utf8')
  .then((fileContent) =>{
    try {
      months = JSON.parse(fileContent); 
    } catch (erreur) {
      console.error("Erreur de parsing JSON pour les conversions de dates :", erreur.message);
    }
    fs2.readFile(filePath, 'utf8')
    .then((fileContent) =>{
      try {
        // Parser le texte JSON
        const venues = JSON.parse(fileContent);
        scrapFiles(venues);
      } catch (erreur) {
        console.error('\x1b[31mErreur lors de la lecture du fichier JSON :%s. %s\x1b[0m', filePath,erreur.message);
      }
    })
    console.log("\n\n");
  })
  .catch((erreur ) => {
    console.error("Erreur lors de la lecture des fichiers de configuration :", erreur);
  });

async function scrapFiles(venues) {
//  await Promise.all(venues.map(analyseFile));
  for (const venue of venues) {
    let err = false;
    if (!(venue.hasOwnProperty('eventsDelimiterTag') || venue.hasOwnProperty('eventsDelimiterRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de bloc d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!(venue.hasOwnProperty('eventNameTags') || venue.hasOwnProperty('eventNameRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de nom d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!(venue.hasOwnProperty('eventDateTags') || venue.hasOwnProperty('eventDateRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de nom d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!err){
      await analyseFile(venue);
    } 
  }
  fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
  console.log('Scrapex fini avec succex !!\n\n');
  
}



async function analyseFile(venue) {
  var events,eventDate,eventName,eventStyle,unixDate,eventURL, venueContent;
  var $;
  const inputFile = sourcePath+venue.name+".html";

  // parsing the events blocks
  try{
    venueContent = await fs2.readFile(inputFile, 'utf8');
    $ = cheerio.load(venueContent);
  }catch (erreur){
    console.error("Erreur lors de la lecture du fichier local de :",venue.name, erreur);
  }
  console.log();
  console.log('\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  *******`);
  try{
    if (venue.hasOwnProperty('eventsDelimiterTag')){
      events = [];
      $(venue.eventsDelimiterTag).each((index, element) => {
        let ev = $(element).html();
        events.push(ev);
      });
    }else{
      const regexDelimiter = new RegExp(venue.eventsDelimiterRegex, 'g');
      events = venueContent.match(regexDelimiter);
    }

    console.log("total number of events: " + events.length);       
  }catch(err){        
    console.log('\x1b[31m%s\x1b[0m', 'Délimiteur mal défini pour '+venue.name);      
  }

  // parsing each event
  try{
    const regexURL = new RegExp(venue.eventURL);
    const dateFormat = venue.dateFormat;

    for (eve of events){
      $eventBlock = cheerio.load(eve);
      
      // auxiliary function to extract data
      function getText(tagList,regex){
        let string = "";
        if (!(tagList === undefined)){
          try{
            for (let i = 0; i <= tagList.length-1; i++) {
              let ev = $eventBlock(tagList[i]).text();
              string += ev+' ';
            }
          }catch(err){
            console.log('\x1b[31m%s\x1b[0m', 'Erreur d\'extraction à partir des balises',tagList,' pour '+venue.name);
          }
        }else{
          try{
            const res = eve.match(new RegExp(regex));
            for (let i = 1; i <= res.length-1; i++) {
              if (!(res[i] === undefined)){
                string += res[i]+' ';      
              }
            }
          }catch(err){
            console.log('\x1b[31m%s\x1b[0m', 'Erreur d\'extraction regexp',regex,' sur pour '+venue.name);
          }
        } 
        return removeBlanks(string);
      }
      // end of auxiliary function

      // **** event data extraction ****//
  
      eventDate = getText(venue.eventDateTags,venue.eventDateRegex);
      eventName = getText(venue.eventNameTags,venue.eventNameRegex);
      if (venue.hasOwnProperty('eventStyleTags') || venue.hasOwnProperty('eventStyleRegex')){
        eventStyle = getText(venue.eventStyleTags,venue.eventStyleRegex);
      }

      // change the date format to Unix time
      const formatedEventDate = createDate(eventDate,dateFormat);
      if (!isValid(formatedEventDate)){
        console.log('\x1b[31mFormat de date invalide pour %s. Reçu \"%s\", converti en \"%s\" (attendu \"%s\")\x1b[0m', 
          venue.name,eventDate,convertDate(eventDate),dateFormat);
              // console.log('\x1b[31m%s\x1b[0m', 'Format de date invalide pour '+venue.name+
              // ': reçu \"'+eventDate+'\", transformé en \"',convertDate(eventDate),'\" au lieu de '+dateFormat+'.');
        unixDate = new Date().getTime(); // en cas d'erreur, ajoute la date d'aujourd'hui
      }else{
        unixDate = formatedEventDate.getTime();
        console.log(showDate(formatedEventDate));
      }
      console.log(eventName);
      if (eventStyle){
        console.log('Style: ',eventStyle);
      }

      // extract URL
      try{
        if (venue.hasOwnProperty('eventeventURLIndex') && venue.eventeventURLIndex === -1){
          eventURL ='No url link.';
        }else{
          const tagsWithHref = $eventBlock('a[href]');
          const index = venue.hasOwnProperty('eventeventURLIndex')?venue.eventeventURLIndex:0;
          eventURL = (venue.hasOwnProperty('baseURL')?venue.baseURL:'')
            +$eventBlock(tagsWithHref[index]).attr('href');// add the base URL if provided
        }
      }catch(err){
        console.log("\x1b[31mErreur lors de la récupération de l\'URL.\x1b[0m",err);
      }

      console.log(eventURL);

      eventName= eventName.replace(",","-");
      out = out+venue.name+','+eventName+','+unixDate+',100,Rock,'+eventURL+'\n';
      console.log();
    }  
    
  }catch(error){
    console.log("Erreur générale pour "+venue.name,error);
  }
  console.log("\n\n");
}
  


//********************************************/
//***            aux functions             ***/
//********************************************/


function convertDate(s){
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
 
  for (const key in months) {
    function replacer(match, p1, p2,p3, offset, string) {
      return ' '+key+' ';
    }
    for (const str of months[key]){
       s = s.replace(new RegExp("([^a-zA-Z.]|^)("+str+")([^a-zA-Z.]|$)",'i'),replacer);
    }
  }  
  return removeBlanks(s);
}


function createDate(s,dateFormat) {
  s = convertDate(s);
  if (s.includes('tonight')){
    return new Date();
  }else{
    let date = parse(s, dateFormat, new Date());
    if (date < new Date()){// add one year if the date is past. Useful when the year is not in the data
      date.setFullYear(date.getFullYear() + 1);
    }
    return date;
  }
}


function removeBlanks(s){
  return s.replace(/[\n\t]/g, '').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
}



function showDate(date){
  const day = date.getDate();
  const month = date.getMonth() + 1; 
  const year = date.getFullYear();
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const string = day+'/'+month+'/'+year+' (time: '+hour+':'+minutes+')';
  return string;
}
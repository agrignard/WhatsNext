const fs2 = require('fs');
const fs = require('fs').promises;
const cheerio = require('cheerio');

// Chemin vers le fichier à lire
//const fileName = 'Marché Gare.html';
//const fileName = 'terminal.html';
const fileName = 'transbordeur.html';
const sourcePath = './webSources/';

// const eventNameStrings = ["dusty"];
// const eventDateStrings = ["30","déc"];

// var eventNameStrings = ["Giant","atzur"];
// var eventDateStrings = ["09.","01"];
// var eventStyleStrings = ["pop-rock"];

// var eventNameStrings = ["dusty"];
// var eventDateStrings = ["30", "déc"];
// var eventStyleStrings = [];

var eventNameStrings = ["allien"];
var eventDateStrings = ["06 janv."];
var eventStyleStrings = ["techno"];


const outputFile = "./outTest.html";





fileContent = fs.readFile(sourcePath+fileName, 'utf8')
.then((fileContent) =>{
    console.log('\x1b[36m%s\x1b[0m', `******* Analysing file: ${fileName}  *******`);
    // convert everything to lower case
    eventNameStrings = eventNameStrings.map(string => string.toLowerCase());
    eventDateStrings = eventDateStrings.map(string => string.toLowerCase());
    eventStyleStrings = eventStyleStrings.map(string => string.toLowerCase());
    const $ = cheerio.load(convertToLowerCase(fileContent));

    let stringsToFind = eventNameStrings.concat(eventDateStrings);
    //console.log(stringsToFind);
    //console.log('*:contains("' + stringsToFind.join('"), :contains("') + '")');
    const tagsContainingStrings = $('*:contains("' + stringsToFind.join('"), :contains("') + '")')
        .filter((_, tag) => tagContainsAllStrings($(tag), stringsToFind));


    
    //Affichez les noms des balises trouvées
    if (tagsContainingStrings.length === 0){
        console.log('\x1b[31m%s\x1b[0m',"No occurence found.");
    }else{
        // tagsContainingStrings.each((_, tag) => {
        //     console.log('Tag found:', tag.tagName, $(tag).attr('class'),$(tag).text().length);
        // });
    
        // récupération de la meilleure balise
       // console.log("\nKeeping the best one:");
        const tag = tagsContainingStrings.last();
        console.log("Found ",tagsContainingStrings.length,' tags. Best tag: \x1b[32m',
             `<${tag.prop('tagName')} class="${$(tag).attr('class')}" id="${$(tag).attr('id')}">`,'\x1b[0m');
        console.log('Contains the following information:\n');
  //      console.log('\x1b[32m%s\x1b[0m', `Tag: <${tag.prop('tagName')} class="${$(tag).attr('class')}" id="${$(tag).attr('id')}">`);
        const groupContent = $(tag).html();
        console.log($(tag).text());
        console.log();
        
     //   console.log(removeBlanks(groupContent));
    //***************************************************************/
        // recherche des balises pour le nom de l'event
        const $eventBlock = cheerio.load(groupContent);

        const eventNameTags = eventNameStrings.map(string => findTag($eventBlock,string));
        console.log("Event name tags:");
        showTagsDetails(eventNameTags,$eventBlock);

        const eventDateTags = eventDateStrings.map(string => findTag($eventBlock,string));
        console.log("Event date tags:");
        showTagsDetails(eventDateTags,$eventBlock);

        if (eventStyleStrings.length > 0){
            console.log("Event style tags:");
            const eventStyleTags = eventStyleStrings.map(string => findTag($eventBlock,string));
            showTagsDetails(eventStyleTags,$eventBlock);
        }


        console.log("\n\n\n");
        
      //  fs2.writeFileSync(outputFile, $(tag).html(), 'utf-8', { flag: 'w' });
    }
    
   
  

    
    console.log("\n\n\n\n\n");
})
.catch((erreur ) => {
    console.error("Erreur de traitement du fichier :",fileName, erreur);
});

//*********************************************** */

function showTagsDetails(tagList,source){
    tagList.forEach(element => console.log('\x1b[32m', 'Tag: <', element.tagName,
        '\x1b[32m class=\"',source(element).attr('class'),
        '\x1b[32m\" id = \"',source(element).attr('id'),
        '\x1b[32m\"> index: ',source(element).index(),'\x1b[0m ',removeBlanks(source(element).text())));
}

function tagContainsAllStrings(tag, strings) {
    const tagContent = tag.text();//.toLowerCase(); // Convertir en minuscules
    return strings.every(string => tagContent.includes(string)); // Comparaison insensible à la casse
}

function findTag(html,string) {
    const tag = html(`*:contains('${string}')`).last();
    return tag.length > 0 ? tag.get(0) : null;
}


function removeBlanks(s){
    return s.replace(/ {2,}/g, ' ').replace(/\n[ \t\n]*/g, ' ');
 //    return s.replace(/[\t]*/g, '').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/[\n]*/, '\n');
 }
 
 
 function convertToLowerCase(s){
     regex = /^[^<]*?<|>([^]*?)<|>[^>]*?$/g;
     return s.replace(regex,match => match.toLowerCase());
 }
 
 




















async function analyseFile(venue) {
  var events,eventDate,eventName,unixDate,eventURL, venueContent;
  const inputFile = sourcePath+venue.name+".html";
  try{
    venueContent = await fs2.readFile(inputFile, 'utf8');
  }catch (erreur){
    console.error("Erreur lors de la lecture du fichier local de :",venue.name, erreur);
  }
  console.log();
  console.log('\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  *******`);
  try{
    try{
      if (venue.hasOwnProperty('eventsDelimiter')){
        const regexDelimiter = new RegExp(venue.eventsDelimiter, 'g');
        events = venueContent.match(regexDelimiter);
      }else{
        const eventAnchor = venue.eventsAnchor;
        const $ = cheerio.load(venueContent);
  
        events = [];
        $('.'+venue.eventsAnchor).each((index, element) => {
          let ev = $(element).html();
          events.push(ev);
        });
      }

      console.log("total number of events: " + events.length);       
    }catch(err){        
      console.log('\x1b[31m%s\x1b[0m', 'Délimiteur mal défini pour '+venue.name);      
    }

    const regexDate = new RegExp(venue.eventDate);
    const regexName = new RegExp(venue.eventName);
    const regexURL = new RegExp(venue.eventURL);
    const dateFormat = venue.dateFormat;
    
    if (!('eventDate' in venue) || !('eventName' in venue) || !('dateFormat' in venue)){
      console.log('\x1b[33m%s\x1b[0m', 'Pas de regexp défini pour '+venue.name);      
    }else{
      for (eve of events){
        try{
          const res = eve.match(regexDate);
          eventDate = "";
          for (let i = 1; i <= res.length-1; i++) {
            if (!(res[i] === undefined)){
              if (!(eventDate === "")){
                        eventDate += '-';
                }
                      eventDate += res[i];
            }    
          }        
        } catch(err){
          console.log('\x1b[31m%s\x1b[0m', 'Erreur regexp sur la date pour '+venue.name);
        }
        try{
          const res = eve.match(regexName);
          eventName = "";
          for (let i = 1; i <= res.length-1; i++) {
            if (!(res[i] === undefined)){
              if (i > 1){
                eventName += ' ';
              }
              eventName += res[i];      
            }
          }
          eventName = removeBlanks(eventName);
        }catch(err){
          console.log('\x1b[31m%s\x1b[0m', 'Erreur regexp sur le nom de l\'événement pour '+venue.name);
        }

        const oldDate = eventDate;
        console.log(eventDate);
        eventDate = convertDate(eventDate,dateFormat);
        if (!isValid(eventDate)){
          console.log('\x1b[31m%s\x1b[0m', 'Format de date invalide pour '+venue.name+': '+oldDate);
        }else{
          unixDate = eventDate.getTime();
                  //console.log(unixDate);
        }


        console.log(eventName);
        if ('eventURL' in venue){
          try{
            eventURL = eve.match(regexURL)[1];
            if (!(eventURL === undefined)){
              eventURL = venue.baseURL+eventURL;
            }
            console.log(eventURL);
          }catch(err){
            console.log('\x1b[33m%s\x1b[0m', 'URL non fonctionnelle pour '+venue.name);
          }
          out = out+venue.name+','+eventName+','+unixDate+',100,'+eventURL+'\n';
        }
        console.log();
      }  
    }
  }catch(error){
    console.log("Pas de regex pour "+venue.name,error);
  }
  console.log("\n\n");
}
  





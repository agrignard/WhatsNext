const fs2 = require('fs');
const fs = require('fs').promises;
const cheerio = require('cheerio');

// Chemin vers le fichier à lire
//const fileName = 'Marché Gare.html';
const fileName = 'test.html';
const sourcePath = './webSources/';

// const eventNameStrings = ["dusty"];
// const eventDateStrings = ["30","déc"];

const eventNameStrings = ["giant"];
const eventDateStrings = ["09","01"];

const outputFile = "./outTest.html";



fs.readFile(sourcePath+fileName, 'utf8')
.then((fileContent) =>{
    console.log('\x1b[32m%s\x1b[0m', `******* Analysing file: ${fileName}  *******`);
    console.log(convertToLowerCase(fileContent));
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
        console.log("Found ",tagsContainingStrings.length," tags.");
        tagsContainingStrings.each((_, tag) => {
            //console.log('Balise trouvée:', tag.tagName,removeBlanks($(tag).text()+"\n\n"));
            console.log('Tag found:', tag.tagName, $(tag).attr('class'),$(tag).text().length);
        });
    
        // récupération de la meilleure balise
        console.log("\nKeeping the best one:");
        const tag = tagsContainingStrings.last();
        console.log('\x1b[32m%s\x1b[0m', `Tag: <${tag.prop('tagName')} class="${$(tag).attr('class')}" id="${$(tag).attr('id')}">`);
       
        const groupContent = convertToLowerCase($(tag).text());
        
        console.log(removeBlanks(groupContent));
//***************************** */
        // recherche des balises pour le nom de l'event
        const $eventName = cheerio.load(groupContent);
        console.log(eventNameStrings);
        console.log('*:contains("' + eventNameStrings.join('"), :contains("') + '")');
        const eventNameTagsContainingStrings = $eventName('*:contains("' + eventNameStrings.join('"), :contains("') + '")')
        .filter((_, tag) => tagContainsAllStrings($(tag), eventNameStrings));
        if (eventNameTagsContainingStrings.length === 0){
            console.log('\x1b[31m%s\x1b[0m',"No tag matching the name of the event: ",eventNameStrings);
        }else{
            const eventNameTag = eventNameTagsContainingStrings.last();
            console.log('\x1b[32m%s\x1b[0m', `Tag: <${eventNameTag.prop('tagName')} class="${$(eventNameTag).attr('class')}" id="${$(eventNameTag).attr('id')}">`);
            console.log(removeBlanks($(eventNameTag).text()));
        }

        console.log("\n\n\n");
        
      //  fs2.writeFileSync(outputFile, $(tag).html(), 'utf-8', { flag: 'w' });
    }
    
    //console.log(removeBlanks($(tag).text()));
    //console.log(tag);
    // var mainTag = null;

    // tagsContainingStrings.each((_, balise) => {
    //     const texteBalise = $(balise).text();
        
    //     // Si la baliseAvecTexteLePlusCourt est null ou si le texte est plus court que celui actuellement retenu
    //     if (!mainTag || texteBalise.length < $(mainTag).text().length) {
    //         mainTag = balise;
    //     }
    //   });
      
    //   // Affichez le texte de la balise avec le texte le plus court
    //   console.log('Texte de la balise avec le texte le plus court:', removeBlanks($(mainTag).text()));




   // console.log(mainTag.text());
   // console.log('Texte de la balise:', removeBlanks(mainTag.text()));
//console.log('Code HTML de la balise:', mainTag.html());
//console.log('Classe de la balise:', mainTag.attr('class'));
//console.log('Identifiant de la balise:', mainTag.attr('id'));

    // tagsContainingStrings.each((_, balise) => {
    //     // Utilisation de .find() pour rechercher les descendants
    //     const baliseInterne = $(balise).find(':contains("' + stringsToFind.join('"), :contains("') + '")').last();
      
    //     // Affichez le texte de la balise la plus interne
    //     console.log('Texte de la balise la plus interne trouvée:', baliseInterne.text());
    //   });

    
    console.log("\n\n\n\n\n");
})
.catch((erreur ) => {
    console.error("Erreur d\'ouverture du fichier :",fileName, erreur);
});


function tagContainsAllStrings(tag, strings) {
    const tagContent = tag.text().toLowerCase(); // Convertir en minuscules
    return strings.every(string => tagContent.includes(string.toLowerCase())); // Comparaison insensible à la casse
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
  






function removeBlanks(s){
   return s.replace(/ {2,}/g, ' ').replace(/\n[ \t\n]*/g, ' ');
//    return s.replace(/[\t]*/g, '').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/[\n]*/, '\n');
}


function convertToLowerCase(s){
    regex = /^[^<]*?<|>([^]*?)<|>[^>]*?$/g;
    return s.replace(regex,match => match.toLowerCase());
}


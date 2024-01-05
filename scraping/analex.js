const fs2 = require('fs');
const fs = require('fs').promises;
const cheerio = require('cheerio');

// Chemin vers le fichier à lire
//const fileName = 'Marché Gare.html';
const fileName = 'Transbordeur.html';
const sourcePath = './webSources/';

const extendSelectionToGetURL = true;

// var eventNameStrings = ["vernissage","photogr"];
// var eventDateStrings = ["12.","01"];
// var eventStyleStrings = ["exposition"];
// var excludeList =  [];

var eventNameStrings = ["jasual"];
var eventDateStrings = ["10 jan"];
var eventStyleStrings = ["rock"];

// var eventNameStrings = ["allien"];
// var eventDateStrings = ["06 janv.","23:30"];
// var eventStyleStrings = ["techno"];


const outputFile = "./venueOutput.json";





fileContent = fs.readFile(sourcePath+fileName, 'utf8')
.then((fileContent) =>{
    const venueJSON = {};
    console.log('\x1b[36m%s\x1b[0m', `\n\n******* Analysing file: ${fileName}  *******\n`);
    // convert everything to lower case
    try{
        eventNameStrings = eventNameStrings.map(string => string.toLowerCase());
        eventDateStrings = eventDateStrings.map(string => string.toLowerCase());
        eventStyleStrings = eventStyleStrings.map(string => string.toLowerCase());
    }catch(error){
        console.error('\x1b[31mError while reading the strings to parse: %s\x1b[0m',error);
    }

    const $ = cheerio.load(convertToLowerCase(fileContent));

    let stringsToFind = eventNameStrings.concat(eventDateStrings).concat(eventStyleStrings);
    //console.log(stringsToFind);
    //console.log('*:contains("' + stringsToFind.join('"), :contains("') + '")');
    const tagsContainingStrings = $('*:contains("' + stringsToFind.join('"), :contains("') + '")')
    .filter((_, tag) => tagContainsAllStrings($(tag), stringsToFind));


    
    //Affichez les noms des balises trouvées
    if (tagsContainingStrings.length === 0){
        console.log('\x1b[31m%s\x1b[0m',"Impossible to find a tag that delimits the events.");
    }else{
        // tagsContainingStrings.each((_, tag) => {
        //     console.log('Tag found:', tag.tagName, $(tag).attr('class'),$(tag).text().length);
        // });
    
        // find a tag containing all the strings
        var mainTag = tagsContainingStrings.last();
        var $eventBlock = cheerio.load($(mainTag).html());
        var hrefs = $eventBlock('a[href]');

        // extend the tag if it does not include any URL link
        if (extendSelectionToGetURL){
            try{
                const mainTagWithURL = getTagWithURL(mainTag,$eventBlock);
                //mainTag = mainTagWithURL;
                let $eventBlockURL = cheerio.load($(mainTagWithURL).html());
                let hrefsURL = $eventBlockURL('a[href]');
                if (hrefsURL.length > 0){
                    mainTag = mainTagWithURL;
                    $eventBlock = $eventBlockURL;
                    hrefs = $eventBlock('a[href]');
                }
            }catch(err){
                console.log("\x1b[31mError while trying to find embedded URL recursively. Aborting URL search. Try to turn flag \'extendSelectionToGetURL\' to false to prevent recursive search. %s\x1b[0m",err)
            }
        }
       
        console.log("Found ",tagsContainingStrings.length,' tags. Best tag: \x1b[90m',
             `<${mainTag.prop('tagName')} class="${$(mainTag).attr('class')}" id="${$(mainTag).attr('id')}">`,'\x1b[0m Contains');
        console.log('\x1b[0m\x1b[32m%s\x1b[0m',removeImageTag(removeBlanks($(mainTag).text())));
    
   //     console.log($(mainTag).html());
        venueJSON.eventsDelimiterTag=getTagLocalization(mainTag,$,false);
  //      console.log('\x1b[32m%s\x1b[0m', `Tag: <${tag.prop('tagName')} class="${$(tag).attr('class')}" id="${$(tag).attr('id')}">`);
 
    
        
    //***************************************************************/
    //***************************************************************/
      
    
    // recherche des balises pour le nom de l'event
        

        console.log("\nEvent name tags:");
        const eventNameTags = eventNameStrings.map(string => findTag($eventBlock,string));
        showTagsDetails(eventNameTags,$eventBlock);
        venueJSON.eventNameTags = eventNameTags.map(tag => getTagLocalization(tag,$eventBlock,true));

        console.log("\nEvent date tags:");
        const eventDateTags = eventDateStrings.map(string => findTag($eventBlock,string));
        showTagsDetails(eventDateTags,$eventBlock);
        venueJSON.eventDateTags = eventDateTags.map(tag => getTagLocalization(tag,$eventBlock,true));

        if (eventStyleStrings.length > 0){
            console.log("\nEvent style tags:");
            const eventStyleTags = eventStyleStrings.map(string => findTag($eventBlock,string,true));
            showTagsDetails(eventStyleTags,$eventBlock);
            venueJSON.eventStyleTags = eventStyleTags.map(tag => getTagLocalization(tag,$eventBlock,true));
        }
    
        // logs depending on if URL has been found.
        console.log();
        if (hrefs.length === 1) {
          console.log('URL found:',$eventBlock(hrefs[0]).attr('href'));
        }else if (hrefs.length > 1){
            console.log(hrefs.length,'URLs found. Change index in JSON \"eventURLIndex\" to the most suitable one (default 0).');
            hrefs.each((index, element) => {
                const href = $eventBlock(element).attr('href');
                console.log('\x1b[90mURL (index\x1b[0m',index,'\x1b[90m):\x1b[0m', href);
            });
            venueJSON.eventURLIndex = 0;
        } 
        else {
          console.log('\x1b[31mNo url link found.'
            +(extendSelectionToGetURL?'':'(consider finding URLs recursively using \"extendSelectionToGetURL = true\")')+'\x1b[0m');
          venueJSON.eventURLIndex = -1;
        }


        console.log("\n",venueJSON);
        console.log("\n");

        try{
            const jsonString = JSON.stringify(venueJSON, null, 2); 
            fs2.writeFileSync(outputFile, jsonString);
            console.log('Saved to %s',outputFile);
        }catch(err){
            console.log('\x1b[31mError saving to .json: %s\x1b[0m',err);
        }
    }
    
   
  

    
    console.log("\n\n");
})
.catch((erreur ) => {
    console.error("Erreur de traitement du fichier :",fileName, erreur);
});

//*********************************************** */

function getTagWithURL(currentTag,$cgp){
    var hrefs = $cgp('a[href]');
    while ($cgp(currentTag).prop('tagName') && hrefs.length===0) {
        currentTag = currentTag.parent();
        if ($cgp(currentTag).prop('tagName')){
            const gp = currentTag.html();
            $cgp = cheerio.load(gp);
            hrefs = $cgp('a[href]');
        }
    }
    return currentTag;
}


function getTagLocalization(tag,source,withIndex){
  //  console.log("fezf");
    //console.log(source(tag).prop('tagName'));
    if (source(tag).attr('class')){
      //  console.log("avec class");
        const tagClass = source(tag).attr('class').split(' ')[0];
        let string = source(tag).prop('tagName')+'.'+tagClass;
      //  let string = source(tag).prop('tagName')+'.'+source(tag).attr('class');
        if (withIndex){
            string += ':eq('+getMyClasseIndex(tag,source)+')';
        }
        string = string.replace(/ /g,'.');
        return string;
    }else{
      //  console.log("faefaggg");
        let string = getTagLocalization(tag.parent,source,withIndex);
        string += ' '+source(tag).prop('tagName');
        if (withIndex){
            string += ':eq('+source(tag).index()+')';
        }
        return string;
    }
}

function getMyClasseIndex(tag,source){// get the index of the tag div.class among the same class
    const tagClass = source(tag).attr('class').split(' ')[0];
  //  console.log("index "+source(tag).prop('tagName'));
   // console.log(cl);
    return source(tag).index(source(tag).prop('tagName')+'.'+tagClass);
   // return source(tag).index(source(tag).prop('tagName')+'.'+source(tag).attr('class'));
}

function showTagsDetails(tagList,source){
    tagList.forEach(element => console.log('\x1b[90mTag: <%s class=%s> (index %s): \x1b[0m%s', 
        element.tagName,source(element).attr('class'),source(element).index(),removeBlanks(source(element).text())));
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
    return s.replace(/ {2,}/g, ' ').replace(/\n[ \t\n]*/g, ' ').replace(/^ /,'');
 //    return s.replace(/[\t]*/g, '').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/[\n]*/, '\n');
 }
 
 
 function convertToLowerCase(s){
     regex = /^[^<]*?<|>([^]*?)<|>[^>]*?$/g;
     return s.replace(regex,match => match.toLowerCase());
 }

 function removeImageTag(s){
    regex = /<img.*?>/g;
    return s.replace(regex,'[***IMAGE***]')
 }
 

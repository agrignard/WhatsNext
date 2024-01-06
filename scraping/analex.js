const fs2 = require('fs');
const fs = require('fs').promises;
const cheerio = require('cheerio');

// Chemin vers le fichier à lire
//const fileName = 'Marché Gare.html';
const fileName = 'Le Périscope.html';
// const fileName = 'Transbordeur.html';
//const fileName = 'Test.html';
const sourcePath = './webSources/';

const extendSelectionToGetURL = true;

// var eventNameStrings = ["vernissage","photogr"];
// var eventDateStrings = ["12.","01"];
// var eventStyleStrings = ["exposition"];
// var excludeList =  [];

var eventNameStrings = ["essor et chute","releas"];
var eventDateStrings = ["mercredi 17 janv"];
var eventStyleStrings = [];
 var eventPlaceStrings = [];

// var eventNameStrings = ["jasual"];
// var eventDateStrings = ["10 janv."];
// var eventStyleStrings = ["rock"];


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
        eventPlaceStrings = eventPlaceStrings.map(string => string.toLowerCase());
    }catch(error){
        console.error('\x1b[31mError while reading the strings to parse: %s\x1b[0m',error);
    }

    const $ = cheerio.load(convertToLowerCase(fileContent));

    let stringsToFind = eventNameStrings.concat(eventDateStrings).concat(eventStyleStrings).concat(eventPlaceStrings);
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
                 //   console.log("Extending the tags");
                 //   console.log($(mainTagWithURL).prop('tagName'),$(mainTagWithURL).attr('class'));
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
        venueJSON.eventsDelimiterTag=getTagLocalization(mainTag,$,true);
  //      console.log('\x1b[32m%s\x1b[0m', `Tag: <${tag.prop('tagName')} class="${$(tag).attr('class')}" id="${$(tag).attr('id')}">`);
 
    
        
    //***************************************************************/
    //***************************************************************/
      
    
    // recherche des balises pour le nom de l'event
        

        console.log("\nEvent name tags:");
        const eventNameTags = eventNameStrings.map(string => findTag($eventBlock,string));
        showTagsDetails(eventNameTags,$eventBlock);
        venueJSON.eventNameTags = eventNameTags.map(tag => getTagLocalization(tag,$eventBlock,false));
      //  venueJSON.eventNameTags = eventNameTags.map(tag => getTagLocalization(tag,cheerio.load($(tag).html()),false));

        console.log("\nEvent date tags:");
        const eventDateTags = eventDateStrings.map(string => findTag($eventBlock,string));
        showTagsDetails(eventDateTags,$eventBlock);
        venueJSON.eventDateTags = eventDateTags.map(tag => getTagLocalization(tag,$eventBlock,false));
    //     let ev = $eventBlock('DIV.scc:eq(0) H5:eq(0)').text();
    //    console.log("tag "+ev);


        if (eventStyleStrings.length > 0){
            console.log("\nEvent style tags:");
            const eventStyleTags = eventStyleStrings.map(string => findTag($eventBlock,string));
            showTagsDetails(eventStyleTags,$eventBlock);
            venueJSON.eventStyleTags = eventStyleTags.map(tag => getTagLocalization(tag,$eventBlock,false));
        }

        if (eventPlaceStrings.length > 0){
            console.log("\nEvent style tags:");
            const eventPlaceTags = eventPlaceStrings.map(string => findTag($eventBlock,string));
            showTagsDetails(eventPlaceTags,$eventBlock);
            venueJSON.eventPlaceTags = eventPlaceTags.map(tag => getTagLocalization(tag,$eventBlock,false));
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

//*********************************************** 

function getTagWithURL(currentTag,$cgp){
    var hrefs = $cgp('a[href]');
    // while the tag: has a name, has no url or has no class. Take the most inner tag with a class and an URL
    while ($cgp(currentTag).prop('tagName') && (hrefs.length===0 || !$cgp(currentTag).attr('class'))) {
        currentTag = $cgp(currentTag).parent();
        if ($cgp(currentTag).prop('tagName')){
            const gp = currentTag.html();
            $cgp = cheerio.load(gp);
            hrefs = $cgp('a[href]');
        }
    }
    return currentTag;
}


function getTagLocalization(tag,source,isDelimiter){
    try{
        if (source(tag).attr('class')){
            const tagClass = source(tag).attr('class').split(' ')[0];
            let string = source(tag).prop('tagName')+'.'+tagClass;
            if (!isDelimiter){// if delimiter, no index should be stored since many blocks should match (one per event)
                string += ':eq('+getMyIndex(tag,source)+')';
            }
            string = string.replace(/ /g,'.');
            return string;
        }else{// if no class is found, recursively search for parents until a class is found.
            const index = getMyIndex(tag,source);
            let string = getTagLocalization(source(tag).parent(),source,isDelimiter);
            string += ' '+source(tag).prop('tagName') + ':eq('+index+')';
            return string;
        }
    }catch(err){
        console.log("\x1b[31mErreur de localisation de la balise: %s\x1b[0m",err);
    //    console.log(source(tag).html());
    }

}

function getMyIndex(tag,source){// get the index of the tag div.class among the same type and same class
    let indexation = source(tag).prop('tagName');
    if (source(tag).attr('class')){
        indexation += '.'+source(tag).attr('class').split(' ')[0];
    }
    parentTag = source(tag).parent();
    const $parentHtml = cheerio.load(parentTag.html());
    const truc =  $parentHtml(indexation+`:contains('${source(tag).text()}')`).last();
    console.log('Tag:',source(tag).prop('tagName'),' indexation: ',indexation);
    const index = $parentHtml(truc).index(indexation);
return index;
   // console.log("indexation: "+indexation+'\n')
    //const tagClass = source(tag).attr('class').split(' ')[0];
   // return source(tag).index(indexation);
}



function showTagsDetails(tagList,source){
    tagList.forEach(element => console.log('\x1b[90mTag: <%s class=%s> (index %s): \x1b[0m%s', 
        element.tagName,source(element).attr('class'),getMyIndex(element,source),removeBlanks(source(element).text())));
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
    return s.replace(regex,'[***IMAGE***]');
 }
 

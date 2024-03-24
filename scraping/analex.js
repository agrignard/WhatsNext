const {getDateConversionPatterns} =require('./import/dateUtilities.js');
const {removeDoubles, convertToLowerCase, removeBlanks, makeURL, simplify} = require('./import/stringUtilities.js');
const {loadLinkedPages, getFilesContent} = require('./import/fileUtilities.js');
const {loadVenueScrapInfofromFile, loadVenuesJSONFile, saveToVenuesJSON, 
        getLanguages, checkLanguages, fromLanguages} = require('./import/jsonUtilities.js');
const {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings,
    getMyIndex, splitAndLowerCase, addJSONBlock,  getAllDates, getBestDateFormat} = require('./import/analexUtilities.js');

const fs = require('fs');
const cheerio = require('cheerio');
const {parseDocument} =require('htmlparser2');

const sourcePath = './webSources/';
const languages = getLanguages();

let linkedFileContent, venueJSON;// eventStrings;

// load venues json list
let venuesListJSON = loadVenuesJSONFile();

const venueID = IDFromArguments(process.argv);
const matchingVenues = venuesListJSON.filter(el => simplify(el.ID).startsWith(simplify(venueID)));

if (matchingVenues.length === 0){
    console.log("No venue matching arguments");
}else if (matchingVenues.length > 1){
    console.log("Too many venues match arguments:");
    matchingVenues.forEach(el =>console.log("%s (%s, %s)",el.name,el.city,el.country));
}else{
    console.log(matchingVenues.length);
    analyze(matchingVenues[0], sourcePath);
}



function analyze(venueJSON, path){
    let sourcePath = path;

    console.log(venueJSON);
    let eventStrings = loadVenueScrapInfofromFile(venueJSON.ID);

    console.log('\n\n\x1b[36m%s\x1b[0m', `******* Analyzing venue: ${venueJSON.name}  *******`);

    sourcePath += venueJSON.country+'/'+venueJSON.city+'/'+venueJSON.name+'/';


    // load main pages
    const fileContent = getFilesContent(sourcePath);


    // load date conversion pattern
    const dateConversionPatterns = fromLanguages(getDateConversionPatterns(),languages[venueJSON.country]);


    // load linked page
    if (eventStrings.linkedPage && fs.existsSync(sourcePath+'linkedPages.json')){
        linkedFileContent = loadLinkedPages(sourcePath);
    }

    // aborting process if mandatory strings are not present (safeguard)
    if (!eventStrings.mainPage.hasOwnProperty('eventNameStrings' || eventStrings.mainPage.eventNameStrings.length === 0)){
        console.log('\x1b[31mProperty \'eventNameStrings\' is missing in variable eventStrings. Aborting.\x1b[0m\n');
        throw new Error('Aborting.')
    }
    if (!eventStrings.mainPage.hasOwnProperty('eventDateStrings') || eventStrings.mainPage.eventDateStrings.length === 0){
        console.log('\x1b[31mProperty \'eventDateStrings\' is missing in variable eventStrings. Aborting.\x1b[0m\n');
        throw new Error('Aborting.')
    }

    
    

    //convert to lower case to allow case insensitive string match
    eventStrings = splitAndLowerCase(eventStrings);
    const parsedHtml = parseDocument(convertToLowerCase(fileContent));
    const $ = cheerio.load(parsedHtml);

    let stringsToFind = [].concat(...Object.values(eventStrings.mainPage));
    const tagsContainingStrings = getTagContainingAllStrings($,stringsToFind);

    //Affichez les noms des balises trouvées
    if (tagsContainingStrings.length === 0){
        console.log('\x1b[31mCan\'t find a tag that delimits the events, aborting process. Is event too old ? (event date: \x1b[0m%s\x1b[31m)\x1b[0m',
            eventStrings.mainPage.eventDateStrings.join());
    }else{
        console.log();

        let mainTag = tagsContainingStrings.last();
        let $eventBlock = cheerio.load($(mainTag).html());
        let hrefs = $eventBlock('a[href]');

        // extend the tag if it does not include any URL link
        if (!eventStrings.noUrl){
            try{
                let mainTagWithURL;        
                [mainTagWithURL, hrefs] = getTagWithURL(mainTag,$eventBlock,stringsToFind);
                let $eventBlockURL = cheerio.load($(mainTagWithURL).html());
                if (hrefs.length > 0){
                    mainTag = mainTagWithURL;
                    $eventBlock = $eventBlockURL;
                } else{
                    console.log("\x1b[33mWarning, no URL found. Keeping the most inner block.\x1b[0m.");
                }   
            }catch(err){
                console.log("\x1b[31mError while trying to find embedded URL recursively. Aborting URL search. Put field \"noUrl\":true to prevent looking for a link url. %s\x1b[0m",err)
            }
        }
        // adding levels to the main tag
        if (venueJSON.hasOwnProperty('delimiterAddLevels')){
            console.log('\x1b[36mAdding '+venueJSON.delimiterAddLevels+' parent levels to the delimiter tag.\x1b[0m');
            for(let i=0;i<venueJSON.delimiterAddLevels;i++){
                mainTag = $eventBlock(mainTag).parent();
                $eventBlock = cheerio.load(mainTag.html());
                hrefs = $eventBlock('a[href]');
            }
        }

        const mainTagString = '<'+mainTag.prop('tagName')
            +" class="+$(mainTag).attr('class')+(mainTag.hasOwnProperty('id')?$(mainTag).attr('id'):'')+'>';
        console.log('Found %s tags. Best tag \x1b[90m%s\x1b[0m contains: \x1b[32m%s\x1b[0m\n', 
            tagsContainingStrings.length,mainTagString,removeImageTag(removeBlanks($(mainTag).text())));

        venueJSON.eventsDelimiterTag=getTagLocalization(mainTag,$,true,stringsToFind);

        
        //***************************************************************/
        //***************************************************************/

        console.log('*** main page tags ***');

        // find and display tag for each string to find
        venueJSON.mainPage = addJSONBlock(eventStrings.mainPage,$eventBlock);
        
        // logs depending on if URLs have been found.
        console.log();
        if (!eventStrings.noUrl){
            venueJSON.eventURLIndex = getURLIndex(venueJSON,hrefs.length,$(mainTag));
            if (venueJSON.mainPage.hasOwnProperty('eventURLTags')){// tags are used to find the url to the event page
                console.log('URL found using tags: %s',$eventBlock(venueJSON.mainPage.eventURLTags[0]).attr('href'));
            }else{// automatic search for the tag
                if (hrefs.length === 1) {
                    console.log('URL found:',$eventBlock(hrefs[0]).attr('href'));
                } else if (hrefs.length > 1){
                    console.log('Found %s URLs. Change index in JSON \"eventURLIndex\" to the most suitable one (current index: %s).', hrefs.length, venueJSON.eventURLIndex);
                    hrefs.each((index, element) => {
                        const href = $eventBlock(element).attr('href');
                        console.log('\x1b[90mURL (index\x1b[0m',index+1,'\x1b[90m):\x1b[0m', href);//index+1 car 0 est réservé au maintTag de type <a=href>
                    });   
                } else {
                    console.log('\x1b[31mNo url link found.\x1b[0m');
                }
            }
        }else{
            venueJSON.eventURLIndex = -1;
        }


        // find most appropriate date format

        let dates = getAllDates(venueJSON.eventsDelimiterTag,venueJSON.mainPage['eventDateTags'],$);
        [venueJSON.dateFormat, _] = getBestDateFormat(dates,venueJSON, dateConversionPatterns);
        
        // find strings in linked pages

        if (eventStrings.hasOwnProperty('linkedPage')){
            if (linkedFileContent){
                let linkURL;
                if (venueJSON.mainPage.hasOwnProperty('eventURLTags')){// URL found with tags
                    linkURL = makeURL(venueJSON.baseURL,$eventBlock(venueJSON.mainPage.eventURLTags[0]).attr('href'));
                }else{// automatic URL
                    let i = ($(mainTag).prop('tagName')=='A')?venueJSON.eventURLIndex:(venueJSON.eventURLIndex-1);
                    linkURL = makeURL(venueJSON.baseURL,$eventBlock(hrefs[i]).attr('href'));
                }
                console.log('link ',linkURL);
                let linkedPage = linkedFileContent[linkURL];
                if (linkedPage){
                    console.log('\n*** linked page tags ***');
                    const parsedLinkedPage = parseDocument(convertToLowerCase('<html><head></head>'+linkedPage+'</html>'));
                    const $linked = cheerio.load(parsedLinkedPage);
                //    console.log($linked.html());
                    if (venueJSON.hasOwnProperty('linkedPage') && venueJSON.linkedPage.hasOwnProperty('eventMultiDateTags')){
                        const multiDate = venueJSON.linkedPage.eventMultiDateTags; // do not erase multidate tag
                        venueJSON.linkedPage = addJSONBlock(eventStrings.linkedPage,$linked);
                        venueJSON.linkedPage.eventMultiDateTags = multiDate;
                    }else{
                        venueJSON.linkedPage = addJSONBlock(eventStrings.linkedPage,$linked);
                    }
                    if (venueJSON.linkedPage.hasOwnProperty('eventDateTags')){
                        let dates = getAllDates("BODY",venueJSON.linkedPage['eventDateTags'],$linked);
                        [venueJSON.linkedPageDateFormat,_] = getBestDateFormat(dates,venueJSON.linkedPage, dateConversionPatterns);    
                    }
                }else{
                    console.log('\x1b[31mError getting data from linked pages. Run again \x1b[0maspiratorex.js\x1b[31m ?.\x1b[0m\n');
                }
            }else{
                venueJSON.linkedPage ={};// create an entry in venues.json to tell aspiratorex to get linked pages
                console.log('\x1b[31m\nLinked pages have not been downloaded yet. Run again \x1b[0maspiratorex.js\x1b[31m to get them.\x1b[0m\n');
            }
        }

        // saving to venues JSON and test file

        console.log("\n",venueJSON);
        console.log("\n");

        saveToVenuesJSON(venuesListJSON);
        
    }

    console.log("\n\n");
    checkLanguages([venueJSON]);
}










//************************************************/
//               Auxiliary functions             //
//************************************************/

function getTagWithURL(currentTag,$cgp,stringsToFind){
   // displayTag(currentTag,$cgp);
    let hrefs = $cgp('a[href]');
    if ($cgp(currentTag).prop('tagName')=='A'){
        const $cgparent = cheerio.load($cgp(currentTag).parent().html());  
        let tmp = $cgparent('a').filter((_, tag) => tagContainsAllStrings($cgparent(tag), stringsToFind));
        tmp.first().nextAll().remove();
        tmp.first().prevAll().remove(); 
        hrefs = $cgparent('a[href]');
    }
    // while the tag: has a name, has no url or has no class. Take the most inner tag with a class and an URL
    if ($cgp(currentTag).prop('tagName') && (hrefs.length===0 || !$cgp(currentTag).attr('class'))) {
        currentTag = $cgp(currentTag).parent();
        if ($cgp(currentTag).prop('tagName')){
            const gp = currentTag.html();
            $cgp = cheerio.load(gp);
            [currentTag,hrefs] = getTagWithURL(currentTag,$cgp,stringsToFind);
        }
    }
    return [currentTag, hrefs];
}






 
 


function removeImageTag(s){
    const regex = /<img.*?>/g;
    return s.replace(regex,'[***IMAGE***]');
}



 


function getURLIndex(venueJSON,nbHrefs,source){
    let maxIndex = (source.prop('tagName')=='A')?(nbHrefs-1):nbHrefs; // index span is [1,nbHrefs] if main tag is not A, and [0,nbHrefs-1]
    let minIndex = (source.prop('tagName')=='A')?0:1;
    if (nbHrefs == 0){// no url found, returns -1
        return -1;
    }    
    if (nbHrefs == 1
        || !venueJSON.hasOwnProperty('eventURLIndex') 
        || (venueJSON.eventURLIndex > maxIndex)
        || (venueJSON.eventURLIndex < minIndex)){
        // if only one url, or no index set previously, or index is not in the right range, returns default index
        if (source.prop('tagName')=='A'){
            return 0;
        }else{
            return 1;
        }
    }else{//more than one reference, verifies is the index is still valid
        return venueJSON.eventURLIndex; // return previous value of the index
    }   
}







function IDFromArguments(args){
    args = args.slice(2).map(el => el.toLowerCase()); 
    if (args.length > 3){
      console.log(args.length);
      console.log("\x1b[31mError: too many arguments\x1b[0m");
      args = ['--help'];
    }
    if (args.length === 0){
        console.log("\x1b[31mError: not enough arguments\x1b[0m");
        args = ['--help'];
      }
    if (args.some(arg => arg === '--help')){
        console.log('\nSyntax: node ./analex [\x1b[32msource_name\x1b[0m] '+
                    '[\x1b[32mcity\x1b[0m \x1b[90m(optional)\x1b[0m] '+
                    '[\x1b[32mcountry\x1b[0m \x1b[90m(optional)\x1b[0m]\n'+
                    'This will analyse the website with the corresponding name/city/country.\n'+
                    'Only one venue should correspond to the arguments. Use the optional arguments to ensure that the venue is unique');
        return undefined;
    }else{
        return args.join('|');
    }
}
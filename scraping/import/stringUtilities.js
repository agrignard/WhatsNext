/**************************************/
/*   utilities to deal with strings   */
/**************************************/

module.exports = { simplify, removeAccents, removeBlanks, removeDoubles,
  makeURL,convertToLowerCase, removeImages, extractBody, cleanPage, fixString, isValidURL};


// if a string has a non standard character, look in a candidate list if there is a corresponding match

function isValidURL(url){
  if (url === undefined || url === '#'){
    return false;
  }
  return true;
}

function fixString(string,replacementList){
  const regexString = string.replace(/[^\x00-\x7F]/g,'.');
  const regex = new RegExp(regexString);
  const candidateList = replacementList.filter(el => el.match(regex));
  return (candidateList.length > 0)?candidateList[0]:string;
}


// simplify a string. This function is intended to be used for string comparison
// in order to prevent blanks, special caracters, accents from finding a good match
function simplify(string){
  // remove accents, special characters and convert to lower case
  const res = removeBlanks(removeSpecialCharacters(removeAccents(string.toLowerCase()),' '));
  return res;
}

function removeSpecialCharacters(string, replacement){
  return string.replace(/[~!@$%^&*()+=\-,.\/';:?><\[\]\\{}|`#]/g,replacement);
}


function removeAccents(string){
  return string.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// remove duplicates elements from a list
function removeDoubles(list) {
    if (Array.isArray(list)){
     const res = [];
     list.forEach((element) => {
         if (res.indexOf(element) === -1) {
             res.push(element);
         }
       });
     return res;
    }else{
     return list;
    }
}

// determine if an URL starts with https://www...
function isFullURL(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

// build an absolute url from a link URL: appends a base url if the link is a relative link
function makeURL(baseURL, url){
  if (url){
    // const bu = baseURL.endsWith('/')?baseURL.slice(0,-1):baseURL;
    // const url = URL.startsWith('/')?URL.slice(1):URL;
    //   if (URL.startsWith(bu) || URL.startsWith('http')){
    if (isFullURL(url)){//full URL
      return url;
    }else if(url.startsWith('/')){// absolute URL (URL starts with /)
      const objURL = new URL(baseURL);
      return objURL.protocol + '//'+objURL.hostname+url;
    }else { //relative URL
      return baseURL+url;
    }
  }else{
    return undefined;
  }
}

// convert the text of an html file to lower case (does not modify the case within tags)
function convertToLowerCase(s){
  const regex = /^[^<]*?<|>([^]*?)<|>[^>]*?$/g;
  return s.replace(regex,match => match.toLowerCase());
}

// remove blancks from a string
function removeBlanks(s){
    return s.replace(/[\n\t]/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s/,'').replace(/\s$/,'');
  // return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
}

// remove reference to an image in a html file (provides a more compact text)
function removeImages(content){
   content.replace(/<[ ]*img[^]*?>/g,'[IMAGE]');
}

// extract the <body> tag from an html content
function extractBody(content){
  return content.match(/<body[^]*?>[^]*?<\/body>/)[0];
}

// perform several fixes on a html text to make it cleaner and more consistent
function cleanPage(content){
  let cleanedContent = cleanScripts(content);
  cleanedContent = removeBRTags(cleanedContent);
  cleanedContent = removeUselessTags(cleanedContent);
  cleanedContent = cleanHtml(cleanedContent);
  cleanedContent = removeForms(cleanedContent);
  cleanedContent = fixTags(cleanedContent);
  cleanedContent = fixImages(cleanedContent);
  cleanedContent = addDepthTag(cleanedContent);
 // cleanedContent = removeImages(cleanedContent);
  return cleanedContent;
}

function addDepthTag(content){
  const cheerio = require('cheerio');

  const $ = cheerio.load(content);

  // search for existing class in order to set a depthPrefix that does not conflict with existing classes
  const classes = new Set();
  $('*').each((_, element) => {
    const classAttr = $(element).attr('class');
    if (classAttr) {
      classAttr.split(/\s+/).forEach(cls => classes.add(cls)); // return unique classes
    }
  });

  const classeList = [...classes];
  let depthPrefix = 'depth';
  // while(classes.has(depthPrefix)){
  while(classeList.some(item => item.startsWith(depthPrefix))){
    depthPrefix = depthPrefix+'X';
  }

  function addDepthClass(element, depth = 0) {
    
    $(element).addClass(depthPrefix+depth);
    $(element).children().each((_, child) => {
      addDepthClass(child, depth + 1);
    });
  }
  
  addDepthClass($('html'));
  
  return $.html();
}

// fix image sizes that are too large in electron
function fixImages(content){
  let res = content.replace(/(<img[^>]*style[\s\t\n]*=[\s\t\n]*"[^"]*position[\s\t\n]*:[\s\t\n]*)absolute/g,'$1XXXXXXXX');// remove scripts
  return res;
}


// remove scripts from an html file
function cleanScripts(content){
  let res = content.replace(/<script[^]*?<\/script>/g,'');// remove scripts
  res = res.replace(/<noscript[^]*?<\/noscript>/g,'');// remove scripts
  return res;
}

// replace paragraph breaks with a real tag (opening and closing) (and add a tag to the text before
// the first <br>)
function removeBRTags(content){
  return content.replace(/(?<!br)>([^>]*?)<br>/gi, '><p class="addedTag">$1</p><br>')
    .replace(/<br>([^]*?)(?=<)/gi, '<p class="addedTag">$1</p>');// replace br tags by p tags
  // return content.replace(/<br>([^]*?)(?=<)/gi, '<div class="addedTag">$1</div>');// replace br tags by p tags
  // return content.replace(/<br>([^]*?)</gi, (_,p) => '<p class="addedTag">'+p+'</p><');// remove scripts
}

// replace tags that do not provide useful information, and make html hard to read or cause errors, such as <path>
function removeUselessTags(content){
  // remove tags but keep content
  let tagList = ['path'];
  tagList.forEach(el => {
    let regex = new RegExp("<[\s\t\n]*"+el+"[^>]*>(.*?)<[\s\t\n]*\/"+el+"[\s\t\n]*>","gi");
    content = content.replace(regex, '$1');
  });
  // remove tags and content
  tagList = ["header","svg","video","option","footer","nav","select"];
  tagList.forEach(el => {
        regex = new RegExp("<"+el+"[^]*?<\/"+el+">","g");
        content = content.replace(regex,'');
    });
  return content;
}

// remove forms from an html content
function removeForms(content){
  let res = content.replace(/<form[^]*?<\/form>/g,'');// remove scripts
  res = res.replace(/<style[^]*?<\/style>/g,'');
  return res;
}

// fixes unclosed a tags
function fixTags(content){// pour l'instant, ne fixe que les balises 'a' mal fermées
  const regex = /(<a class[ ]*=[ ]*"[^]*?")(?![^]*?<\/a>)?([^]*?)(?=\1)/g;
  return content.replace(regex,(p,p1,p2) => p1+p2+'<\/a>');
}

// remove forbidden characters from tag classes
function cleanHtml(content){
  function removeForbiddenCaracters(match,p,offset,string){// remove the forbidden caracters
    return removeSpecialCharacters(p,'');
  }

  function replaceClass(p) {//find the classes that are URLs (not href) and apply removeForbiddenCaracters
    return p.replace(/(?<!(?:href|src)=[^"]*)("[^"]*")/g,removeForbiddenCaracters);
  }

  function findClasses(match,p,offset,string) {
    return '<'+p.replace(/class[\s\t\n]*=[\s\t\n]*([^"]*)("[^"]*")/g,replaceClass)+'>';// find the classes within the tags and apply replaceClass
    // return '<'+p.replace(/([^"]*)("[^"]*")/g,replaceClass)+'>';// find the classes within the tags and apply replaceClass
  }
  return content.replace(/<([^<>]*)>/g, findClasses); // find the tag contents and apply findClasses
}
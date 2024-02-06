/**************************************/
/*   utilities to deal with strings   */
/**************************************/



// // if a string has a non standard character, look in a candidate list if there is a corresponding match

// export function fixString(string,replacementList){
//   const regexString = string.replace(/[^\x00-\x7F]/g,'.');
//   const regex = new RegExp(regexString);
//   const candidateList = replacementList.filter(el => el.match(regex));
//   return (candidateList.length > 0)?candidateList[0]:string;
// }

// remove duplicates elements from a list

export function simplify(string){
  return removeAccents(string.toLowerCase());
}

export function removeAccents(string){
  // let res = string;
  // res = res.replace(/[âä]/g,'a');
  // res = res.replace(/[éèêëÉ]/g,'e');
  // res = res.replace(/[ïî]/g,'i');
  // res = res.replace(/[ô]/g,'o');
  // res = res.replace(/[ûù]/g,'u');
  // return res;
  return string.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function removeDoubles(list) {
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
export function makeURL(baseURL, url){
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
  // if (URL){
  //   const bu = baseURL.endsWith('/')?baseURL.slice(0,-1):baseURL;
  //   const url = URL.startsWith('/')?URL.slice(1):URL;
  //   //   if (URL.startsWith(bu) || URL.startsWith('http')){
  //   if (isAbsoluteURL(url)){
  //     return url;
  //   }else{
  //     return bu+'/'+url;
  //   }
  // }else{
  //   return undefined;
  // }
}

// convert the text of an html file to lower case (does not modify the case within tags)
export  function convertToLowerCase(s){
  const regex = /^[^<]*?<|>([^]*?)<|>[^>]*?$/g;
  return s.replace(regex,match => match.toLowerCase());
}

// remove blancks from a string
export function removeBlanks(s){
  return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
}

// remove reference to an image in a html file (provides a more compact text)
export function removeImages(content){
   content.replace(/<[ ]*img[^]*?>/g,'[IMAGE]');
}

// extract the <body> tag from an html content
export function extractBody(content){
  return content.match(/<body[^]*?>[^]*?<\/body>/)[0];
}

// perform several fixes on a html text to make it cleaner and more consistent
export function cleanPage(content){
  var cleanedContent = cleanScripts(content);
  cleanedContent = removeBRTags(cleanedContent);
  cleanedContent = cleanHtml(cleanedContent);
  cleanedContent = removeForms(cleanedContent);
  cleanedContent = fixTags(cleanedContent);
//      cleanedContent = removeImages(cleanedContent);
  return cleanedContent;
}

// remove scripts from an html file
function cleanScripts(content){
  let res = content.replace(/<script[^]*?<\/script>/g,'');// remove scripts
  res = res.replace(/<noscript[^]*?<\/noscript>/g,'');// remove scripts
  return res;
}

// replace paragraph breaks with a real tag (opening and closing)
function removeBRTags(content){
  return content.replace(/<br>([^]*?)</gi, (_,p) => '<p class="addedTag">'+p+'</p><');// remove scripts
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
    return p.replace(/[~!@$%^&*()+=\-,.\/';:?><\[\]\\{}|`#]/g,'');
  }

  function replaceClass(p) {//find the classes that are URLs (not href) and apply removeForbiddenCaracters
    return p.replace(/(?<!(?:href|src)=[^"]*)("[^"]*")/g,removeForbiddenCaracters);
  }

  function findClasses(match,p,offset,string) {
    return '<'+p.replace(/([^"]*)("[^"]*")/g,replaceClass)+'>';// find the classes within the tags and apply replaceClass
  }
  return content.replace(/<([^<>]*)>/g, findClasses); // find the tag contents and apply findClasses
}
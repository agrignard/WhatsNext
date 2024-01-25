
// if a string has a non standard character, look in a candidate list if there is a corresponding match

export function fixString(string,replacementList){
  const regexString = string.replace(/[^\x00-\x7F]/g,'.');
  const regex = new RegExp(regexString);
  const candidateList = replacementList.filter(el => el.match(regex));
  return (candidateList.length > 0)?candidateList[0]:string;
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

export function makeURL(baseURL, URL){
    const bu = baseURL.endsWith('/')?baseURL.slice(0,-1):baseURL;
    const url = URL.startsWith('/')?URL.slice(1):URL;
    if (URL.startsWith(bu) || URL.startsWith('http')){
      return URL;
    }else{
      return baseURL+'/'+URL;
    }
}

export  function convertToLowerCase(s){
  const regex = /^[^<]*?<|>([^]*?)<|>[^>]*?$/g;
  return s.replace(regex,match => match.toLowerCase());
}

export function removeBlanks(s){
  return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
}

export function removeImages(content){
   content.replace(/<[ ]*img[^]*?>/g,'[IMAGE]');
}

export function extractBody(content){
  return content.match(/<body[^]*?>[^]*?<\/body>/)[0];
}

export function cleanPage(content){
  var cleanedContent = cleanScripts(content);
  cleanedContent = removeBRTags(cleanedContent);
  cleanedContent = cleanHtml(cleanedContent);
  cleanedContent = removeForms(cleanedContent);
  cleanedContent = fixTags(cleanedContent);
//      cleanedContent = removeImages(cleanedContent);
  return cleanedContent;
}

function cleanScripts(content){
  let res = content.replace(/<script[^]*?<\/script>/g,'');// remove scripts
  res = res.replace(/<noscript[^]*?<\/noscript>/g,'');// remove scripts
  return res;
}

function removeBRTags(content){
  return content.replace(/<br>([^]*?)</gi, (_,p) => '<p class="addedTag">'+p+'<');// remove scripts
}

function removeForms(content){
  let res = content.replace(/<form[^]*?<\/form>/g,'');// remove scripts
  res = res.replace(/<style[^]*?<\/style>/g,'');
  return res;
}

function fixTags(content){// pour l'instant, ne fixe que les balises 'a' mal fermées
  const regex = /(<a class[ ]*=[ ]*"[^]*?")(?![^]*?<\/a>)?([^]*?)(?=\1)/g;
  return content.replace(regex,(p,p1,p2) => p1+p2+'<\/a>');
}



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
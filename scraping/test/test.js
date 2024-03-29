const st1 ="Trio Grande + She’s Analog"
const st2="Trio Grande + She’s Analog"
// console.log(st1.replace(/\s/g,''));
// console.log(st2.replace(/\s/g,''));
console.log(simplify(st1));
console.log(simplify(st2));



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

  function removeBlanks(s){
    return s.replace(/[\n\t]/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s/,'').replace(/\s$/,'');
  }
const truc = 'pezrkljljkjéopuupù00';

function removeAccents(string){
    const regex = /[éèêëÉâäïîôûù]/g;
    return string.replace(regex,'Z');
    
  }

  //console.log(removeAccents(truc));

console.log(truc.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
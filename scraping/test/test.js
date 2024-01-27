const truc = 'pezrkljljkjéopuupù00';

function removeAccents(string){
    const regex = /[éèêëÉâäïîôûù]/g;
    return string.replace(regex,'Z');
    
  }

  console.log(removeAccents(truc));
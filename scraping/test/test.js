function isEqual(object1, object2) {
  const keyList = Object.keys(object1);
  if (keyList.length != Object.keys(object2).length){
      return false;
  }
  return keyList.every(key => object1[key] === object2[key]);
  // const key1 = Object.keys(object1).sort().toString();
  // const key2 = Object.keys(object2).sort().toString();
  // return key1 === key2 && JSON.stringify(object1) === JSON.stringify(object2);
}


const a = { id: 1, nom: 'John' };
const b =  { nom: 'John', id: 1 };
const c =  { id: 2, nom: 'Jane' };

console.log(isEqual(a,c));
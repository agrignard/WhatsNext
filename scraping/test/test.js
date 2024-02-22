const truc={name:"j"}

console.log(truc.name);
for (const key in truc.linkedPage){
  truc.linkedPage[key] = '0';
}

console.log(truc);
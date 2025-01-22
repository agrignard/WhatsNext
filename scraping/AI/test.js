
text = "[fokfe]lijhfd";
result = text.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');

console.log(result);

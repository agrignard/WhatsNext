const express = require('express');
const path = require('path');
const fileURLToPath = require('url');
const app = express();

app.use(express.static(__dirname + '/www'));
const port = process.env.PORT || 3000;

app.listen(port);
console.log('Starting serve on working at ' + port);
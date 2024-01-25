/*var express = require('express');
var app = express();*/

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

app.use(express.static(__dirname + '/www'));
const port = process.env.PORT || 3000;

app.listen(port);
console.log('Starting serve on working at ' + port);
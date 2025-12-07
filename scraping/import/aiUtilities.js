/**********************************************************/
/*    utilities used in ai                                */
/**********************************************************/

require('dotenv').config();

const { default: ollama } = require('ollama');
const { default: Anthropic } = require('@anthropic-ai/sdk');

//const path = require('path');
//const fs = require('fs');
// const {removeBlanks} = require('./stringUtilities.js');
//const {loadLinkedPages, fetchWithRetry, fetchLink} = require('./fileUtilities.js');
// const {unique, isValidEvent} = require('./jsonUtilities.js');
// const {getCommonDateFormats, createDate} = require('./dateUtilities.js');
// const cheerio = require('cheerio');
const {minimalizeHtml} = require('./fileUtilities.js');


//*** module export at the end of the file ***

const API_KEY = process.env.ANTHROPIC_KEY;

const currentOllamaModel = 1;

const ollamaModelList = [ 'llama3', //0
    'llama3.1:8b', //1
    'llama3.3:70b',  //2
    'deepseek-coder-v2', //3
    'mistral-nemo' //4
]

function getCurrentLlamaModel(){
    return ollamaModelList[currentOllamaModel];
}


async function askClaude(question, systemPrompt) {
    const anthropic = new Anthropic({
        apiKey: API_KEY
    });

    const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        temperature: 0,
        system: systemPrompt,
        messages: [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": question
                    }
                ]
            }
        ]
    });
    // console.log(msg);
    // console.log("Request complete.\nstop reason: "+msg.stop_reason);
    // console.log('Usage: '+msg.usage);
    return msg.content[0].text;
  }

async function askTheLlama (question, maxTokens = 4096) {
    const response = await ollama.generate({
        model: getCurrentLlamaModel(),
        prompt: question,
        stream: false,
        max_tokens: maxTokens,
        temperature: 0.0,
        // presence_penalty: 0.5,
        // frequency_penalty: 0.5
      });
    return response;
}

async function isOllamaActive() {
    try {
        const response = await fetch("http://localhost:11434/api/tags", {
            method: "GET",
        });
        return response.ok; //
    } catch (error) {
        return false; // (server not available)
    }
}

async function getStyleInfo(htmlContent){
    content = minimalizeHtml(htmlContent, 'text');
    const question = 'Here is a webpage describing an event (concert, expo, music):\n\n'
    + content
    + '\n\nTell what style of music is this event. Provide a general style (classic, pop-rock, electro, jazz, live, club, ...)'
    + ' and if possible a substyle (techno, hard techno, house, ...).'
    +' Important: provide the answer as a json: \{style:"XXX", substyle:"YYY"\}. ';
    const result = await askTheLlama(question);
    // console.log(result);

    return result.response;
}

function extractStyle(info){
    // console.log('info:', info);
    const jsonInfo = info.match(/\{[^\}]*\}/);
    if (!jsonInfo){
        return undefined;
    }
    // console.log('jsonInfo',jsonInfo[0]);
    const style = jsonInfo[0].match(/[ "]*style[ "]*:[ "]*(.*?),/);
    // console.log(style);
    const substyle = jsonInfo[0].match(/[ "]*substyle[ "]*:(.*?)[\n\}]/);
    // console.log(substyle);
    // console.log(style[1]+' ('+substyle[1]+')');
    return style[1].replace(/"/g,'').trim()+' ('+substyle[1].replace(/[",\[\]]/g,'').trim()+')';
}


module.exports = {askClaude, ollamaModelList, askTheLlama, isOllamaActive, getCurrentLlamaModel, getStyleInfo, extractStyle};

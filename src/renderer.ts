// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { AccountInfo } from "@azure/msal-browser";
import { InputData } from "./types/InputData";

/**
 * The renderer API is exposed by the preload script found in the preload.ts
 * file in order to give the renderer access to the Node API in a secure and 
 * controlled way
 */

const { ipcRenderer } =  require("electron");
const fs = require('fs');

//define html elements
//first screen
const signInButton = document.getElementById('signIn');
const welcomeDiv = document.getElementById('welcomeDiv');

//after login
const successfulLoginDiv = document.getElementById('successfulLoginDiv');

//input field div's
const projectNameDiv = document.getElementById('projectNameDiv');
const discussionDescriptionDiv = document.getElementById('discussionDescriptionDiv');
const submitInfoDiv = document.getElementById('submitInfoDiv');
const submitInfoButton = document.getElementById('submitInfoButton');

//input elements
const projectName = document.getElementById('projectName') as HTMLInputElement;
const discussionDescription = document.getElementById('discussionDescription') as HTMLInputElement;

//extend AccountInfo interface to fetch name
interface ExtendedAccountInfo extends AccountInfo {
    displayName?: string;
}

//add event listener for sign in button
signInButton!.addEventListener('click', async () => {

    //call main process to log in user
    await ipcRenderer.invoke('log-in').then((account: ExtendedAccountInfo) => {
        //change appearance of main window
        welcomeDiv!.remove();

        successfulLoginDiv!.hidden = false;

        const displayUserName = document.createElement('h1');
        const whichProject = document.createElement('p');

        whichProject.setAttribute('id', 'whichProjectP');

        displayUserName.innerHTML = `Hey ${account.displayName}!`;
        whichProject.innerHTML = 'What you worked on?';

        successfulLoginDiv!.appendChild(displayUserName);
        successfulLoginDiv!.appendChild(whichProject);

    });
    ipcRenderer.send('resize-main-window', 400, 400);
    ipcRenderer.send('hide-all-windows');
    ipcRenderer.send('start-fetching-user-status');
});

ipcRenderer.on('call-ended', () => {
    projectNameDiv!.hidden = false;
    discussionDescriptionDiv!.hidden = false;
    submitInfoDiv!.hidden = false;
});

//event listener for submit button
submitInfoButton!.addEventListener('click', () => {

    const whichProjectP = document.getElementById('whichProjectP');

    const projectNameValue = projectName.value;
    const discussionDescriptionValue = discussionDescription.value;

    console.log(`Project name: ${projectNameValue}`);
    console.log(`Description: ${discussionDescriptionValue}`);

    if (!projectNameValue) {
        whichProjectP!.innerHTML = 'Please enter project name';
        return;
    }

    const inputData = {
        projectName: projectNameValue,
        description: discussionDescriptionValue,
        timestamp: new Date()
    }

    ipcRenderer.invoke('get-data-file-path').then((dataFilePath: string) => {
        saveDataToFile(inputData, dataFilePath);
    });

    whichProjectP!.innerHTML = 'Data successfully saved, window will close shortly...';
    
    projectName.value = '';
    discussionDescription.value = '';
    
    setTimeout(() => {
        ipcRenderer.send('hide-all-windows')
    }, 2500);

});


//functions
//function for saving data with input parameters inputData(user's input) and dataFilePath(path to data.json file)
function saveDataToFile(inputData: InputData, dataFilePath: string) {

    fs.readFile(dataFilePath, 'utf8', (readErr: Error, data: string) => {
        if (readErr) {
            console.error('Error reading data:', readErr);
            return;
        }

        // Parse the JSON and get the existing callRecords array or create a new one if the file is empty
        let jsonData;
        try {
            jsonData = JSON.parse(data);
        } catch {
            jsonData = { callRecords: [] };
        }

        console.log(jsonData.callRecords);

        // Append the new inputData to the callRecords array
        jsonData.callRecords.push(inputData);

        fs.writeFile(dataFilePath, JSON.stringify(jsonData, null, 2), (err: Error) => {
            if (err) {
                console.error('Error saving data:', err);
            } else {
                console.log('Data saved successfully');
            }
        });
    });
}
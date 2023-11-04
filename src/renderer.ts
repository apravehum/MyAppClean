// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { AccountInfo } from "@azure/msal-browser";
import { InputData } from "./types/InputData";

const { ipcRenderer } =  require("electron");
const fs = require('fs');

//define html elements
//first screen
const signInButton = document.getElementById('signIn');
const welcomeDiv = document.getElementById('welcomeDiv');

//after login
const mainScreenDiv = document.getElementById('mainScreenDiv');
const mainScreenButtonDiv = document.getElementById('mainScreenButtonDiv');
const messageP = document.getElementById('messageP');
const viewReportButton = document.getElementById('viewReportButton');
const addActivityButton = document.getElementById('addActivityButton');
const greetingH1 = document.getElementById('greetingH1');
const addActivityBackButton = document.getElementById('addActivityBackButton');

//input field div's
const addActivityDiv = document.getElementById('addActivityDiv');
const submitInfoButton = document.getElementById('submitInfoButton');

//input elements
const projectName = document.getElementById('projectName') as HTMLInputElement;
const discussionDescription = document.getElementById('discussionDescription') as HTMLInputElement;

// View report elements
const viewReportBackButton = document.getElementById('viewReportBackButton');
const viewReportDiv = document.getElementById('viewReportDiv');
const projectFilter = document.getElementById('projectFilter');

// Renderer process variables
let callDuration: string;

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

        mainScreenDiv!.hidden = false;
        mainScreenButtonDiv!.hidden = false;

        // const displayUserName = document.createElement('h1');
        // const whichProject = document.createElement('p');
        // const reportButton = document.createElement('button');
        // const addActivityButton = document.createElement('button');

        // whichProject.setAttribute('id', 'messageP');
        // whichProject.hidden = true;

        // reportButton.setAttribute('class', 'button-right');

        greetingH1!.innerHTML = `Hey, ${account.displayName}!`;
        // whichProject.innerHTML = 'What you worked on?';
        // reportButton.innerHTML = 'View Report';
        // addActivityButton.innerHTML = 'Add Activity';

        // mainScreenDiv!.innerHTML = successfulLoginContent;

        // mainScreenDiv!.appendChild(displayUserName);
        // mainScreenDiv!.appendChild(whichProject);
        // mainScreenButtonDiv!.appendChild(addActivityButton);
        // mainScreenButtonDiv!.appendChild(reportButton);

    });
    ipcRenderer.send('resize-main-window', 400, 400);
    ipcRenderer.send('hide-all-windows');
    ipcRenderer.send('start-fetching-user-status');
});

ipcRenderer.on('call-ended', (event: Event, duration: number) => {
    callDuration = Math.round((duration / (1000 * 60))).toString();
    openAddActivityView();
});

//event listener for submit button
submitInfoButton!.addEventListener('click', () => {

    const projectNameValue = projectName.value;
    const discussionDescriptionValue = discussionDescription.value;

    console.log(`Project name: ${projectNameValue}`);
    console.log(`Description: ${discussionDescriptionValue}`);

    if (!projectNameValue) {
        messageP!.hidden = false;
        messageP!.innerHTML = 'Please enter project name';
        return;
    }

    if (!callDuration) {
        callDuration = "Not specified";
    }


    const inputData = {
        projectName: projectNameValue,
        description: discussionDescriptionValue,
        timestamp: new Date(),
        duration: callDuration
    }

    ipcRenderer.invoke('get-data-file-path').then((dataFilePath: string) => {
        saveDataToFile(inputData, dataFilePath);
    });

    messageP!.innerHTML = 'Data successfully saved, window will close shortly...';
    messageP!.hidden = false;
    
    projectName.value = '';
    discussionDescription.value = '';

    addActivityDiv!.hidden = true;
    
    setTimeout(() => {
        ipcRenderer.send('hide-all-windows');
        openMainScreenView();
    }, 2500);

});

// Add event listener for filtering by project
projectFilter!.addEventListener('change', async (event) => {
    const evenTarget = event.target as HTMLSelectElement;
    const selectedProject = evenTarget.value;
    const data = await readDataFromFile();

    const filteredData = selectedProject
        ? data.filter((item: InputData) => item.projectName === selectedProject)
        : data;

    populateReportTable(filteredData);
});

// Call the functions
viewReportButton!.addEventListener('click', async () => {
    mainScreenButtonDiv!.hidden = true;

    // Hide other divs
    document.getElementById('addActivityDiv')!.hidden = true;
  
    // Show viewReportDiv
    document.getElementById('viewReportDiv')!.hidden = false;
  
    // Read data from the JSON file
    const data = await readDataFromFile();

    console.log(data);
  
    // Populate the table and the project filter dropdown
    populateReportTable(data);
    populateProjectFilter(data);
});

// Add event listeners for sorting
document.querySelectorAll('th[data-sort]').forEach(headerElement => {
    const header = headerElement as HTMLElement;
    header.addEventListener('click', async () => {
        const sortBy = header.dataset.sort;
        const data = await readDataFromFile();
        const sortedData = data.sort((a: InputData, b: InputData) => {
            if (sortBy === 'date') {
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            } else {
                return a.projectName.localeCompare(b.projectName);
            }
        });
        populateReportTable(sortedData);
    });
});

addActivityButton!.addEventListener('click', () => {
    openAddActivityView();
});

addActivityBackButton!.addEventListener('click', () => {
    openMainScreenView();
});

viewReportBackButton!.addEventListener('click', () => {
    const projectFilter = document.getElementById('projectFilter') as HTMLSelectElement;
    projectFilter.innerHTML = `<option value="">All projects</option>`;
    openMainScreenView();
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

// Read data from file
async function readDataFromFile() {

    const path = await ipcRenderer.invoke('get-data-file-path');

    if (fs.existsSync(path)) {
        const data = fs.readFileSync(path);
        const parsedData = JSON.parse(data);
        return parsedData.callRecords;
    } else {
        return [];
    }
}

// Populate the table with data
function populateReportTable(data: InputData[]) {

    const tableBody = document.getElementById('reportTable')!.querySelector('tbody');
    tableBody!.innerHTML = '';
  
    data.forEach(item => {
        const row = document.createElement('tr');

        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(item.timestamp).toLocaleDateString();
        row.appendChild(dateCell);

        const projectCell = document.createElement('td');
        projectCell.textContent = item.projectName as string | null;
        row.appendChild(projectCell);

        const descriptionCell = document.createElement('td');
        descriptionCell.textContent = item.description as string | null;
        row.appendChild(descriptionCell);

        const durationCell = document.createElement('td');
        durationCell.textContent = item.duration.toString();
        row.appendChild(durationCell);

        tableBody!.appendChild(row);
    });
}

// Populate the filter dropdown with unique project names
function populateProjectFilter(data: InputData[]) {
    const projectFilter = document.getElementById('projectFilter') as HTMLSelectElement;
    const uniqueProjects = new Set<string>(data.map((item: InputData) => item.projectName));
  
    uniqueProjects.forEach((projectName: string) => {
        const option = document.createElement('option') as HTMLOptionElement;
        option.value = projectName;
        option.textContent = projectName;
        projectFilter.appendChild(option);
    });
}

function openAddActivityView() {
    mainScreenButtonDiv!.hidden = true;
    addActivityDiv!.hidden = false;
}

function openMainScreenView() {
    mainScreenButtonDiv!.hidden = false;
    addActivityDiv!.hidden = true;
    messageP!.hidden = true;
    viewReportDiv!.hidden = true;
}
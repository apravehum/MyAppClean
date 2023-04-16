/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as path from "path";
import { app, ipcMain, BrowserWindow, Tray, Menu } from "electron";
import { AuthProvider } from "./AuthProvider";
import { protectedResources, msalConfig } from "./authConfig";
import { getGraphClient } from "./graph";
import { presenceConfig } from "./types/presenceConfig";

let authProvider = new AuthProvider(msalConfig);
let mainWindow: BrowserWindow;
let userID: string;
let tray: Tray | null;
let fetchUserStatusInterval: NodeJS.Timeout;
let appIsQuitting = false;
let previousUserStatus = '';

//events
//load main window
app.on("ready", () => {
    createWindow();
    mainWindow.loadFile(path.join(__dirname, "../index.html"));
    createTray();
});

//close 
app.on("window-all-closed", () => {
    app.quit();
});

//prevent multiple windows to be loaded
app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

//handle login event
ipcMain.handle('log-in', async () => {
    const account = await authProvider.login();

    const tokenRequest = {
        scopes: ["User.Read", "Presence.Read.All", "Presence.Read", "offline_access"]
    };

    const tokenResponse = await authProvider.getToken(tokenRequest);

    const me = await getGraphClient(tokenResponse.accessToken)
        .api(protectedResources.graphMe.endpointme).get();

    userID = me.id;

    return me;

});

//user status fetch event
ipcMain.on('start-fetching-user-status', async () => {

    const tokenRequest = {
        scopes: ["User.Read", "Presence.Read.All", "Presence.Read"]
    };

    const apiURL = protectedResources.graphMe.endpointstatus.replace('${userID}', userID);

    // Function to fetch the user's status
    async function fetchUserStatus() {
        const tokenResponse = await authProvider.getToken(tokenRequest);
        const graphResponse = await getGraphClient(tokenResponse.accessToken)
        .api(apiURL)
        // .api(protectedResources.graphMe.endpointStatusWOURL)
        .get();
        // Replace this with the actual code to fetch the user's status using Microsoft Graph client
        console.log(`Current status is: ${graphResponse.activity}`);

        if (isCallEnded(graphResponse)) {
            mainWindow.webContents.send('call-ended');
            mainWindow.show();
        }

        previousUserStatus = graphResponse.activity;
    }

    // Call the function initially
    fetchUserStatus();

    // Set an interval to call the function every 10 seconds (10000 milliseconds)
    fetchUserStatusInterval = setInterval(fetchUserStatus, 3000);

});

//hide all windows function
ipcMain.on('hide-all-windows', () => {
    console.log("Hide event started...");
    // Get all open windows
    const windows = BrowserWindow.getAllWindows();

    // Hide each open window
    for (const win of windows) {
        win.hide();
    }
});

//event for resizing browser window
ipcMain.on('resize-main-window', (event, width, height) => {
    console.log("Resize event started...");
    mainWindow.setSize(width, height);
});

//event for fetching data.json file path
ipcMain.handle('get-data-file-path', () => {
    // Get the path to the user's app data folder
    const userDataPath = app.getPath('userData');
    // Create a path to the data.json file inside the app data folder
    const dataFilePath = path.join(userDataPath, 'data.json');
    return dataFilePath;
});



//functions
//main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 200,
        autoHideMenuBar: true,
        webPreferences: { 
            contextIsolation: false,
            nodeIntegration: true
        },
        icon: path.join(__dirname, '../time.png')
    });

    mainWindow.on('close', (event: Event) => {
        if (!appIsQuitting) {
            event.preventDefault();
            mainWindow.hide();
        } else {
            app.quit();
        }
    });
}

//tray
function createTray() {
    try {
        tray = new Tray(path.join(__dirname, '../time.png'));

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => {
                    mainWindow.show();
                },
            },
            {
                label: 'Exit',
                click: () => {
                    appIsQuitting = true;
                    clearInterval(fetchUserStatusInterval);
                    app.quit();
                },
            },
        ]);

        tray.setToolTip('Tray App');
        tray.setContextMenu(contextMenu);

        tray.on('double-click', () => {
            mainWindow.show();
        });
    } catch (error) {
        console.error('Error creating tray:', error);
    }
}

//Checks if call ended by comparing old status to new status
function isCallEnded(graphResponse: {activity: string}) {
    if (presenceConfig.inACallStatusArray.includes(previousUserStatus) && presenceConfig.notInACallStatusArray.includes(graphResponse.activity)) {
        return true;
    } else {
        return false;
    }
}

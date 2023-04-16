// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

const { contextBridge, ipcRenderer } = require('electron');
import { EventEmitter } from 'events';

/**
 * This preload script exposes a "renderer" API to give
 * the Renderer process controlled access to some Node APIs
 * by leveraging IPC channels that have been configured for
 * communication between the Main and Renderer processes.
 */

const eventEmitter = new EventEmitter();

contextBridge.exposeInMainWorld('eventEmitter', eventEmitter);

ipcRenderer.on('SHOW_WELCOME_MESSAGE', (event, ...args) => {
    eventEmitter.emit('showWelcomeMessage', event, ...args);
});

ipcRenderer.on('SET_PROFILE', (event, ...args) => {
    eventEmitter.emit('handleProfileData', event, ...args);
});

eventEmitter.on('sendLoginMessage', () => {
    ipcRenderer.send('LOGIN');
});

eventEmitter.on('sendSignoutMessage', () => {
    ipcRenderer.send('LOGOUT');
});

eventEmitter.on('sendSeeProfileMessage', () => {
    ipcRenderer.send('GET_PROFILE');
});
'use strict';

import { join } from 'path';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';

import { getCurrent } from './settings';
import { devPort } from '../../script/config';

const isDev = process.env.NODE_ENV === 'development';

let shouldAppQuit = true;
/** @type {BrowserWindow} */
let mainWindow;
const mainURL = isDev ? `http://localhost:${devPort}` : `file://${__dirname}/index.html`;
/** @type {BrowserWindow} */
let loginWindow;
let loginURL = isDev ? `http://localhost:${devPort}/login.html` : `file://${__dirname}/login.html`;

function createMainWindow(url = mainURL) {
    const settings = getCurrent();

    const win = new BrowserWindow({
        height: 700,
        width: 1000,
        frame: settings.windowBorder,
        titleBarStyle: settings.windowBorder ? 'default' : 'hidden',
        name: 'Electron Netease Cloud Music',
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            nodeIntegration: isDev,
            webgl: false,
            webviewTag: false,
            additionalArguments: [`--initial-settings=${JSON.stringify(settings)}`]
        }
    });

    switch (process.platform) {
        case 'linux':
            require('./mpris').bindWebContents(win.webContents);
            break;
        case 'darwin':
            win.on('close', ev => {
                ev.preventDefault();
                win.hide();
            });
            break;
    }

    win.loadURL(url);

    return win;
}

app.on('ready', () => {
    // do not display default menu bar
    isDev ? null : Menu.setApplicationMenu(null);
    mainWindow = createMainWindow();
    // boot up ApiHost
    require('./apiHost');
});

app.on('window-all-closed', () => {
    if (shouldAppQuit) {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (process.platform === 'darwin') {
        // quit safely on macOS
        mainWindow.removeAllListeners('close');
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        mainWindow = createMainWindow();
        return;
    }
    mainWindow.show();
});

ipcMain.on('recreateWindow', (event, url) => {
    shouldAppQuit = false;
    mainWindow.close();
    mainWindow = createMainWindow(url);
    shouldAppQuit = true;
});

ipcMain.on('showLoginWindow', () => {
    loginWindow = new BrowserWindow({
        height: 700,
        width: 1150,
        name: 'Login'
    });
    loginWindow.loadURL(loginURL);
});

ipcMain.on('focusApp', () => {
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.focus();
});

ipcMain.on('quitApp', () => app.quit());

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const { PublicClientApplication, InteractionRequiredAuthError } = require('@azure/msal-node');
import { AccountInfo, Configuration, AuthorizationCodeRequest, AuthenticationResult } from '@azure/msal-browser';
import { BrowserWindow } from 'electron';
import path from "path";
const { shell } = require('electron');

interface ExtendedAuthorizationCodeRequest extends AuthorizationCodeRequest {
    account?: AccountInfo;
}

// interface SilentAuthorizationCodeRequest extends AuthorizationCodeRequest {
//     account: AccountInfo;
// }

export class AuthProvider {
    msalConfig;
    clientApplication;
    account: AccountInfo | null;
    cache;

    constructor(msalConfig: Configuration) {
        /**
         * Initialize a public client application. For more information, visit:
         * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/initialize-public-client-application.md
         */
        this.msalConfig = msalConfig;
        this.clientApplication = new PublicClientApplication(this.msalConfig);
        this.cache = this.clientApplication.getTokenCache();
        this.account = null;
    }

    async login() {
        const authResponse = await this.getToken({
            // If there are scopes that you would like users to consent up front, add them below
            // by default, MSAL will add the OIDC scopes to every token request, so we omit those here
            scopes: ['User.Read'],
        });

        return this.handleResponse(authResponse!);
    }

    async logout() {
        if (!this.account) return;

        try {
            /**
             * If you would like to end the session with AAD, use the logout endpoint. You'll need to enable
             * the optional token claim 'login_hint' for this to work as expected. For more information, visit:
             * https://learn.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
             */
            if (this!.account!.idTokenClaims!.hasOwnProperty('login_hint')) {
                await shell.openExternal(`${this.msalConfig.auth.authority}/oauth2/v2.0/logout?logout_hint=${encodeURIComponent(this!.account!.idTokenClaims!.login_hint || '')}`);
            }

            await this.cache.removeAccount(this.account);
            this.account = null;
        } catch (error) {
            console.log(error);
        }
    }

    async getToken(tokenRequest: ExtendedAuthorizationCodeRequest) {
        let authResponse;
        const account = this.account || (await this.getAccount());

        if (account) {
            tokenRequest.account =  account;
            authResponse = await this.getTokenSilent(tokenRequest);
        } else {
            authResponse = await this.getTokenInteractive(tokenRequest);
        }

        return authResponse || null;
    }

    async getTokenSilent(tokenRequest: AuthorizationCodeRequest) {
        try {
            return await this.clientApplication.acquireTokenSilent(tokenRequest);
        } catch (error) {
            if (error instanceof InteractionRequiredAuthError) {
                console.log('Silent token acquisition failed, acquiring token interactive');
                return await this.getTokenInteractive(tokenRequest);
            }

            console.log(error);
        }
    }

    async getTokenInteractive(tokenRequest: AuthorizationCodeRequest) {
        try {
            let authWindow: BrowserWindow | null;

            const openBrowser = async (url: string) => {
                authWindow = new BrowserWindow({
                    width: 600,
                    height: 600,
                    autoHideMenuBar: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                    },
                    title: "Teams Call Tracking",
                    icon: path.join(__dirname, '../time.png'), // Add this line
                });

                console.log(url);

                await authWindow.loadURL(url);

                authWindow.on('closed', () => {
                    authWindow = null;
                });
            };

            const authResponse = await this.clientApplication.acquireTokenInteractive({
                ...tokenRequest,
                openBrowser,
                successTemplate: '<h1>Successfully signed in!</h1> <p>You can close this window now.</p>',
                errorTemplate: '<h1>Oops! Something went wrong</h1> <p>Check the console for more information.</p>',
            });

            return authResponse;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Handles the response from a popup or redirect. If response is null, will check if we have any accounts and attempt to sign in.
     * @param response
     */
    async handleResponse(response: AuthenticationResult) {
        if (response !== null) {
            this.account = response.account;
        } else {
            this.account = await this.getAccount();
        }

        return this.account;
    }

    /**
     * Calls getAllAccounts and determines the correct account to sign into, currently defaults to first account found in cache.
     * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/Accounts.md
     */
    async getAccount() {
        const currentAccounts = await this.cache.getAllAccounts();

        if (!currentAccounts) {
            console.log('No accounts detected');
            return null;
        }

        if (currentAccounts.length > 1) {
            // Add choose account code here
            console.log('Multiple accounts detected, need to add choose account code.');
            return currentAccounts[0];
        } else if (currentAccounts.length === 1) {
            return currentAccounts[0];
        } else {
            return null;
        }
    }
}


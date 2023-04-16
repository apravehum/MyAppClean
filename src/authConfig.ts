/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel } from "@azure/msal-node";

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
 */
const AAD_ENDPOINT_HOST = "https://login.microsoftonline.com/"; // include the trailing slash

export const msalConfig = {
    auth: {
        clientId: "afd3b2fb-2ac7-4fea-bca5-1545cb840f39",
        authority: `${AAD_ENDPOINT_HOST}common`,
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel: LogLevel, message: string, containsPii: boolean) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: LogLevel.Verbose,
        },
    },
};

/**
 * Add here the endpoints and scopes when obtaining an access token for protected web APIs. For more information, see:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/resources-and-scopes.md
 */
const GRAPH_ENDPOINT_HOST = "https://graph.microsoft.com/"; // include the trailing slash

export const protectedResources = {
    graphMe: {
        endpointme: `${GRAPH_ENDPOINT_HOST}v1.0/me`,
        endpointstatus: 'users/${userID}/presence',
        scopes: ["User.Read", "Presence.Read.All", "Presence.Read"]
    }
};
const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const rpc = require("vscode-jsonrpc");

let bootstrapForkPath = path.join(__dirname, "..", "out", "bootstrap-fork.js");

let extensionPath = path.join(__dirname, "..", "extensions", "oni-api-tests", "package.json");

import * as ExtensionHost from "./ExtensionHost";

describe("initialization", () => {
    test("extension host process gets initialized", async () => {

        await ExtensionHost.withExtensionHost([], async (api) => {
            // expect(true).toBe(true);
            await api.start();
            return Promise.resolve();
        });
    });
});

describe("activation", () => {
    test("get activation event for '*' activation type", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
            let promise = new Promise((c) => {

                api.onMessage.subscribe(msg => {
                    const { payload } = msg;  

                    if(payload.methodName == "$onDidActivateExtension") {
                        console.dir(payload);
                        c();
                    }
                });
                
            });

            await api.start();

            await promise;
        });
    });
});

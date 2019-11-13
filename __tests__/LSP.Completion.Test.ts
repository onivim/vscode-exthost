import * as path from "path";
import * as assert from "assert";

import * as ExtensionHost from "./ExtensionHost";
import { ExtendedAPIPlugin } from 'webpack';
import { isExportDeclaration } from 'typescript';

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-lsp-extension", "package.json");

describe("LSP", () => {
    describe("Completion", () => {
        it("registers suggest support", async () => {
            await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
                let extensionActivationPromise = api.waitForMessageOnce("MainThreadExtensionService", "$onDidActivateExtension");

                let onRegisterSuggest = () => api.waitForMessageOnce("MainThreadLanguageFeatures", "$registerSuggestSupport", (v) => {
                    console.log("onRegisterSuggest: " + JSON.stringify(v));
                    return true;
                });

                await api.start();
                await extensionActivationPromise;

                let uri = {
                    scheme: "file",
                    path: "D:/test1.txt"
                };

                api.createDocument(uri, ["hello", "world"], "plaintext");

                await onRegisterSuggest();
            });
        });
        it("gets suggestions", async () => {
            await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
                let extensionActivationPromise = api.waitForMessageOnce("MainThreadExtensionService", "$onDidActivateExtension");

                let onRegisterSuggest = () => api.waitForMessageOnce("MainThreadLanguageFeatures", "$registerSuggestSupport", (v) => {
                    return true;
                });

                await api.start();
                await extensionActivationPromise;

                let uri = {
                    scheme: "file",
                    path: "D:/test1.txt"
                };

                api.createDocument(uri, ["hello", "world"], "plaintext");

                await onRegisterSuggest();

                const { suggestions } = await api.provideCompletionItems(0, uri, { lineNumber: 1, column: 1 }, {});
                assert(suggestions.length == 2);
            });
        });
    });
});

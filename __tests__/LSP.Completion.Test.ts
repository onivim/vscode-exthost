import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-lsp-extension", "package.json");

describe.only("LSP", () => {
    describe("Completion", () => {

        it("registers suggest support", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
            let extensionActivationPromise = api.waitForMessageOnce("MainThreadExtensionService", "$onDidActivateExtension");

            let onRegisterSuggest = () => api.waitForMessageOnce("MainThreadLanguageFeatures", "$registerSuggestSupport", (v) => {
                console.log("!!!! " + JSON.stringify(v));
                return true;
            });

            await api.start();
            await extensionActivationPromise;

            let uri = {
                scheme: "file",
                path: "D:/test1.txt"
            };

            api.createDocument(uri, ["hello", "world"], "plaintext");



            // Updating so the "GREETINGS" is all uppercase should trigger a diagnostics
            api.updateDocument(uri, {startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 6}, "GREETINGS", 100);

            await onRegisterSuggest();

        });

        });
    });
});

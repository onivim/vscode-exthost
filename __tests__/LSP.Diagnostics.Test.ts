import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-lsp-extension", "package.json");

describe("LSP", () => {
    describe("Diagnostics", () => {

        it("gets diagnostics after update", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
            let extensionActivationPromise = api.waitForMessageOnce("MainThreadExtensionService", "$onDidActivateExtension");

            let onEmptyDiagnostics = () => api.waitForMessageOnce("MainThreadDiagnostics", "$changeMany", (v) => {
                let [_collectionName, entries] = v;

                let [[uri, diagnostics]] = entries;

                return uri.path.indexOf("test1.txt") >= 0 && diagnostics.length === 0;
            });

            let onSomeDiagnostics = api.waitForMessageOnce("MainThreadDiagnostics", "$changeMany", (v) => {
                let [_collectionName, entries] = v;

                let [[uri, diagnostics]] = entries;

                return uri.path.indexOf("test1.txt") >= 0 && diagnostics.length >= 1;
            });

            await api.start();
            await extensionActivationPromise;

            let uri = {
                scheme: "file",
                path: "D:/test1.txt"
            };

            api.createDocument(uri, ["hello", "world"], "plaintext");


            await onEmptyDiagnostics();
            // Updating so the "GREETINGS" is all uppercase should trigger a diagnostics
            api.updateDocument(uri, {startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 6}, "GREETINGS", 100);

            await onSomeDiagnostics;

            // ...and then fixing so its back to lowercase should remove the diagnostic
            api.updateDocument(uri, {startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 6}, "lowercase", 100);
            await onEmptyDiagnostics();
        });
            
        });
    });
});

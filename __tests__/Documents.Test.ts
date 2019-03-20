import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "extensions", "oni-api-tests", "package.json");

describe("documents", () => {
    test("opening / closing document fires respective events", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
            let extensionActivationPromise = api.waitForMessageOnce("MainThreadExtensionService", "$onDidActivateExtension");

            let separator = process.platform === "win32" ? "\\" : "/"

            let onOpenPromise = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (v) => {
                let [_, data] = v;
                let info = JSON.parse(data);

                return info.type === "workspace.onDidOpenTextDocument" && info.filename == "D:" + separator + "test1.txt";
            })

            let onClosePromise = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (v) => {
                let [_, data] = v;
                let info = JSON.parse(data);

                return info.type === "workspace.onDidCloseTextDocument" && info.filename == "D:" + separator + "test1.txt";
            })

            await api.start();
            await extensionActivationPromise;

            let testModelAdded = {
                uri: {
                    scheme: "file",
                    path: "D:/test1.txt",
                },
                lines: ["hello", "world"],
                EOL: "\n",
                modeId: "plaintext",
                isDirty: true,
            };

            let update = {
                removedDocuments: [],
                addedDocuments: [testModelAdded],
                removedEditors: [],
                addedEditors: [],
                newActiveEditor: null,
            };

            api.sendNotification(["ExtHostDocumentsAndEditors", "$acceptDocumentsAndEditorsDelta", [update]]);

            await onOpenPromise;

            let closeUpdate = {
                removedDocuments: [testModelAdded.uri],
                addedDocuments :[],
                removedEditors: [],
                addedEditors: [],
                newActiveEditor: null,
            }

            api.sendNotification(["ExtHostDocumentsAndEditors", "$acceptDocumentsAndEditorsDelta", [closeUpdate]]);

            await onClosePromise;
        });
    });

    test("changing a document fires appropriate event", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
            let extensionActivationPromise = api.waitForMessageOnce("MainThreadExtensionService", "$onDidActivateExtension");

            let separator = process.platform === "win32" ? "\\" : "/"

            let onChangePromise = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (v) => {
                let [_, data] = v;
                let info = JSON.parse(data);

                return info.type === "workspace.onDidChangeTextDocument" && info.fullText == "Greetings\nworld";
            })

            await api.start();
            await extensionActivationPromise;

            let testModelAdded = {
                uri: {
                    scheme: "file",
                    path: "D:/test1.txt",
                },
                lines: ["hello", "world"],
                EOL: "\n",
                modeId: "plaintext",
                isDirty: true,
            };

            let update = {
                removedDocuments: [],
                addedDocuments: [testModelAdded],
                removedEditors: [],
                addedEditors: [],
                newActiveEditor: null,
            };

            api.sendNotification(["ExtHostDocumentsAndEditors", "$acceptDocumentsAndEditorsDelta", [update]]);

            let changedEvent = {
                changes: [{
                    range: {
                        startLineNumber: 1,
                        endLineNumber: 1,
                        startColumn: 1,
                        endColumn: 6,
                    },
                    text: "Greetings",
                }],
                eol: "\n",
                versionId: 100,
            };

            api.sendNotification(["ExtHostDocuments", "$acceptModelChanged", [testModelAdded.uri, changedEvent, true]]);

            await onChangePromise;
        });
    });
});

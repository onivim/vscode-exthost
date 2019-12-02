import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-api-tests", "package.json");

describe("workspace", () => {
    test("verify root folder is set correctly", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {

            /*
             * Upon activation, we should get a notification from the extension host
             */
            let commandRegistrationPromise = api.waitForMessageOnce("MainThreadCommands", "$registerCommand", (args) => args.indexOf("extension.showWorkspaceRootPath") >= 0);

            let showMessagePromise = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (args) => {
                console.log("MESSAGE: " + args[1]);
                return args[1] == '/some/folder' || /* Windows */ args[1] == '\\some\\folder';
            });

            await api.start();

            await commandRegistrationPromise;

            api.executeContributedCommand("extension.showWorkspaceRootPath");

            await showMessagePromise;
        });
    });
    test("verify workspace folder can be changed", async() => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {

            /*
             * Upon activation, we should get a notification from the extension host
             */
            let commandRegistrationPromise = api.waitForMessageOnce("MainThreadCommands", "$registerCommand", (args) => args.indexOf("extension.showWorkspaceRootPath") >= 0);

            let initialWorkspaceLoadMessage = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (args) => {
                console.log("MESSAGE: " + args[1]);
                return args[1] == '/some/folder' || /* Windows */ args[1] == '\\some\\folder';
            });

            await api.start();

            await commandRegistrationPromise;

            api.executeContributedCommand("extension.showWorkspaceRootPath");

            await initialWorkspaceLoadMessage;

            api.acceptWorkspaceData({
                path: '/some/other/folder',
                scheme: 'file'
            }, "another-folder-id", "another-folder-name");

            let workspaceChangedMessage = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (args) => {
                console.log("MESSAGE: " + args[1]);
                // Check that a workspace was added, and removed -
                // this is sent in the message from the extenssion
                return args[1] == 'workspace changed:1|1';
            });

            await workspaceChangedMessage;

            let newWorkspaceMessage = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (args) => {
                console.log("MESSAGE: " + args[1]);
                return args[1] == '/some/other/folder' || /* Windows */ args[1] == '\\some\\other\\folder';
            });

            api.executeContributedCommand("extension.showWorkspaceRootPath");

            await newWorkspaceMessage;
        });
    });
});

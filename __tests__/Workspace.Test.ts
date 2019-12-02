import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-api-tests", "package.json");

describe("workspace", () => {
    test("execute basic command", async () => {
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

            // ...otherwise this call will fail.
            api.sendNotification(
                ["ExtHostCommands", "$executeContributedCommand", ["extension.showWorkspaceRootPath"]]
            );

            await showMessagePromise;
        });
    });
});

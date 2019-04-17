import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-api-tests", "package.json");

describe("commands", () => {
    test.only("execute basic command", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {

            /*
             * Upon activation, we should get a notification from the extension host
             * that the 'extension.helloWorld' command is available.
             */
            let commandRegistrationPromise = api.waitForMessageOnce("MainThreadCommands", "$registerCommand", (args) => args.indexOf("extension.helloWorld") >= 0);

            let showMessagePromise = api.waitForMessageOnce("MainThreadMessageService", "$showMessage");

            await api.start();

            // Wait for the 'extension.helloWorld' command to be registered...
            await commandRegistrationPromise;

            // ...otherwise this call will fail.
            api.sendNotification(
                ["ExtHostCommands", "$executeContributedCommand", ["extension.helloWorld"]]
            );

            await showMessagePromise;
        });
    });
});

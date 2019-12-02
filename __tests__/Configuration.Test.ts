import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-api-tests", "package.json");

describe("configuration", () => {
    test("verify initial configuration setting comes through", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {

            /*
             * Upon activation, we should get a notification from the extension host
             */
            let commandRegistrationPromise = api.waitForMessageOnce("MainThreadCommands", "$registerCommand", (args) => args.indexOf("config.showSuggestEnabled") >= 0);

            let showConfigurationValuePromise = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (args) => {
                console.log("MESSAGE: " + args[1]);
                return args[1] == 'true';
            });

            await api.start();

            await commandRegistrationPromise;

            api.executeContributedCommand("config.showSuggestEnabled");

            await showConfigurationValuePromise;
        });
    });
});

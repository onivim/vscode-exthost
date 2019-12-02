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

    test("verify changing configuration works as expected", async () => {
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

            const newConfig = {
                defaults: {
                    contents: {
                        suggest: {
                            enabled: false
                        }
                    },
                    keys: ["suggest.enabled"],
                    overrides: [],
                },
                user: {},
                workspace: {},
                folders: {},
                isComplete: true,
                configurationScopes: {},
             };

          const changeData = {
            changedConfiguration:  {
                contents: {
                    suggest: {
                        enabled: false,
                    }
                },
                keys: ["suggest.enabled"],
                overrides: [],
            },
            changedConfigurationByResource: {},
          };

            api.acceptConfigurationChanged(newConfig, changeData);
            let showConfigurationValueAgainPromise = api.waitForMessageOnce("MainThreadMessageService", "$showMessage", (args) => {
                console.log("MESSAGE: " + args[1]);
                return args[1] == 'false';
            });

            api.executeContributedCommand("config.showSuggestEnabled");

            await showConfigurationValueAgainPromise;
        });
    });
});

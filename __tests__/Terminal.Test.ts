import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-api-tests", "package.json");

describe("Terminal", () => {
    test("Verify we get a response for a command that does not exist", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {

            /*
             * Upon activation, we should get a notification from the extension host
             */
            let commandRegistrationPromise = api.waitForMessageOnce("MainThreadCommands", "$registerCommand", (args) => args.indexOf("config.showSuggestEnabled") >= 0);

            let terminalSendProcessTitle = 
            api.waitForMessageOnce("MainThreadTerminalService", "$sendProcessTitle", (args) => {
                console.log("$sendProcessTitle: " + args[1]);
                return true;
            });

            let terminalSendProcessData = 
            api.waitForMessageOnce("MainThreadTerminalService", "$sendProcessData", (args) => {
                console.log("$sendProcessData: " + args[1]);
                return true;
            });

            await api.start();

            api.terminalCreateProcess(1, {
                name: "Terminal 1",
                executable: "/non-existent-item",
                args: [],
            },
            20, 
            20);

            await terminalSendProcessTitle;
            await terminalSendProcessData;
        });
    });
});

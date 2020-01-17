import * as path from "path";

import * as ExtensionHost from "./ExtensionHost";

let extensionPath = path.join(__dirname, "..", "test_extensions", "oni-api-tests", "package.json");

describe("Terminal", () => {
    test("Verify we get a $sendProcessExit for a command that does not exist", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {

            let terminalSendProcessExit = 
            api.waitForMessageOnce("MainThreadTerminalService", "$sendProcessExit", (args) => {
                console.log("$sendProcessExit: " + args[1]);
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

            await terminalSendProcessExit;
        });
    });
});

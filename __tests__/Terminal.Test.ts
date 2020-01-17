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
    
    test("Verify we get a $sendProcessData / $sendProcessTitle for a command that works", async () => {
        await ExtensionHost.withExtensionHost([extensionPath], async (api) => {
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

            let terminalSendProcessExit = 
                api.waitForMessageOnce("MainThreadTerminalService", "$sendProcessExit", (args) => {
                    console.log("$sendProcessExit: " + args[1]);
                    return true;
                });

            let terminalArgs: any = null;
            if(process.platform == "win32") {
               terminalArgs = {
                name: "Windows Terminal",
                executable: "cmd.exe",
                args: ["/c", "echo", "hello"]
               }
            } else {
    
               terminalArgs = {
                name: "Bash Terminal",
                executable: "bash",
                args: ["-c", "echo hello"]
               }
            }

            await api.start();

            api.terminalCreateProcess(
                1,
                terminalArgs,
                20, 
                20);

            await terminalSendProcessTitle;
            await terminalSendProcessData;
            await terminalSendProcessExit;
        });
    });
});

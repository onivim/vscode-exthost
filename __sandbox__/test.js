const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const rpc = require("vscode-jsonrpc");

let bootstrapForkPath = path.join(__dirname, "..", "out", "bootstrap-fork.js");

// test("extension host process gets initialized", async () => {

let run = async () => {

    let childProcess = cp.spawn("node", [bootstrapForkPath, "--type=extensionHost"], {
        env: {
            ...process.env,
            "AMD_ENTRYPOINT": "vs/workbench/services/extensions/node/extensionHostProcess",
        },
        stdio: ["pipe", "pipe", "inherit"]
    });

    let connection = rpc.createMessageConnection(
        new rpc.StreamMessageReader(childProcess.stdout),
        new rpc.StreamMessageWriter(childProcess.stdin)
    );

    let promise = new Promise((c) => {

        let testNotification = new rpc.NotificationType('host/msg');
        connection.onNotification(testNotification, (msg) => {
            console.log("INCOMING MESSAGE: " + JSON.stringify(msg));

            let message = msg;
            if (message.reqId > 0) {
                connection.sendNotification('ext/msg', {
                    type: 12, /*ReplyOKJSON */
                    reqId: message.reqId,
                    payload: null,
                });
            }

            c();
        });

    });
    connection.listen();

    let extensionPath = path.join(__dirname, "..", "extensions", "oni-api-tests", "package.json")
    let testExtension = JSON.parse(fs.readFileSync(extensionPath));

    testExtension.main = path.join(extensionPath, "..", "extension.js");

    let extMessage = new rpc.NotificationType('ext/msg');
    connection.sendNotification(extMessage, {
        type: 0,
        reqId: 1,
        payload: {
            // extensions: [],
            extensions: [{
                ...testExtension,
                identifier: "Hello",
                extensionLocationPath: extensionPath,
            }],
            parentPid: process.pid,
            environment: {
                globalStorageHomePath: require("os").tmpdir(),
            },
            workspace: {},
            logsLocationPath: require("os").tmpdir(),
            autoStart: true,
        }
    });

    connection.sendNotification(extMessage, {
        type: 4, /* RequestJSONArgs */
        reqId: 2,
        payload: ["ExtHostConfiguration", "$initializeConfiguration", [{}]],
    });

    connection.sendNotification(extMessage, {
        type: 4, /* RequestJSONArgs */
        reqId: 2,
        payload: ["ExtHostWorkspace", "$initializeWorkspace", [{
            id: "workspace-test",
            name: "workspace-test",
            configuration: null,
            folders: [],
        }]],
    });

    // await promise;
    // console.log("HEY");
    // setTimeout(() => {
    //     connection.sendNotification(extMessage, {
    //         type: 4,
    //         reqId: 3,
    //         payload: ["ExtHostCommands", "$executeContributedCommand", ["extension.helloWorld"]],
    //     });
    // }, 1000);


    let closePromise = new Promise((c) => {
        connection.onClose(() => c());
    })

    // connection.sendNotification(extMessage, {
    //     type: 1,
    //     payload: null,
    // });

    await closePromise;
};

run();
// }, 10000);

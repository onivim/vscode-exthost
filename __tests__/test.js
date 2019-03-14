const cp = require("child_process");
const path = require("path");
const rpc = require("vscode-jsonrpc");

let bootstrapForkPath = path.join(__dirname, "..", "out", "bootstrap-fork.js");

test("extension host process gets initialized", async () => {

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

    let promise =  new Promise((c) => {

    let testNotification = new rpc.NotificationType('host/msg');
        connection.onNotification(testNotification, () => {
            c();
        });

    });
    connection.listen();

    let extMessage = new rpc.NotificationType('ext/msg');
    connection.sendNotification(extMessage, {
        type: 0,
        payload: {
            extensions: [],
            environment: {},
            workspace: {},
            logsLocationPath: require("os").tmpdir(),
        }
    });

    await promise;

    let closePromise = new Promise((c) => {
        connection.onClose(() => c());
    })

    connection.sendNotification(extMessage, {
        type: 1,
        payload: null,
    });

    await closePromise;
});

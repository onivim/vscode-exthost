/*
 * ExtensionHost.ts
 *
 * Helper API for testing / exercising an extension host
 */

import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as rpc from "vscode-jsonrpc";

let bootstrapForkPath = path.join(__dirname, "..", "out", "bootstrap-fork.js");

export const enum MessageType {
    Initialized = 0,
    Ready = 1,
    InitData = 2,
    Terminate = 3,
    RequestJSONArgs = 4,
    RequestJSONArgsWithCancellation = 5,
    RequestMixedArgs = 6,
    RequestMixedArgsWithCancellation = 7,
    Acknowledged = 8,
    Cancel = 9,
    ReplyOKEmpty = 10,
    ReplyOKBuffer = 11,
    ReplyOKJSON = 12,
    ReplyErrError = 13,
    ReplyErrEmpty = 14,
};

import { EventEmitter } from "events"

export interface IDisposable {
    dispose(): void
}

export interface ChangedEventRange {
    startLineNumber: number,
    endLineNumber: number,
    startColumn: number,
    endColumn: number,
}

export type DisposeFunction = () => void

export type EventCallback<T> = (value: T) => void

export interface IEvent<T> {
    subscribe(callback: EventCallback<T>): IDisposable
}

export class Event<T> implements IEvent<T> {

    private _name: string
    private _eventObject: EventEmitter = new EventEmitter()

    constructor(name?: string) {
        this._name = name || "default_event"
    }

    public subscribe(callback: EventCallback<T>): IDisposable {
        this._eventObject.addListener(this._name, callback)

        const dispose = () => {
            this._eventObject.removeListener(this._name, callback)
        }

        return { dispose }
    }

    public dispatch(val?: T): void {
        this._eventObject.emit(this._name, val)
    }
}

type filterFunc = (payload: any) => boolean;

export interface IExtensionHost {

    start: () => Promise<void>;

    sendNotification: (payload: any) => void;

    waitForMessageOnce: (rpcName: string, methodName: string, filter?: filterFunc) => Promise<void>;

    createDocument: (uri: any, lines: string[], modeId: string) => void;
    updateDocument: (uri: any, range: ChangedEventRange, text: string, version: number) => void;

    provideCompletionItems: (handle: number, resource: any, position: any, context: any) => Promise<any>;

    onMessage: IEvent<any>;
}


type apiFunction = (api: IExtensionHost) => Promise<void>;

export let withExtensionHost = async (extensions: string[], f: apiFunction) => {
    let incomingNotification = new rpc.NotificationType<any, any>('host/msg');
    let outgoingNotification = new rpc.NotificationType<any, any>('ext/msg');

    let pendingCallbacks: { [key: number]: any } = {};
    let requestId = 0;

    let onMessageEvent = new Event<any>();

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
        connection.onNotification(incomingNotification, (msg) => {

            if (msg.type === MessageType.Ready) {
                c();
            } else if (msg.type === MessageType.ReplyOKJSON) {
                const reqId = msg.reqId;
                const callback = pendingCallbacks[reqId];
                if (callback) {
                    callback.resolve(msg.payload);
                }
            } else {
                //console.log("GOT MESSAGE: " + JSON.stringify(msg))
                /* TODO: Have a way for the user to specify a reply */
                connection.sendNotification(outgoingNotification, {
                    type: MessageType.ReplyOKJSON,
                    reqId: msg.reqId,
                    payload: null,
                })

                onMessageEvent.dispatch(msg);
            }
        })
    });

    let start = async () => {
        connection.listen();

        let extensionInfo = extensions.map(ext => {
            let metadata = <any>JSON.parse(fs.readFileSync(ext, "utf8"));

            if (metadata.main) {
                metadata.main = path.join(ext, "..", metadata.main);
            }

            let resolvedMetadata = {
                ...metadata,
                identifier: metadata.name,
                extensionLocationPath: path.dirname(ext),
            };
            return resolvedMetadata;
        });


        connection.sendNotification(outgoingNotification, {
            type: 0,
            reqId: requestId++,
            payload: {
                parentPid: process.pid,
                extensions: extensionInfo,
                environment: {
                    globalStorageHomePath: require("os").tmpdir(),
                },
                workspace: {name: "test", path: "/Users/bryphe/test", id: "testId"},
                logsLocationPath: require("os").tmpdir(),
                autoStart: true,
            }
        });

        connection.sendNotification(outgoingNotification, {
            type: 4, /* RequestJSONArgs */
            reqId: 2,
            payload: ["ExtHostConfiguration", "$initializeConfiguration", [{
                defaults: {
                    contents: {
                        suggest: {
                            enabled: true
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
            }]],
        });

        connection.sendNotification(outgoingNotification, {
            type: 4, /* RequestJSONArgs */
            reqId: 2,
            payload: ["ExtHostWorkspace", "$initializeWorkspace", [{
                id: "workspace-test",
                name: "workspace-test",
                configuration: null,
                folders: [{ uri: {path: "/some/folder", scheme: "file"}, name: "workspace-test-1", id: "workspace-test-1"}],
            }]],
        });

        await promise;
    };


    let defaultFilter = (payload: any) => true;

    let waitForMessageOnce = (expectedRpc: string, expectedMethod: string, filter: filterFunc = defaultFilter): Promise<void> => {
        return new Promise<void>((c) => {
            let subscription = onMessageEvent.subscribe((v) => {

                if (!v.payload) {
                    return;
                }

                const { args, rpcName, methodName } = v.payload;

                //console.log(`waitForMessageOnce: [${rpcName} | ${methodName}]: ${args}`);

                if (rpcName === expectedRpc && expectedMethod == methodName && filter(args)) {
                    c();
                    subscription.dispose();
                }
            })
        });

    };


    let sendNotification = (payload) => connection.sendNotification(outgoingNotification, {
        type: MessageType.RequestJSONArgs,
        reqId: requestId++,
        payload,
    });

    let sendRequest = (payload) => {

        let newRequestId = requestId++;
        connection.sendNotification(outgoingNotification, {
            type: MessageType.RequestJSONArgs,
            reqId: requestId,
            payload,
        });

        return new Promise((resolve, reject) => {
            pendingCallbacks[requestId] = { resolve, reject };
        });
    };

    let sendRequestWithCancellation = (payload) => {

        let newRequestId = requestId++;
        connection.sendNotification(outgoingNotification, {
            type: MessageType.RequestJSONArgsWithCancellation,
            reqId: requestId,
            payload,
        });

        return new Promise((resolve, reject) => {
            pendingCallbacks[requestId] = { resolve, reject };
        });
    };

    let createDocument = (uri: any, lines: string[], modeId: string) => {
        let testModelAdded = {
            uri: uri,
            lines: lines,
            EOL: "\n",
            modeId: modeId,
            isDirty: true,
        };

        let update = {
            removedDocuments: [],
            addedDocuments: [testModelAdded],
            removedEditors: [],
            addedEditors: [],
            newActiveEditor: null,
        };

        sendNotification(["ExtHostDocumentsAndEditors", "$acceptDocumentsAndEditorsDelta", [update]]);
    };

    let updateDocument = (uri: any, range: ChangedEventRange, text: string, versionId: number) => {
        let changedEvent = {
            changes: [{
                range: range,
                text: text,
            }],
            eol: "\n",
            versionId: versionId,
        };

        sendNotification(["ExtHostDocuments", "$acceptModelChanged", [uri, changedEvent, true]]);
    };

    let provideCompletionItems = (handle: number, resource: any, position: any, context: any) => {
        return sendRequestWithCancellation(["ExtHostLanguageFeatures", "$provideCompletionItems", [handle, resource, position, context]]);
    };

    let extHost = {
        start,
        sendNotification,
        onMessage: onMessageEvent,
        waitForMessageOnce,
        createDocument,
        updateDocument,
        provideCompletionItems,
    };

    await f(extHost);

    let closePromise = new Promise((c) => {
        connection.onClose(() => c());
    })

    connection.sendNotification(outgoingNotification, {
        reqId: 4,
        type: 3, /* terminate */
        payload: null,
    });

    await closePromise;
};

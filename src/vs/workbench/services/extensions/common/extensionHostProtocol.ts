/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//import { VSBuffer } from 'vs/base/common/buffer';
import { IJsonRpcProtocol } from 'vs/base/parts/ipc/common/ipc';

export interface IExtHostReadyMessage {
	type: 'VSCODE_EXTHOST_IPC_READY';
}

export interface IExtHostSocketMessage {
	type: 'VSCODE_EXTHOST_IPC_SOCKET';
	initialDataChunk: string;
	skipWebSocketFrames: boolean;
}

export interface IExtHostReduceGraceTimeMessage {
	type: 'VSCODE_EXTHOST_IPC_REDUCE_GRACE_TIME';
}

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
}

export interface OutgoingMessage {
	type: MessageType,
	reqId: number,
	payload: any;
}

export interface IncomingMessage {
	type: MessageType,
	payload: any,
	reqId: number,
};

export interface IExtensionHostProtocol extends IJsonRpcProtocol<IncomingMessage, OutgoingMessage> { };

export function createMessageOfType(type: MessageType): OutgoingMessage {
	let message: OutgoingMessage =  { type: type, reqId: -1, payload: null, };
	return message;
}

export function isMessageOfType(message: IncomingMessage, type: MessageType): boolean {
	return message.type === type;
}

import * as errors from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { LazyPromise } from 'vs/workbench/services/extensions/common/lazyPromise';
import { RunOnceScheduler } from 'vs/base/common/async';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { CharCode } from 'vs/base/common/charCode';

export const enum ResponsiveState {
	Responsive = 0,
	Unresponsive = 1
}

import { IRPCProtocol, ProxyIdentifier, getStringIdentifierForProxy, getNumberIdentifierForProxy } from 'vs/workbench/services/extensions/common/proxyIdentifier';
import { Disposable } from 'vs/base/common/lifecycle';

let noop = () => { };

export class JsonRPCProtocol extends Disposable implements IRPCProtocol {

	private static UNRESPONSIVE_TIME = 3 * 1000; // 3s

	private readonly _onDidChangeResponsiveState: Emitter<ResponsiveState> = this._register(new Emitter<ResponsiveState>());
	public readonly onDidChangeResponsiveState: Event<ResponsiveState> = this._onDidChangeResponsiveState.event;

	private readonly _protocol: IExtensionHostProtocol;
	private _isDisposed: boolean;
	private readonly _locals: any[];
	private readonly _proxies: any[];
	private _lastMessageId: number;
	private readonly _cancelInvokedHandlers: { [req: string]: () => void; };
	private readonly _pendingRPCReplies: { [msgId: string]: LazyPromise; };
	private _responsiveState: ResponsiveState;
	private _unacknowledgedCount: number;
	private _unresponsiveTime: number;
	private _asyncCheckUresponsive: RunOnceScheduler;

	constructor(protocol: IExtensionHostProtocol) {
		super();
		this._protocol = protocol;
		this._isDisposed = false;
		this._locals = [];
		this._proxies = [];
		for (let i = 0, len = ProxyIdentifier.count; i < len; i++) {
			this._locals[i] = null;
			this._proxies[i] = null;
		}
		this._lastMessageId = 0;
		this._cancelInvokedHandlers = Object.create(null);
		this._pendingRPCReplies = {};
		this._responsiveState = ResponsiveState.Responsive;
		this._unacknowledgedCount = 0;
		this._unresponsiveTime = 0;
		this._asyncCheckUresponsive = this._register(new RunOnceScheduler(() => this._checkUnresponsive(), 1000));
		this._protocol.onMessage((msg) => this._receiveOneMessage(msg));
	}

	public dispose(): void {
		this._isDisposed = true;

		// Release all outstanding promises with a canceled error
		Object.keys(this._pendingRPCReplies).forEach((msgId) => {
			const pending = this._pendingRPCReplies[msgId];
			pending.resolveErr(errors.canceled());
		});
	}

	private _onWillSendRequest(req: number): void {
		if (this._unacknowledgedCount === 0) {
			// Since this is the first request we are sending in a while,
			// mark this moment as the start for the countdown to unresponsive time
			this._unresponsiveTime = Date.now() + JsonRPCProtocol.UNRESPONSIVE_TIME;
		}
		this._unacknowledgedCount++;
		if (!this._asyncCheckUresponsive.isScheduled()) {
			this._asyncCheckUresponsive.schedule();
		}
	}

	private _onDidReceiveAcknowledge(req: number): void {
		// The next possible unresponsive time is now + delta.
		this._unresponsiveTime = Date.now() + JsonRPCProtocol.UNRESPONSIVE_TIME;
		this._unacknowledgedCount--;
		if (this._unacknowledgedCount === 0) {
			// No more need to check for unresponsive
			this._asyncCheckUresponsive.cancel();
		}
		// The ext host is responsive!
		this._setResponsiveState(ResponsiveState.Responsive);
	}

	private _checkUnresponsive(): void {
		if (this._unacknowledgedCount === 0) {
			// Not waiting for anything => cannot say if it is responsive or not
			return;
		}

		if (Date.now() > this._unresponsiveTime) {
			// Unresponsive!!
			this._setResponsiveState(ResponsiveState.Unresponsive);
		} else {
			// Not (yet) unresponsive, be sure to check again soon
			this._asyncCheckUresponsive.schedule();
		}
	}

	private _setResponsiveState(newResponsiveState: ResponsiveState): void {
		if (this._responsiveState === newResponsiveState) {
			// no change
			return;
		}
		this._responsiveState = newResponsiveState;
		this._onDidChangeResponsiveState.fire(this._responsiveState);
	}

	public get responsiveState(): ResponsiveState {
		return this._responsiveState;
	}

	public getProxy<T>(identifier: ProxyIdentifier<T>): T {
		const rpcId = identifier.nid;
		if (!this._proxies[rpcId]) {
			this._proxies[rpcId] = this._createProxy(rpcId);
		}
		return this._proxies[rpcId];
	}

	private _createProxy<T>(rpcId: number): T {
		let handler = {
			get: (target: any, name: string) => {
				if (!target[name] && name.charCodeAt(0) === CharCode.DollarSign) {
					target[name] = (...myArgs: any[]) => {
						return this._remoteCall(rpcId, name, myArgs);
					};
				}
				return target[name];
			}
		};
		return new Proxy(Object.create(null), handler);
	}

	public set<T, R extends T>(identifier: ProxyIdentifier<T>, value: R): R {
		this._locals[identifier.nid] = value;
		return value;
	}

	public assertRegistered(identifiers: ProxyIdentifier<any>[]): void {
		for (let i = 0, len = identifiers.length; i < len; i++) {
			const identifier = identifiers[i];
			if (!this._locals[identifier.nid]) {
				throw new Error(`Missing actor ${identifier.sid} (isMain: ${identifier.isMain})`);
			}
		}
	}

	private _receiveOneMessage(rawmsg: IncomingMessage): void {
		if (this._isDisposed) {
			return;
		}

		const { type, reqId, payload } = rawmsg;
		const req = reqId;

		switch (type) {
			case MessageType.RequestJSONArgs:
			case MessageType.RequestJSONArgsWithCancellation: {
				let [ rpc, method, args ] = payload;
				this._receiveRequest(req, rpc, method, args, (type === MessageType.RequestJSONArgsWithCancellation));

				break;
			}
			case MessageType.RequestMixedArgs:
			case MessageType.RequestMixedArgsWithCancellation: {
				let [ rpcId, method, args ] = payload;
				this._receiveRequest(req, rpcId, method, args, (type === MessageType.RequestMixedArgsWithCancellation));
				break;
			}
			case MessageType.Acknowledged: {
				this._onDidReceiveAcknowledge(req);
				break;
			}
			case MessageType.Cancel: {
				this._receiveCancel(req);
				break;
			}
			case MessageType.ReplyOKEmpty: {
				this._receiveReply(req, undefined);
				break;
			}
			case MessageType.ReplyOKBuffer:
			case MessageType.ReplyOKJSON: {
				let value = payload;
				this._receiveReply(req, value);
				break;
			}
			case MessageType.ReplyErrError: {
				this._receiveReplyErr(req, payload);
				break;
			}
			case MessageType.ReplyErrEmpty: {
				this._receiveReplyErr(req, undefined);
				break;
			}
		}
	}

	private _receiveRequest( req: number, rpc: number, method: string, args: any[], usesCancellationToken: boolean): void {
		const callId = String(req);
		const rpcId = getNumberIdentifierForProxy(rpc);

		let promise: Promise<any>;
		let cancel: () => void;
		if (usesCancellationToken) {
			const cancellationTokenSource = new CancellationTokenSource();
			args.push(cancellationTokenSource.token);
			promise = this._invokeHandler(rpcId, method, args);
			cancel = () => cancellationTokenSource.cancel();
		} else {
			// cannot be cancelled
			promise = this._invokeHandler(rpcId, method, args);
			cancel = noop;
		}

		this._cancelInvokedHandlers[callId] = cancel;

		// Acknowledge the request
		this._protocol.send({
			type: MessageType.Acknowledged,
			reqId: req,
			payload: null,
		});

		promise.then((r) => {
			delete this._cancelInvokedHandlers[callId];
			this._protocol.send({
				type: MessageType.ReplyOKJSON,
				reqId: req,
				payload: r
			});
		}, (err) => {
			delete this._cancelInvokedHandlers[callId];
			this._protocol.send({
				type: MessageType.ReplyErrError,
				reqId: req,
				payload: err,
			});
		});
	}

	private _receiveCancel( req: number): void {
		const callId = String(req);
		if (this._cancelInvokedHandlers[callId]) {
			this._cancelInvokedHandlers[callId]();
		}
	}

	private _receiveReply(req: number, value: any): void {
		const callId = String(req);
		if (!this._pendingRPCReplies.hasOwnProperty(callId)) {
			return;
		}

		const pendingReply = this._pendingRPCReplies[callId];
		delete this._pendingRPCReplies[callId];

		pendingReply.resolveOk(value);
	}

	private _receiveReplyErr(req: number, value: any): void {
		const callId = String(req);
		if (!this._pendingRPCReplies.hasOwnProperty(callId)) {
			return;
		}

		const pendingReply = this._pendingRPCReplies[callId];
		delete this._pendingRPCReplies[callId];

		let err: Error | null = null;
		if (value && value.$isError) {
			err = new Error();
			err.name = value.name;
			err.message = value.message;
			err.stack = value.stack;
		}
		pendingReply.resolveErr(err);
	}

	private _invokeHandler(rpcId: number, methodName: string, args: any[]): Promise<any> {
		try {
			return Promise.resolve(this._doInvokeHandler(rpcId, methodName, args));
		} catch (err) {
			return Promise.reject(err);
		}
	}

	private _doInvokeHandler(rpcId: number, methodName: string, args: any[]): any {
		const actor = this._locals[rpcId];
		if (!actor) {
			throw new Error('Unknown actor ' + getStringIdentifierForProxy(rpcId));
		}
		let method = actor[methodName];
		if (typeof method !== 'function') {
			throw new Error('Unknown method ' + methodName + ' on actor ' + getStringIdentifierForProxy(rpcId));
		}

		return method.apply(actor, args);
	}

	private _remoteCall(rpcId: number, methodName: string, args: any[]): Promise<any> {
		if (this._isDisposed) {
			return Promise.reject<any>(errors.canceled());
		}
		let cancellationToken: CancellationToken | null = null;
		if (args.length > 0 && CancellationToken.isCancellationToken(args[args.length - 1])) {
			cancellationToken = args.pop();
		}

		if (cancellationToken && cancellationToken.isCancellationRequested) {
			// No need to do anything...
			return Promise.reject<any>(errors.canceled());
		}

		const req = ++this._lastMessageId;
		const callId = String(req);
		const result = new LazyPromise();

		if (cancellationToken) {
			cancellationToken.onCancellationRequested(() => {
				this._protocol.send({
					type: MessageType.Cancel,
					reqId: req,
					payload: null,
				});
			});
		}

		this._pendingRPCReplies[callId] = result;
		this._onWillSendRequest(req);
		this._protocol.send({
			type: MessageType.RequestJSONArgs,
			reqId: req,
			payload: {
				rpcName: getStringIdentifierForProxy(rpcId),
				methodName,
				args,
			}
		});
		return result;
	}
}

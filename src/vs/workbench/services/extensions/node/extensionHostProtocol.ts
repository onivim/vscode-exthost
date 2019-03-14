/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { IJsonRpcProtocol } from 'vs/base/parts/ipc/node/ipc';

export const enum OutgoingMessageType {
	Initialized = 0,
	Ready = 1,
}

export interface OutgoingMessage {
	type: OutgoingMessageType,
}

export interface IncomingMessage {
	type: IncomingMessageType,
	payload: any,
};

export const enum IncomingMessageType {
	InitData = 0,
	Terminate = 1,
}

export interface IExtensionHostProtocol extends IJsonRpcProtocol<IncomingMessage, OutgoingMessage> { };

export function createMessageOfType(type: OutgoingMessageType): OutgoingMessage {
	let message: OutgoingMessage =  { type: type };
	return message;
}

export function isMessageOfType(message: IncomingMessage, type: IncomingMessageType): boolean {
	return message.type === type;
}
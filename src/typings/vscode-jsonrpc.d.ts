declare module 'vscode-jsonrpc' {

	export interface MessageConnection {
		onNotification<T, U>(notification: NotificationType<T, U>, handler: any);

		listen();

		sendNotification<T, U>(notification: NotificationType<T, U>, message: any);
	}

	export function createMessageConnection(
		reader: StreamMessageReader,
		writer: StreamMessageWriter,
	);

	export class NotificationType<T, U> {
		constructor(val: string);
	}

	export class StreamMessageReader {
		constructor(v: any);
	}

	export class StreamMessageWriter {
		constructor(v: any);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator as createServiceDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { isWindows } from 'vs/base/common/platform';
import { Event, Emitter } from 'vs/base/common/event';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { LoggerChannelClient } from 'vs/platform/log/common/logIpc';
import { URI } from 'vs/base/common/uri';

export const ILogService = createServiceDecorator<ILogService>('logService');
export const ILoggerService = createServiceDecorator<ILoggerService>('loggerService');

function now(): string {
	return new Date().toISOString();
}

export enum LogLevel {
	Trace,
	Debug,
	Info,
	Warning,
	Error,
	Critical,
	Off
}

export const DEFAULT_LOG_LEVEL: LogLevel = LogLevel.Info;

export interface ILogger extends IDisposable {
	onDidChangeLogLevel: Event<LogLevel>;
	getLevel(): LogLevel;
	setLevel(level: LogLevel): void;

	trace(message: string, ...args: any[]): void;
	debug(message: string, ...args: any[]): void;
	info(message: string, ...args: any[]): void;
	warn(message: string, ...args: any[]): void;
	error(message: string | Error, ...args: any[]): void;
	critical(message: string | Error, ...args: any[]): void;

	/**
	 * An operation to flush the contents. Can be synchronous.
	 */
	flush(): void;
}

export interface ILogService extends ILogger {
	_serviceBrand: undefined;
}

export interface ILoggerService {
	_serviceBrand: undefined;

	getLogger(file: URI): ILogger;
}

export abstract class AbstractLogService extends Disposable {

	private level: LogLevel = DEFAULT_LOG_LEVEL;
	private readonly _onDidChangeLogLevel: Emitter<LogLevel> = this._register(new Emitter<LogLevel>());
	readonly onDidChangeLogLevel: Event<LogLevel> = this._onDidChangeLogLevel.event;

	setLevel(level: LogLevel): void {
		if (this.level !== level) {
			this.level = level;
			this._onDidChangeLogLevel.fire(this.level);
		}
	}

	getLevel(): LogLevel {
		return this.level;
	}

}

export class ConsoleLogMainService extends AbstractLogService implements ILogService {

	_serviceBrand: undefined;
	private useColors: boolean;

	constructor(logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
		super();
		this.setLevel(logLevel);
		this.useColors = !isWindows;
	}

	trace(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Trace) {
			if (this.useColors) {
				console.log(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
			} else {
				console.log(`[main ${now()}]`, message, ...args);
			}
		}
	}

	debug(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Debug) {
			if (this.useColors) {
				console.log(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
			} else {
				console.log(`[main ${now()}]`, message, ...args);
			}
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Info) {
			if (this.useColors) {
				console.log(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
			} else {
				console.log(`[main ${now()}]`, message, ...args);
			}
		}
	}

	warn(message: string | Error, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Warning) {
			if (this.useColors) {
				console.warn(`\x1b[93m[main ${now()}]\x1b[0m`, message, ...args);
			} else {
				console.warn(`[main ${now()}]`, message, ...args);
			}
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Error) {
			if (this.useColors) {
				console.error(`\x1b[91m[main ${now()}]\x1b[0m`, message, ...args);
			} else {
				console.error(`[main ${now()}]`, message, ...args);
			}
		}
	}

	critical(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Critical) {
			if (this.useColors) {
				console.error(`\x1b[90m[main ${now()}]\x1b[0m`, message, ...args);
			} else {
				console.error(`[main ${now()}]`, message, ...args);
			}
		}
	}

	dispose(): void {
		// noop
	}

	flush(): void {
		// noop
	}

}

export class ConsoleLogService extends AbstractLogService implements ILogService {

	_serviceBrand: undefined;

	constructor(logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
		super();
		this.setLevel(logLevel);
	}

	trace(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Trace) {
			console.error('%cTRACE', 'color: #888', message, ...args);
		}
	}

	debug(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Debug) {
			console.error('%cDEBUG', 'background: #eee; color: #888', message, ...args);
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Info) {
			console.error('%c INFO', 'color: #33f', message, ...args);
		}
	}

	warn(message: string | Error, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Warning) {
			console.error('%c WARN', 'color: #993', message, ...args);
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Error) {
			console.error('%c  ERR', 'color: #f33', message, ...args);
		}
	}

	critical(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Critical) {
			console.error('%cCRITI', 'background: #f33; color: white', message, ...args);
		}
	}

	dispose(): void {
		// noop
	}

	flush(): void {
		// noop
	}
}

export class ConsoleLogInMainService extends AbstractLogService implements ILogService {

	_serviceBrand: undefined;

	constructor(private readonly client: LoggerChannelClient, logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
		super();
		this.setLevel(logLevel);
	}

	trace(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Trace) {
			this.client.consoleLog('trace', [message, ...args]);
		}
	}

	debug(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Debug) {
			this.client.consoleLog('debug', [message, ...args]);
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Info) {
			this.client.consoleLog('info', [message, ...args]);
		}
	}

	warn(message: string | Error, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Warning) {
			this.client.consoleLog('warn', [message, ...args]);
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Error) {
			this.client.consoleLog('error', [message, ...args]);
		}
	}

	critical(message: string, ...args: any[]): void {
		if (this.getLevel() <= LogLevel.Critical) {
			this.client.consoleLog('critical', [message, ...args]);
		}
	}

	dispose(): void {
		// noop
	}

	flush(): void {
		// noop
	}
}

export class MultiplexLogService extends AbstractLogService implements ILogService {
	_serviceBrand: undefined;

	constructor(private readonly logServices: ReadonlyArray<ILogService>) {
		super();
		if (logServices.length) {
			this.setLevel(logServices[0].getLevel());
		}
	}

	setLevel(level: LogLevel): void {
		for (const logService of this.logServices) {
			logService.setLevel(level);
		}
		super.setLevel(level);
	}

	trace(message: string, ...args: any[]): void {
		for (const logService of this.logServices) {
			logService.trace(message, ...args);
		}
	}

	debug(message: string, ...args: any[]): void {
		for (const logService of this.logServices) {
			logService.debug(message, ...args);
		}
	}

	info(message: string, ...args: any[]): void {
		for (const logService of this.logServices) {
			logService.info(message, ...args);
		}
	}

	warn(message: string, ...args: any[]): void {
		for (const logService of this.logServices) {
			logService.warn(message, ...args);
		}
	}

	error(message: string | Error, ...args: any[]): void {
		for (const logService of this.logServices) {
			logService.error(message, ...args);
		}
	}

	critical(message: string | Error, ...args: any[]): void {
		for (const logService of this.logServices) {
			logService.critical(message, ...args);
		}
	}

	flush(): void {
		for (const logService of this.logServices) {
			logService.flush();
		}
	}

	dispose(): void {
		for (const logService of this.logServices) {
			logService.dispose();
		}
	}
}

export class DelegatedLogService extends Disposable implements ILogService {
	_serviceBrand: undefined;

	constructor(private logService: ILogService) {
		super();
		this._register(logService);
	}

	get onDidChangeLogLevel(): Event<LogLevel> {
		return this.logService.onDidChangeLogLevel;
	}

	setLevel(level: LogLevel): void {
		this.logService.setLevel(level);
	}

	getLevel(): LogLevel {
		return this.logService.getLevel();
	}

	trace(message: string, ...args: any[]): void {
		this.logService.trace(message, ...args);
	}

	debug(message: string, ...args: any[]): void {
		this.logService.debug(message, ...args);
	}

	info(message: string, ...args: any[]): void {
		this.logService.info(message, ...args);
	}

	warn(message: string, ...args: any[]): void {
		this.logService.warn(message, ...args);
	}

	error(message: string | Error, ...args: any[]): void {
		this.logService.error(message, ...args);
	}

	critical(message: string | Error, ...args: any[]): void {
		this.logService.critical(message, ...args);
	}

	flush(): void {
		this.logService.flush();
	}
}

export class NullLogService implements ILogService {
	_serviceBrand: undefined;
	readonly onDidChangeLogLevel: Event<LogLevel> = new Emitter<LogLevel>().event;
	setLevel(level: LogLevel): void { }
	getLevel(): LogLevel { return LogLevel.Info; }
	trace(message: string, ...args: any[]): void { }
	debug(message: string, ...args: any[]): void { }
	info(message: string, ...args: any[]): void { }
	warn(message: string, ...args: any[]): void { }
	error(message: string | Error, ...args: any[]): void { }
	critical(message: string | Error, ...args: any[]): void { }
	dispose(): void { }
	flush(): void { }
}

export function getLogLevel(environmentService: IEnvironmentService): LogLevel {
	if (environmentService.verbose) {
		return LogLevel.Trace;
	}
	if (typeof environmentService.args.log === 'string') {
		const logLevel = environmentService.args.log.toLowerCase();
		switch (logLevel) {
			case 'trace':
				return LogLevel.Trace;
			case 'debug':
				return LogLevel.Debug;
			case 'info':
				return LogLevel.Info;
			case 'warn':
				return LogLevel.Warning;
			case 'error':
				return LogLevel.Error;
			case 'critical':
				return LogLevel.Critical;
			case 'off':
				return LogLevel.Off;
		}
	}
	return DEFAULT_LOG_LEVEL;
}

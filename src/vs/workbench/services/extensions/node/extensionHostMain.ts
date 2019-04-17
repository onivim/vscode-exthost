/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from 'vs/base/common/async';
import * as errors from 'vs/base/common/errors';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { Counter } from 'vs/base/common/numbers';
import { URI, setUriThrowOnMissingScheme } from 'vs/base/common/uri';
// import { IURITransformer } from 'vs/base/common/uriIpc';
// import { IMessagePassingProtocol } from 'vs/base/parts/ipc/node/ipc';
import { IRawEnvironment, IEnvironment, IRawExtensionDescription, IRawInitData, IInitData, MainContext, MainThreadConsoleShape } from 'vs/workbench/api/node/extHost.protocol';
import { ExtHostConfiguration } from 'vs/workbench/api/node/extHostConfiguration';
import { ExtHostExtensionService } from 'vs/workbench/api/node/extHostExtensionService';
import { ExtHostLogService } from 'vs/workbench/api/node/extHostLogService';
import { ExtHostWorkspace } from 'vs/workbench/api/node/extHostWorkspace';
import { IExtensionDescription } from 'vs/workbench/services/extensions/common/extensions';
import { IExtensionHostProtocol, JsonRPCProtocol } from 'vs/workbench/services/extensions/node/extensionHostProtocol';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';

// we don't (yet) throw when extensions parse
// uris that have no scheme
setUriThrowOnMissingScheme(false);

const nativeExit = process.exit.bind(process);
function patchProcess(allowExit: boolean) {
	process.exit = function (code?: number) {
		if (allowExit) {
			exit(code);
		} else {
			const err = new Error('An extension called process.exit() and this was prevented.');
			console.warn(err.stack);
		}
	} as (code?: number) => never;

	process.crash = function () {
		const err = new Error('An extension called process.crash() and this was prevented.');
		console.warn(err.stack);
	};
}

export function exit(code?: number) {
	nativeExit(code);
}

export class ExtensionHostMain {


	private _isTerminating: boolean;
	private readonly _environment: IEnvironment;
	private readonly _extensionService: ExtHostExtensionService;
	private readonly _extHostLogService: ExtHostLogService;
	private disposables: IDisposable[] = [];

	private _searchRequestIdProvider: Counter;

	constructor(protocol: IExtensionHostProtocol, rawInitData: IRawInitData) {
		this._isTerminating = false;
		// const uriTransformer: IURITransformer | null = null;
		const rpcProtocol = new JsonRPCProtocol(protocol);

		// ensure URIs are transformed and revived
		const initData = this.transform(rawInitData);
		this._environment = initData.environment;

		const allowExit = !!this._environment.extensionTestsLocationURI; // to support other test frameworks like Jasmin that use process.exit (https://github.com/Microsoft/vscode/issues/37708)
		patchProcess(allowExit);

		this._patchPatchedConsole(rpcProtocol.getProxy(MainContext.MainThreadConsole));

		// services
		this._extHostLogService = new ExtHostLogService(initData.logLevel, initData.logsLocation.fsPath);
		this.disposables.push(this._extHostLogService);

		this._searchRequestIdProvider = new Counter();
		const extHostWorkspace = new ExtHostWorkspace(rpcProtocol, this._extHostLogService, this._searchRequestIdProvider, initData.workspace);

		this._extHostLogService.info('extension host started');
		this._extHostLogService.trace('initData', initData);

		const extHostConfiguraiton = new ExtHostConfiguration(rpcProtocol.getProxy(MainContext.MainThreadConfiguration), extHostWorkspace);
		this._extensionService = new ExtHostExtensionService(nativeExit, initData, rpcProtocol, extHostWorkspace, extHostConfiguraiton, this._extHostLogService);

		// error forwarding and stack trace scanning
		Error.stackTraceLimit = 100; // increase number of stack frames (from 10, https://github.com/v8/v8/wiki/Stack-Trace-API)
		const extensionErrors = new WeakMap<Error, IExtensionDescription>();
		this._extensionService.getExtensionPathIndex().then(map => {
			(<any>Error).prepareStackTrace = (error: Error, stackTrace: errors.V8CallSite[]) => {
				let stackTraceMessage = '';
				let extension: IExtensionDescription | undefined;
				let fileName: string;
				for (const call of stackTrace) {
					stackTraceMessage += `\n\tat ${call.toString()}`;
					fileName = call.getFileName();
					if (!extension && fileName) {
						extension = map.findSubstr(fileName);
					}

				}
				extensionErrors.set(error, extension);
				return `${error.name || 'Error'}: ${error.message || ''}${stackTraceMessage}`;
			};
		});

		const mainThreadExtensions = rpcProtocol.getProxy(MainContext.MainThreadExtensionService);
		const mainThreadErrors = rpcProtocol.getProxy(MainContext.MainThreadErrors);
		errors.setUnexpectedErrorHandler(err => {
			console.error("UNEXPECTED ERROR: " + err)
			const data = errors.transformErrorForSerialization(err);
			const extension = extensionErrors.get(err);
			if (extension) {
				mainThreadExtensions.$onExtensionRuntimeError(extension.identifier, data);
			} else {
				mainThreadErrors.$onUnexpectedError(data);
			}
		});
	}

	private _patchPatchedConsole(mainThreadConsole: MainThreadConsoleShape): void {
		console.log = (...args) => console.error("[LOG]", args);
		console.info = (...args) => console.error("[INFO]", args);
		console.warn = (...args) => console.error("[WARN]", args);

		// The console is already patched to use `process.send()`
		const nativeProcessSend = process.send!;
		process.send = (...args: any[]) => {
			if (args.length === 0 || !args[0] || args[0].type !== '__$console') {
				return nativeProcessSend.apply(process, args);
			}

			mainThreadConsole.$logExtensionHostMessage(args[0]);
		};
	}

	terminate(): void {
		if (this._isTerminating) {
			// we are already shutting down...
			return;
		}
		this._isTerminating = true;

		this.disposables = dispose(this.disposables);

		errors.setUnexpectedErrorHandler((err) => {
			// TODO: write to log once we have one
		});

		const extensionsDeactivated = this._extensionService.deactivateAll();

		// Give extensions 1 second to wrap up any async dispose, then exit in at most 4 seconds
		setTimeout(() => {
			Promise.race([timeout(4000), extensionsDeactivated]).then(() => exit(), () => exit());
		}, 1000);
	}

	private transform(rawInitData: IRawInitData): IInitData {
		let uriOrNull = (v: string | null) => {
			if (v) {
				return URI.file(v);
			} else {
				return null;
			}
		}

		let refineExtensions = (rawExtensionInfo: IRawExtensionDescription) => {
			return <IExtensionDescription>{
				...rawExtensionInfo,
			    identifier: new ExtensionIdentifier(rawExtensionInfo.identifier),
				extensionLocation: uriOrNull(rawExtensionInfo.extensionLocationPath)
			}
		};

		let refineEnvironment = (rawEnvironment: IRawEnvironment) => {
			return <IEnvironment>{
				...rawEnvironment,
				appRoot: uriOrNull(rawEnvironment.appRootPath),
				appSettingsHome: uriOrNull(rawEnvironment.appSettingsHomePath),
				extensionDevelopmentLocationURI: uriOrNull(rawEnvironment.extensionDevelopmentLocationPath),
				extensionTestsLocationURI: uriOrNull(rawEnvironment.extensionTestsLocationPath),
				globalStorageHome: uriOrNull(rawEnvironment.globalStorageHomePath),
			}
		}

		let initData: IInitData = {
			...rawInitData,
			extensions: rawInitData.extensions.map(refineExtensions),
			environment: refineEnvironment(rawInitData.environment),
			logsLocation: uriOrNull(rawInitData.logsLocationPath),
			resolvedExtensions: [],
			hostExtensions: [],
			// workspace: uriOrNull(rawInitData.workspacePath),
		}
		return initData;
	}
}

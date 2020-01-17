/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'vs/base/common/path';
import * as platform from 'vs/base/common/platform';
import * as pty from 'node-pty';
import * as fs from 'fs';
import { Event, Emitter } from 'vs/base/common/event';
import { getWindowsBuildNumber } from 'vs/workbench/contrib/terminal/node/terminal';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IShellLaunchConfig, ITerminalChildProcess } from 'vs/workbench/contrib/terminal/common/terminal';
import { exec } from 'child_process';

export class TerminalProcess implements ITerminalChildProcess, IDisposable {
	private _exitCode: number;
	private _closeTimeout: any;
	private _ptyProcess: pty.IPty;
	private _currentTitle: string = '';
	private _processStartupComplete: Promise<void>;
	private _isDisposed: boolean = false;
	private _titleInterval: NodeJS.Timer | null = null;
	private _initialCwd: string;

	private readonly _onProcessData = new Emitter<string>();
	public get onProcessData(): Event<string> { return this._onProcessData.event; }
	private readonly _onProcessExit = new Emitter<number>();
	public get onProcessExit(): Event<number> { return this._onProcessExit.event; }
	private readonly _onProcessIdReady = new Emitter<number>();
	public get onProcessIdReady(): Event<number> { return this._onProcessIdReady.event; }
	private readonly _onProcessTitleChanged = new Emitter<string>();
	public get onProcessTitleChanged(): Event<string> { return this._onProcessTitleChanged.event; }

	constructor(
		shellLaunchConfig: IShellLaunchConfig,
		cwd: string,
		cols: number,
		rows: number,
		env: platform.IProcessEnvironment,
		windowsEnableConpty: boolean
	) {
		let shellName: string;
		if (os.platform() === 'win32') {
			shellName = path.basename(shellLaunchConfig.executable || '');
		} else {
			// Using 'xterm-256color' here helps ensure that the majority of Linux distributions will use a
			// color prompt as defined in the default ~/.bashrc file.
			shellName = 'xterm-256color';
		}

		this._initialCwd = cwd;
		const useConpty = windowsEnableConpty && process.platform === 'win32' && getWindowsBuildNumber() >= 18309;
		const options: pty.IPtyForkOptions = {
			name: shellName,
			cwd,
			env,
			cols,
			rows,
			experimentalUseConpty: useConpty
		};

		try {
			this._ptyProcess = pty.spawn(shellLaunchConfig.executable!, shellLaunchConfig.args || [], options);
			this._processStartupComplete = new Promise<void>(c => {
				this.onProcessIdReady((pid) => {
					c();
				});
			});
		} catch (error) {
			// The only time this is expected to happen is when the file specified to launch with does not exist.
			this._exitCode = 2;
			this._queueProcessExit();
			this._processStartupComplete = Promise.resolve(undefined);
			return;
		}
		this._ptyProcess.on('data', (data) => {
			this._onProcessData.fire(data);
			if (this._closeTimeout) {
				clearTimeout(this._closeTimeout);
				this._queueProcessExit();
			}
		});
		this._ptyProcess.on('exit', (code) => {
			this._exitCode = code;
			this._queueProcessExit();
		});

		// TODO: We should no longer need to delay this since pty.spawn is sync
		setTimeout(() => {
			this._sendProcessId();
		}, 500);
		this._setupTitlePolling();
	}

	public dispose(): void {
		this._isDisposed = true;
		if (this._titleInterval) {
			clearInterval(this._titleInterval);
		}
		this._titleInterval = null;
		this._onProcessData.dispose();
		this._onProcessExit.dispose();
		this._onProcessIdReady.dispose();
		this._onProcessTitleChanged.dispose();
	}

	private _setupTitlePolling() {
		// Send initial timeout async to give event listeners a chance to init
		setTimeout(() => {
			this._sendProcessTitle();
		}, 0);
		// Setup polling
		this._titleInterval = setInterval(() => {
			if (this._currentTitle !== this._ptyProcess.process) {
				this._sendProcessTitle();
			}
		}, 200);
	}

	// Allow any trailing data events to be sent before the exit event is sent.
	// See https://github.com/Tyriar/node-pty/issues/72
	private _queueProcessExit() {
		if (this._closeTimeout) {
			clearTimeout(this._closeTimeout);
		}
		this._closeTimeout = setTimeout(() => this._kill(), 250);
	}

	private _kill(): void {
		// Wait to kill to process until the start up code has run. This prevents us from firing a process exit before a
		// process start.
		this._processStartupComplete.then(() => {
			if (this._isDisposed) {
				return;
			}
			// Attempt to kill the pty, it may have already been killed at this
			// point but we want to make sure
			try {
				this._ptyProcess.kill();
			} catch (ex) {
				// Swallow, the pty has already been killed
			}
			this._onProcessExit.fire(this._exitCode);
			this.dispose();
		});
	}

	private _sendProcessId() {
		this._onProcessIdReady.fire(this._ptyProcess.pid);
	}

	private _sendProcessTitle(): void {
		if (this._isDisposed) {
			return;
		}
		this._currentTitle = this._ptyProcess.process;
		this._onProcessTitleChanged.fire(this._currentTitle);
	}

	public shutdown(immediate: boolean): void {
		if (immediate) {
			this._kill();
		} else {
			this._queueProcessExit();
		}
	}

	public input(data: string): void {
		if (this._isDisposed) {
			return;
		}
		this._ptyProcess.write(data);
	}

	public resize(cols: number, rows: number): void {
		if (this._isDisposed) {
			return;
		}
		// Ensure that cols and rows are always >= 1, this prevents a native
		// exception in winpty.
		this._ptyProcess.resize(Math.max(cols, 1), Math.max(rows, 1));
	}

	public getInitialCwd(): Promise<string> {
		return Promise.resolve(this._initialCwd);
	}

	public getCwd(): Promise<string> {
		if (platform.isMacintosh) {
			return new Promise<string>(resolve => {
				exec('lsof -p ' + this._ptyProcess.pid + ' | grep cwd', (error, stdout, stderr) => {
					if (stdout !== '') {
						resolve(stdout.substring(stdout.indexOf('/'), stdout.length - 1));
					}
				});
			});
		}

		if (platform.isLinux) {
			return new Promise<string>(resolve => {
				fs.readlink('/proc/' + this._ptyProcess.pid + '/cwd', (err, linkedstr) => {
					if (err) {
						resolve(this._initialCwd);
					}
					resolve(linkedstr);
				});
			});
		}

		return new Promise<string>(resolve => {
			resolve(this._initialCwd);
		});
	}
}

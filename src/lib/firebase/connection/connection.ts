/**
 * @license
 * Copyright 2023 Gauthier Dandele
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { nextTick } from "process";
import { TypedEmitter } from "tiny-typed-emitter";
import { ConnectionEvent, ConnectionState, StatusCallback } from "./types";
import { Client } from "../client";
import { LogCallback, LogFn } from "../logger";

export abstract class Connection extends TypedEmitter<ConnectionEvent> {
	protected _isOffline: boolean = false;
	protected _state: ConnectionState = ConnectionState.DISCONNECTED;
	protected firstConnectionEtablished: boolean = false;
	protected log: LogFn | null = null;
	protected updateStatus: StatusCallback | null = null;

	protected abstract removeConnectionState(): void;
	protected abstract subscribeConnectionState(): void;

	constructor(protected readonly client: Client) {
		if (!(client instanceof Client)) throw new TypeError("RTDB must be instantiated with Client as parameter");

		super();
		nextTick(() => this.subscribeConnectionState());
	}

	public get connectionState(): ConnectionState {
		return this._state;
	}

	public get offline(): boolean {
		return this._isOffline;
	}

	public onLog(logCallback: LogCallback | null) {
		if (typeof logCallback !== "function" && logCallback !== null)
			throw new TypeError("The type of logCallback is invalid.");

		this.log =
			logCallback === null
				? null
				: (message) =>
						logCallback({
							level: "info",
							message: message,
						});
	}

	public onStatusUpdate(statusCallback: StatusCallback | null) {
		if (typeof statusCallback !== "function" && statusCallback !== null)
			throw new TypeError("The type of statusCallback is invalid.");

		this.updateStatus = statusCallback;
	}
}

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

import { FirebaseApp } from "@firebase/app";
import { App } from "firebase-admin/app";
import { Database, Unsubscribe, getDatabase, onValue, ref } from "@firebase/database";
import { Database as AdminDatabase, getDatabase as adminGetDatabase } from "firebase-admin/database";
import { RTDBError } from "./error";
import { Connection, ConnectionState } from "../connection";
import { Client, SignState } from "../client";

export class RTDBConnection extends Connection {
	protected _database: AdminDatabase | Database;
	private subscriptionCallback?: Unsubscribe;
	private timeoutID: ReturnType<typeof setTimeout> | undefined;

	constructor(client: Client) {
		super(client);

		if (!this.client.app || !this.client.clientInitialised)
			throw new RTDBError("RTDB is called before the Client is initialized");

		this._database = this.isAdminApp(this.client.app)
			? adminGetDatabase(this.client.app)
			: getDatabase(this.client.app);
	}

	public get database(): AdminDatabase | Database {
		return this._database;
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private isAdminApp(app: App | FirebaseApp): app is App {
		if (this.client.admin === undefined) throw new RTDBError("Property 'admin' missing in App class");
		return this.client.admin;
	}

	protected subscribeConnectionState(): void {
		// Caused by nextTick, so check that
		if (!this._database) return;

		const databaseURL = this._database.app.options.databaseURL;

		this.subscriptionCallback = onValue(
			ref(this._database as Database, ".info/connected"),
			(snapshot) => {
				if (snapshot.val() === true) {
					if (this.timeoutID) {
						clearTimeout(this.timeoutID);
						this.timeoutID = undefined;
					}
					this._state = ConnectionState.CONNECTED;
					this.firstConnectionEtablished = true;
					this.emit("connected");
					if (this.updateStatus) this.updateStatus("connected");
					if (this.log) this.log(`Connected to Firebase RTDB: ${databaseURL}`);
				} else {
					this._state = this._isOffline
						? ConnectionState.OFFLINE
						: this.firstConnectionEtablished
							? ConnectionState.RE_CONNECTING
							: ConnectionState.CONNECTING;

					if (this.firstConnectionEtablished) {
						this.emit("disconnect");
						if (this.updateStatus) this.updateStatus("disconnect");
					}

					if (this.client.signState === SignState.SIGN_OUT || this._isOffline) return;

					// Based on maximum time for Firebase admin
					this.timeoutID = setTimeout(() => {
						this._state = ConnectionState.DISCONNECTED;
						this.emit("disconnected");
						if (this.updateStatus) this.updateStatus("disconnected");
					}, 30000);

					this.emit(this.firstConnectionEtablished ? "re-connecting" : "connecting");
					if (this.updateStatus) this.updateStatus(this.firstConnectionEtablished ? "re-connecting" : "connecting");

					if (this.log)
						this.log(`${this.firstConnectionEtablished ? "Re-c" : "C"}onnecting to Firebase RTDB: ${databaseURL}`);
				}
			},
			(error) => {
				throw error;
			}
		);
	}

	public removeConnectionState(): void {
		if (this.subscriptionCallback) this.subscriptionCallback();

		this.subscriptionCallback = undefined;
	}
}

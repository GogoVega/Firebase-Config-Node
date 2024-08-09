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

import { App } from "firebase-admin/app";
import {
	getFirestore as adminGetFirestore,
	SetOptions,
	type Firestore as AdminDatabase,
} from "firebase-admin/firestore";
import { FirebaseApp } from "@firebase/app";
import {
	getFirestore,
	Firestore as Database,
	disableNetwork,
	enableNetwork,
	getDocs,
	DocumentReference,
	getDoc,
	onSnapshot,
	setDoc,
	updateDoc,
	deleteDoc,
} from "@firebase/firestore";

import { FirestoreError } from "./error";
import { DataSnapshot, ErrorCallback, QueryConfig, QueryMethod, SubscribeCallback, Unsubscribe } from "./types";
import { documentFrom, queryFrom, Snapshot } from "./utils";
import { Client } from "../client";

/**
 * Class representing a Firestore database.
 * @remarks Firestore has not a real connection state, so use the RTDB connection state instead.
 * See {@link https://firebase.google.com/docs/firestore/rtdb-vs-firestore?hl=en#presence | Firestore vs RTDB} presence comparison.
 * See also the simulated {@link https://firebase.google.com/docs/firestore/solutions/presence | Firestore presence} example.
 */
export class Firestore {
	private _database!: AdminDatabase | Database;
	private _isOffline: boolean = false;

	constructor(public readonly client: Client) {
		if (!(client instanceof Client)) throw new TypeError("Firestore must be instantiated with Client as parameter");

		this.getDatabase();
	}

	public get database(): AdminDatabase | Database {
		return this._database;
	}

	public get offline(): boolean {
		return this._isOffline;
	}

	private getDatabase() {
		if (!this.client.app || !this.client.clientInitialised)
			throw new FirestoreError("Firestore is called before the Client is initialized");

		this._database = this.isAdminApp(this.client.app)
			? adminGetFirestore(this.client.app)
			: getFirestore(this.client.app);
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private isAdmin(db: AdminDatabase | Database): db is AdminDatabase {
		if (this.client.admin === undefined) throw new FirestoreError("Property 'admin' missing in App class");
		return this.client.admin;
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private isAdminApp(app: App | FirebaseApp): app is App {
		if (this.client.admin === undefined) throw new FirestoreError("Property 'admin' missing in App class");
		return this.client.admin;
	}

	public goOffline(): Promise<void> {
		this._isOffline = true;
		// TODO: this._database.terminate() kill the instance
		return this._database instanceof Database ? disableNetwork(this._database) : Promise.resolve();
	}

	public goOnline(): Promise<void> {
		this._isOffline = false;
		// TODO: How to re-use the database after `terminate()`
		if (this._database instanceof Database) {
			return enableNetwork(this._database);
		}

		return Promise.resolve();
	}

	public async get(config: QueryConfig): Promise<DataSnapshot> {
		if (this.isAdmin(this._database)) {
			const snapshot = await queryFrom(this._database, config).get();

			return Snapshot.from(snapshot);
		}

		const query = queryFrom(this._database, config);

		if (query instanceof DocumentReference) {
			return Snapshot.from(await getDoc(query));
		}

		return Snapshot.from(await getDocs(query));
	}

	// For autocomple - TODO listDocuments
	public async listCollections(): Promise<Array<string>> {
		if (this.isAdmin(this._database)) {
			const collections = await this._database.listCollections();
			return collections.map((collection) => collection.id);
		}

		// TODO: Firebase JS don't have listCollections function
		return Promise.resolve([]);
	}

	public async modify(method: QueryMethod, config: QueryConfig, value?: object, options: SetOptions = {}) {
		switch (method) {
			case "set":
				if (!value || typeof value !== "object") throw new TypeError("Value to write must be an object");
				if (this.isAdmin(this._database)) {
					return documentFrom(this._database, config).set(value, options);
				}
				return setDoc(documentFrom(this._database, config), value, options);
			case "update":
				if (!value || typeof value !== "object") throw new TypeError("Value to write must be an object");
				if (this.isAdmin(this._database)) {
					return documentFrom(this._database, config).update(value);
				}
				return updateDoc(documentFrom(this._database, config), value);
			case "delete":
				if (this.isAdmin(this._database)) {
					return documentFrom(this._database, config).delete();
				}
				return deleteDoc(documentFrom(this._database, config));
			default:
				throw new Error(`Write method should be one of "set", "update" or "delete"`);
		}
	}

	public subscribe(config: QueryConfig, callback: SubscribeCallback, errorCallback?: ErrorCallback): Unsubscribe {
		if (this.isAdmin(this._database)) {
			return queryFrom(this._database, config).onSnapshot(
				(snapshot) => callback(Snapshot.from(snapshot)),
				errorCallback
			);
		}

		const query = queryFrom(this._database, config);

		if (query instanceof DocumentReference) {
			return onSnapshot(query, (snapshot) => callback(Snapshot.from(snapshot)), errorCallback);
		}

		return onSnapshot(query, (snapshot) => callback(Snapshot.from(snapshot)), errorCallback);
	}
}

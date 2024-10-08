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

import * as database from "@firebase/database";
import { Database, get, goOffline, goOnline, onDisconnect, query, QueryConstraint, ref } from "@firebase/database";
import { Database as AdminDatabase } from "firebase-admin/database";
import { RTDBConnection } from "./connection";
import { RTDBError } from "./error";
import { DataSnapshot } from "./utils";
import {
	Constraint,
	DatabaseReference,
	DataSnapshotType,
	Listener,
	ListenerMap,
	OnDisconnectQueryMethod,
	OnDisconnectQueryMethodMap,
	OnDisconnectQuerySignature,
	QueryMethod,
	QueryMethodMap,
	QuerySignature,
	SubscribeCallback,
	Unsubscribe,
} from "./types";
import { Client } from "../client";
import { Entry, printEnumKeys } from "../utils";

export class RTDB extends RTDBConnection {
	constructor(client: Client) {
		super(client);
	}

	private applyQueryConstraints(constraints?: Constraint): QueryConstraint[];
	private applyQueryConstraints(constraints: Constraint | undefined, dbRef: DatabaseReference): DatabaseReference;
	private applyQueryConstraints(constraints: Constraint = {}, dbRef?: DatabaseReference) {
		const query = [];

		if (typeof constraints !== "object") throw new TypeError("Query Constraint must be an Object!");

		for (const [method, value] of Object.entries(constraints) as Entry<Constraint>[]) {
			switch (method) {
				case "endAt":
				case "endBefore":
				case "equalTo":
				case "startAfter":
				case "startAt":
					if (typeof value !== "object")
						throw new TypeError(`The value of the "${method}" constraint must be an object!`);
					if (value.value === undefined)
						throw new TypeError(`The value of the "${method}" constraint must be an object containing "value" as key.`);
					if (
						typeof value.value !== "string" &&
						typeof value.value !== "boolean" &&
						typeof value.value !== "number" &&
						value.value !== null
					)
						throw new TypeError(
							`The value of the "${method}.value" constraint must be a boolean, number, string or null!`
						);

					if (value.key === null || (value.key && typeof value.key !== "string"))
						throw new TypeError(`The value of the "${method}.key" constraint must be a string!`);

					if (dbRef) {
						dbRef = dbRef[method](value.value, value.key);
					} else {
						query.push(database[method](value.value, value.key));
					}
					break;
				case "limitToFirst":
				case "limitToLast":
					if (typeof value !== "number")
						throw new TypeError(`The value of the "${method}" constraint must be a number!`);

					if (dbRef) {
						dbRef = dbRef[method](value);
					} else {
						query.push(database[method](value));
					}
					break;
				case "orderByChild":
					if (typeof value !== "string")
						throw new TypeError(`The value of the "${method}" constraint must be a string!`);

					if (dbRef) {
						dbRef = dbRef[method](value);
					} else {
						query.push(database[method](value));
					}
					break;
				case "orderByKey":
				case "orderByPriority":
				case "orderByValue":
					if (value !== null) throw new TypeError(`The value of the "${method}" constraint must be null!`);

					if (dbRef) {
						dbRef = dbRef[method]();
					} else {
						query.push(database[method]());
					}
					break;
				default:
					throw new Error(`Query constraint received: "${method}" is invalid!`);
			}
		}

		return dbRef || query;
	}

	private checkOnDisconnectQueryMethod(method: unknown): OnDisconnectQueryMethod {
		if (method === undefined) throw new TypeError("On Disconnect Query Method do not exist!");
		if (typeof method !== "string") throw new TypeError("On Disconnect Query Method must be a string!");
		if (method in OnDisconnectQueryMethodMap) return method as OnDisconnectQueryMethod;

		throw new Error(`On Disconnect Query Method must be one of ${printEnumKeys(OnDisconnectQueryMethodMap)}.`);
	}

	/**
	 * Checks path to match Firebase rules. Throws an error if does not match.
	 * @param path The path to check
	 * @param empty Can the path be empty? Default: `false`
	 * @returns The path checked to the database
	 */
	private checkPath(path: unknown, empty: true): string | undefined;

	/**
	 * Checks path to match Firebase rules. Throws an error if does not match.
	 * @param path The path to check
	 * @param empty Can the path be empty? Default: `false`
	 * @returns The path checked to the database
	 */
	private checkPath(path: unknown, empty?: false): string;

	private checkPath(path: unknown, empty?: boolean) {
		if (empty && path === undefined) return;
		if (!empty && path === undefined) throw new TypeError("The PATH do not exist!");
		if (!empty && !path) throw new TypeError("PATH must be non-empty string!");
		if (typeof path !== "string") throw new TypeError("PATH must be a string!");
		if (path.match(/[.#$\[\]]/g)) throw new Error(`PATH must not contain ".", "#", "$", "[", or "]"`);
		return path.trim() || undefined;
	}

	/**
	 * Checks if the priority is valid otherwise throws an error.
	 * @param priority The priority to be checked
	 * @returns The priority checked
	 */
	private checkPriority(priority: unknown) {
		if (priority === null) return priority;
		if (priority === undefined) throw new TypeError("The Priority do not exist!");
		if (typeof priority === "number" && Number.isInteger(priority) && priority > 0) return priority;
		if (typeof priority === "string") {
			const number = Number(priority);
			if (Number.isInteger(number) && number > 0) return number;
		}

		throw new TypeError("The priority must be an INTEGER > 0!");
	}

	/**
	 * Checks if the Query Method is valid otherwise throws an error.
	 * @param method The Query Method to be checked
	 * @returns The Query Method checked
	 */
	private checkQueryMethod(method: unknown): QueryMethod {
		if (method === undefined) throw new TypeError("Query Method do not exist!");
		if (typeof method !== "string") throw new TypeError("Query Method must be a string!");
		if (method in QueryMethodMap) return method as QueryMethod;

		throw new Error(`Query Method must be one of ${printEnumKeys(QueryMethodMap)}.`);
	}

	public async get(path?: string, constraints?: object): Promise<DataSnapshotType> {
		const pathParsed = this.checkPath(path, true);

		if (this.isAdmin(this.database)) {
			const database = pathParsed ? this.database.ref().child(pathParsed) : this.database.ref();

			return DataSnapshot.from(await this.applyQueryConstraints(constraints, database).get());
		}

		return DataSnapshot.from(
			await get(query(ref(this.database, pathParsed), ...this.applyQueryConstraints(constraints)))
		);
	}

	public goOffline() {
		this._isOffline = true;
		if (this._database instanceof Database) {
			goOffline(this._database);
		} else {
			this._database.goOffline();
		}
		this.removeConnectionState();
	}

	public goOnline() {
		this._isOffline = false;
		if (this._database instanceof Database) {
			goOnline(this._database);
		} else {
			this._database.goOnline();
		}
		this.subscribeConnectionState();
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private isAdmin(db: AdminDatabase | Database): db is AdminDatabase {
		if (this.client.admin === undefined) throw new RTDBError("Property 'admin' missing in App class");
		return this.client.admin;
	}

	public async modify<K extends keyof QuerySignature>(method: K, path: string, ...args: QuerySignature[K]) {
		const methodParsed = this.checkQueryMethod(method);
		const pathParsed = this.checkPath(path, false);
		const [value, priority] = args;

		if (this.isAdmin(this._database)) {
			switch (methodParsed) {
				case "update":
					if (value && typeof value === "object") {
						await this._database.ref().child(pathParsed)[methodParsed](value);
						break;
					}

					throw new TypeError('The value to write must be an object with "update" query');
				case "remove":
					await this._database.ref().child(pathParsed)[methodParsed]();
					break;
				case "setPriority":
					await this._database
						.ref()
						.child(pathParsed)
						.setPriority(this.checkPriority(priority), (err) => {
							if (err) throw err;
						});
					break;
				case "setWithPriority":
					await this._database.ref().child(pathParsed)[methodParsed](value, this.checkPriority(priority));
					break;
				default:
					await this._database.ref().child(pathParsed)[methodParsed](value);
					break;
			}
		} else {
			switch (methodParsed) {
				case "update":
					if (value && typeof value === "object") {
						await database[methodParsed](ref(this._database, pathParsed), value);
						break;
					}

					throw new TypeError('The value to write must be an object with "update" query.');
				case "remove":
					await database[methodParsed](ref(this._database, pathParsed));
					break;
				case "setPriority":
					await database[methodParsed](ref(this._database, pathParsed), this.checkPriority(priority));
					break;
				case "setWithPriority":
					await database[methodParsed](ref(this._database, pathParsed), value, this.checkPriority(priority));
					break;
				default:
					await database[methodParsed](ref(this._database, pathParsed), value);
					break;
			}
		}
	}

	public async modifyOnDisconnect<K extends keyof OnDisconnectQuerySignature>(
		method: K,
		path: string,
		...args: OnDisconnectQuerySignature[K]
	) {
		const methodParsed = this.checkOnDisconnectQueryMethod(method);
		const pathParsed = this.checkPath(path, false);
		const [value, priority] = args;

		const databaseRef = this.isAdmin(this._database)
			? this._database.ref().child(pathParsed).onDisconnect()
			: onDisconnect(ref(this._database, pathParsed));

		switch (methodParsed) {
			case "cancel":
			case "remove":
				await databaseRef[methodParsed]();
				break;
			case "set":
				await databaseRef[methodParsed](value);
				break;
			case "update":
				if (value && typeof value === "object") {
					await databaseRef[methodParsed](value);
					break;
				}

				throw new TypeError("The value must be an object with 'update' query.");
			case "setWithPriority":
				await databaseRef[methodParsed](value, this.checkPriority(priority));
				break;
		}
	}

	public subscribe(
		listener: Listener,
		callback: SubscribeCallback,
		errorCallback: (error: Error) => void,
		path?: string,
		constraints?: Constraint
	): Unsubscribe {
		if (typeof callback !== "function") throw new TypeError("The callback must be a function");
		if (!(listener in ListenerMap)) throw new Error(`The listener "${listener}" is invalid!`);

		const pathParsed = this.checkPath(path, true);

		if (this.isAdmin(this._database)) {
			const databaseRef = pathParsed ? this._database.ref().child(pathParsed) : this._database.ref();

			const subscription = this.applyQueryConstraints(constraints, databaseRef).on(
				listener,
				(snapshot, child) => callback(DataSnapshot.from(snapshot), child),
				errorCallback
			);

			return () => databaseRef.off(listener, subscription);
		} else {
			return database[ListenerMap[listener]](
				query(ref(this._database, pathParsed), ...this.applyQueryConstraints(constraints)),
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(snapshot: any, child?: string | null) => callback(DataSnapshot.from(snapshot), child),
				errorCallback
			);
		}
	}
}

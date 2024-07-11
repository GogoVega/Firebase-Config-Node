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
import { getFirestore, Firestore as Database } from "@firebase/firestore";
import { App } from "firebase-admin/app";
import { getFirestore as adminGetFirestore, Firestore as AdminDatabase } from "firebase-admin/firestore";
import { FirestoreError } from "./error";
import { Client } from "../client";

export class Firestore {
	private _database!: AdminDatabase | Database;

	constructor(public readonly client: Client) {
		if (!(client instanceof Client)) throw new TypeError("Firestore must be instantiated with Client as parameter");

		this.getDatabase();
	}

	public get database(): AdminDatabase | Database {
		return this._database;
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
	protected isAdminApp(app: App | FirebaseApp): app is App {
		if (this.client.admin === undefined) throw new FirestoreError("Property 'admin' missing in App class");
		return this.client.admin;
	}

	// TODO: add methods for querying
}

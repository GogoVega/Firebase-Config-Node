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

import { App, AppOptions, deleteApp, initializeApp } from "firebase-admin/app";

export class AdminApp {
	private _app: App;
	private _deleted: boolean = false;
	public readonly admin: boolean = true;

	constructor(options: AppOptions, name?: string) {
		this._app = initializeApp(options, name);
	}

	public get app(): App {
		return this._app;
	}

	public get deleted(): boolean {
		return this._deleted;
	}

	public deleteApp(): Promise<void> {
		this._deleted = true;
		return deleteApp(this._app);
	}
}

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

import { FirebaseApp, FirebaseError } from "@firebase/app";
import {
	Auth,
	UserCredential,
	createUserWithEmailAndPassword,
	fetchSignInMethodsForEmail,
	getAuth,
	signInAnonymously,
	signInWithCustomToken,
	signInWithEmailAndPassword,
	signOut,
} from "@firebase/auth";
import { App as FirebaseAdminApp, AppOptions, cert } from "firebase-admin/app";
import { TypedEmitter } from "tiny-typed-emitter";
import { ClientError } from "./error";
import { AppConfig, ClientEvents, Credentials, SignInFn, SignState } from "./types";
import { checkJSONCredential, createCustomToken } from "./utils";
import { AdminApp, App } from "../app";
import { LogCallback, LogFn } from "../logger";

export class Client extends TypedEmitter<ClientEvents> {
	private _app?: AdminApp | App;
	private _auth?: Auth;
	private _clientInitialised: boolean = false;
	private _signState: SignState = SignState.NOT_YET;
	private warn: LogFn | null = null;

	constructor(
		protected appConfig: AppConfig,
		protected appName?: string
	) {
		super();
	}

	public get admin(): boolean | undefined {
		return this._app?.admin;
	}

	public get app(): FirebaseApp | FirebaseAdminApp | undefined {
		return this._app?.app;
	}

	public get clientDeleted(): boolean | undefined {
		return this._app?.deleted;
	}

	public get clientInitialised(): boolean | undefined {
		return this._clientInitialised;
	}

	public get signState(): SignState {
		return this._signState;
	}

	public onLog(logCallback: LogCallback) {
		if (typeof logCallback !== "function" && logCallback !== null)
			throw new TypeError("The type of logCallback is invalid.");

		this.warn =
			logCallback === null
				? null
				: (message) =>
						logCallback({
							level: "info",
							message: message,
						});
	}

	private deleteClient(): Promise<void> {
		if (!this._app) throw new ClientError("'deleteClient' called before 'signIn' call");
		if (this._app.deleted === true) throw new ClientError("Client already deleted");

		return this._app.deleteApp();
	}

	public signInAnonymously(): Promise<UserCredential> {
		return this.wrapSignIn(() => signInAnonymously(this._auth as Auth));
	}

	public signInWithCustomToken(cred: Credentials, uid: string, claims?: object): Promise<UserCredential> {
		return this.wrapSignIn(async () => {
			const token = await createCustomToken(cred, uid, claims);
			return signInWithCustomToken(this._auth as Auth, token);
		});
	}

	public async signInWithEmailAndPassword(
		email: string,
		password: string,
		createUser?: boolean
	): Promise<UserCredential> {
		return this.wrapSignIn(async () => {
			// Checks if the user already has an account otherwise it creates one
			const method = await fetchSignInMethodsForEmail(this._auth as Auth, email);

			if (method.length === 0 && createUser) {
				const user = await createUserWithEmailAndPassword(this._auth as Auth, email, password);

				this.warn &&
					this.warn(
						`The user "${email}" has been successfully created. You can delete it in the Authenticate section if it is an error.`
					);

				return user;
			} else if (method.includes("password")) {
				return signInWithEmailAndPassword(this._auth as Auth, email, password);
			} else {
				throw new FirebaseError("auth/unknown-email", "Unknown email");
			}
		});
	}

	public signInWithPrivateKey(projectId: string, clientEmail: string, privateKey: string): Promise<void> {
		const credential = { credential: cert(checkJSONCredential({ clientEmail, privateKey, projectId })) };
		return this.wrapSignIn({ ...this.appConfig, ...credential });
	}

	/**
	 * Only available for Google Functions
	 * https://github.com/firebase/firebase-admin-node/issues/224
	 * @param serviceAccountId
	 */
	public signInWithServiceAccountId(serviceAccountId: string): Promise<void> {
		return this.wrapSignIn({ ...this.appConfig, serviceAccountId });
	}

	public async signOut(): Promise<void> {
		if (this.signState === SignState.NOT_YET) throw new ClientError("signOut called before signIn call");
		if (this.signState === SignState.SIGN_OUT) throw new ClientError("signOut already called");

		// The app is created regardless of whether the client has been initialized
		// If initialized sign out, otherwise skip
		if (this._clientInitialised) {
			this._signState = SignState.SIGN_OUT;
			this.emit("sign-out");

			if (!this.admin) await signOut(this._auth!);
		}

		return this.deleteClient();
	}

	private async wrapSignIn(config: AppOptions): Promise<void>;
	private async wrapSignIn(signInFn: SignInFn): Promise<UserCredential>;
	private async wrapSignIn(configOrSignInFn: AppOptions | SignInFn): Promise<UserCredential | void> {
		let success = false;

		if (this._signState === SignState.SIGNED_IN) throw new ClientError("Client already Signed in, Sign out before");
		if (this._app?.deleted === true) throw new ClientError("Client deleted");

		const admin = typeof configOrSignInFn === "object";
		const config = admin ? configOrSignInFn : this.appConfig;
		const signInFn = typeof configOrSignInFn === "function" ? configOrSignInFn : () => Promise.resolve();

		try {
			this._signState = SignState.SIGN_IN;
			this.emit("sign-in");
			this._app = admin ? new AdminApp(config, this.appName) : new App(this.appConfig, this.appName);
			this._auth = admin ? undefined : getAuth(this._app.app as FirebaseApp);
			this._clientInitialised = true;
			const user = await signInFn();
			this._signState = SignState.SIGNED_IN;
			success = true;
			return user;
		} finally {
			if (!success) this._signState = SignState.ERROR;
			this.emit(success ? "signed-in" : "sign-in-error");
		}
	}
}

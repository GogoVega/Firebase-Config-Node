/**
 * Copyright 2023 Gauthier Dandele
 *
 * Licensed under the MIT License,
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://opensource.org/licenses/MIT.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NodeAPI, NodeStatus } from "node-red";
import { Client, FirebaseError, isFirebaseError, ServiceAccount, SignState } from "../firebase/client";
import { Firestore } from "../firebase/firestore";
import { LogCallbackParams, onLog } from "../firebase/logger";
import { RTDB } from "../firebase/rtdb";
import { firebaseError, nodeStatus } from "./const";
import { Config, ConfigNode, ConnectionStatus, JSONContentType, ServiceType, StatusListeners } from "./types";

/**
 * Firebase Class
 *
 * This class is used to communicate with Google Firebase.
 *
 * The modules used are `firebase` and `firebase-admin`.
 *
 * The Authentication Methods are:
 * - Anonymous
 * - Email and Password
 * - Private Key (SDK Admin)
 * - Custom Token Generated with Private Key
 *
 * @param node The `config-node` to associate with this class
 * @returns A FirebaseConfig Class
 */
export class FirebaseClient {
	private globalStatus: NodeStatus = nodeStatus.disconnected;
	/**
	 * Property called by the `Firebase:log` event. Gets the log in order to make it an error and to update the status of
	 * the nodes.
	 * @param log The log received
	 */
	private onLog: (log: LogCallbackParams) => void = (log: LogCallbackParams) => {
		if (log.message.includes("URL of your Firebase Realtime Database instance configured correctly")) {
			// Ignore if log is not for this instance
			if (!log.message.includes(this.node.credentials.url)) return;
			return this.onError(new FirebaseError("auth/invalid-database-url", ""));
		}

		if (log.message.includes("Invalid grant: account not found"))
			return this.onError(new FirebaseError("auth/invalid-client-id", ""));

		if (log.message.includes("Error while making request: getaddrinfo ENOTFOUND accounts.google.com"))
			return this.onError(new FirebaseError("auth/network-request-failed", ""));

		if (log.message.includes("app/invalid-credential"))
			return this.onError(new FirebaseError("auth/invalid-credential", ""));
	};
	private statusListeners: StatusListeners = { firestore: [], rtdb: [], storage: [] };

	constructor(
		private node: ConfigNode,
		config: Config,
		private RED: NodeAPI
	) {
		node.config = config;
		node.addStatusListener = this.addStatusListener.bind(this);
		node.clientSignedIn = this.clientSignedIn.bind(this);
		node.removeStatusListener = this.removeStatusListener.bind(this);
		node.setCurrentStatus = this.setCurrentStatus.bind(this);
		this.enableGlobalLogHandler();
	}

	private addStatusListener(id: string, type: ServiceType) {
		this.statusListeners[type].push(id);
		// the node does not yet exist at this step => getNode returns null
		setImmediate(() => this.setCurrentStatus(id));
		this.restoreDestroyedConnection();
		this.initDatabase(type);
	}

	private clientSignedIn(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			try {
				if (this.node.client?.signState === undefined) return reject("SignState missing");
				if (this.node.client.signState === SignState.SIGNED_IN) return resolve(true);
				if (this.node.client.signState === SignState.ERROR) return resolve(false);

				this.node.client.once("signed-in", () => resolve(true));
				this.node.client.once("sign-in-error", () => resolve(false));
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Creates and initializes a callback to verify that the config node is in use.
	 * Otherwise the connection with Firebase will be closed.
	 * @param removed A flag that indicates whether the node is being closed because it has been removed entirely,
	 * or that it is just being restarted.
	 * If `true`, execute the callback otherwise skip it.
	 */
	private destroyUnusedConnection(removed: boolean) {
		const { name } = this.node.config;
		const { rtdb, firestore } = this.statusListeners;

		// TODO: vérifier si utile
		if (!removed) return;

		if (!rtdb.length && !firestore.length)
			this.node.warn(`WARNING: '${name}' config node is unused! All connections with Firebase will be closed...`);

		// TODO: Add firestore
		if (rtdb.length === 0 && this.node.rtdb) {
			this.node.rtdb.goOffline();
			this.node.log("Connection with Firebase RTDB was closed because no node used.");
		}
	}

	private disableGlobalLogHandler() {
		this.RED.events.removeListener("Firebase:log", this.onLog);
	}

	/**
	 * Creates and initializes a logging to get warning message from bad database url configured and invalid credentials
	 * in order to make it an error message.
	 */
	private enableGlobalLogHandler() {
		// Works for both databases
		// Known Issue: how to know which module returned the log?
		if (!this.RED.events.eventNames().includes("Firebase:log"))
			onLog((log) => this.RED.events.emit("Firebase:log", log), { level: "warn" });

		this.RED.events.on("Firebase:log", this.onLog);
	}

	private getClaims() {
		const claims = this.node.config.claims || {};

		return Object.entries(claims).reduce<Record<string, unknown>>((acc, [key, value]) => {
			acc[key] = value.value;
			return acc;
		}, {});
	}

	/**
	 * Get credentials from JSON content of `config-node`.
	 * @returns The JSON content credentials
	 */
	private getJSONCredentials(): ServiceAccount {
		const content: JSONContentType = JSON.parse(this.node.credentials.json || "{}");
		const cred: Partial<ServiceAccount> = {};

		if (Object.keys(content).length === 0) {
			const { credentials } = this.node;
			const projectId = credentials.url
				?.split("https://")
				.pop()
				?.split(/-default-rtdb\.((asia-southeast1|europe-west1)\.firebasedatabase\.app|firebaseio\.com)(\/)?$/)[0];

			// For line breaks issue
			const privateKey = JSON.stringify(credentials.privateKey)
				?.replace(/\\\\n/gm, "\n")
				.replaceAll('"', "")
				.replaceAll("\\", "");

			cred.clientEmail = credentials.clientEmail;

			// The introduction of 'projectId' in the credentials also introduces the change from 'val()' to 'data("data")'
			// which no longer needs to be stringify to solve the line breaks issue
			cred.privateKey = privateKey.match("\n") === null ? credentials.privateKey : privateKey;
			cred.projectId = credentials.projectId || projectId;

			// For json input (deprecated)
		} else {
			cred.clientEmail = content.clientEmail || content.client_email;
			cred.privateKey = content.privateKey || content.private_key;
			cred.projectId = content.projectId || content.project_id;
		}

		return cred as ServiceAccount;
	}

	private initDatabase(type: ServiceType) {
		type === "firestore" && this.initFirestore();
		type === "rtdb" && this.initRTDB();
	}

	private initFirestore() {
		// Skip if database already instanciate
		if (this.node.firestore) return;
		if (!this.node.client?.clientInitialised) return;

		// TODO: Add log
		this.node.firestore = new Firestore(this.node.client);
	}

	private initRTDB() {
		// Skip if database already instanciate
		if (this.node.rtdb) return;
		if (!this.node.client?.clientInitialised) return;

		this.node.rtdb = new RTDB(this.node.client);

		this.node.rtdb.onLog(({ level, message }) => this.node[level === "info" ? "log" : level](message));
		this.node.rtdb.onStatusUpdate((status) => this.updateGlobalStatus(status));
	}

	/**
	 * Connects to Firebase with the authentication method defined in the `config-node`.
	 */
	public async logIn() {
		try {
			// Initialize the Client
			this.node.client = new Client(
				{
					apiKey: this.node.credentials.apiKey,
					databaseURL: this.node.credentials.url,
					projectId: this.node.credentials.projectId,
					// storageBucket: this.node.credentials.storageBucket,
				},
				this.node.id
			);

			// Initialize Client Logging
			// No info for now
			this.node.client.onLog((msg) => msg.level === "warn" && this.node.warn(msg.message));

			// Sign In
			switch (this.node.config.authType) {
				case "anonymous":
					await this.node.client.signInAnonymously();
					break;
				case "email": {
					const { email, password } = this.node.credentials;
					const createUser = this.node.config.createUser;
					await this.node.client.signInWithEmailAndPassword(email, password, createUser);
					break;
				}
				case "privateKey": {
					const { clientEmail, privateKey, projectId } = this.getJSONCredentials();
					this.node.client.signInWithPrivateKey(projectId, clientEmail, privateKey);
					break;
				}
				case "customToken": {
					const claims = this.getClaims();
					const cred = this.getJSONCredentials();
					const uid = this.node.credentials.uid;
					await this.node.client.signInWithCustomToken(cred, uid, claims);
					break;
				}
			}
		} catch (error) {
			this.onError(error);
		}
	}

	/**
	 * Disconnects from Firebase.
	 * @returns A promise for Firebase disconnection completion
	 */
	public logOut() {
		if (!this.node.client?.clientInitialised) return Promise.resolve();

		// TODO: Add firestore
		const rtdbOnline = this.node.rtdb && !this.node.rtdb.offline;

		if (rtdbOnline) this.node.log("Closing connection with Firebase RTDB");

		this.disableGlobalLogHandler();

		return this.node.client.signOut();
	}

	/**
	 * A custom method in case of error allowing to send a predefined error message if this error is known
	 * otherwise returns the message as it is.
	 * @param error The error received
	 * @param done If defined this callback will return the error message
	 */
	public onError(error: FirebaseError | unknown) {
		const msg = isFirebaseError(error)
			? firebaseError[error.code.split(".")[0]]
			: error instanceof Error
			? error.message || error.toString()
			: error;
		const status = isFirebaseError(error) && /auth\/network-request-failed/.test(error.code) ? "no-network" : "error";
		const text =
			isFirebaseError(error) && error.code.startsWith("auth/")
				? error.code.split("auth/").pop()?.split(".")[0].replace(/-/gm, " ").toPascalCase()
				: undefined;

		this.updateGlobalStatus(status, text);
		this.node.error(msg);
	}

	private removeStatusListener(id: string, type: ServiceType, removed: boolean, done: () => void) {
		try {
			const nodes = this.statusListeners[type];

			// Remove id from array
			nodes.forEach((nodeID) => {
				if (nodeID !== id) return;
				nodes.splice(nodes.indexOf(id), 1);
			});

			this.destroyUnusedConnection(removed);

			done();
		} catch (error) {
			// done(error) not yet supported for close event
			this.node.error(error);
		}
	}

	/**
	 * Restores the connection with Firebase if at least one node is activated.
	 * @remarks This method should only be used if the connection has been destroyed.
	 */
	private restoreDestroyedConnection() {
		// TODO: Add firestore
		if (this.node.rtdb?.offline) this.node.rtdb.goOnline();
	}

	private setCurrentStatus(id: string) {
		this.RED.nodes.getNode(id).status(this.globalStatus);
	}

	private updateGlobalStatus(status: ConnectionStatus, text?: string) {
		const newGlobalStatus: NodeStatus =
			status === "error"
				? { fill: "red", shape: "dot", text: `Error${text ? ": ".concat(text) : ""}` }
				: nodeStatus[status];

		// Save the status
		this.globalStatus = newGlobalStatus;

		// TODO: Status pour firestore
		for (const listeners of Object.values(this.statusListeners) as Array<Array<string>>) {
			listeners.forEach((id) => this.RED.nodes.getNode(id).status(newGlobalStatus));
		}
	}
}

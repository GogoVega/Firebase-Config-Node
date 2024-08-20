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
import { generateIndexOnWarningMsg } from "./utils";
// To import `toPascalCase`
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./utils");

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
	private destroyUCMsgEmitted: boolean = false;
	private globalStatus: NodeStatus = nodeStatus.disconnected;
	private onFlowsStarted: () => void = () => this.destroyUnusedConnection();
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

		// Check if indexOn is setted
		const result = log.message.match(/Consider adding ".indexOn": "([a-z]+)" at \/([a-z/]+) to your security rules/);
		if (result) {
			const [childOrValue, path] = result.slice(1);
			this.node.warn(generateIndexOnWarningMsg(path, childOrValue));
		}
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
		this.enableConnectionHandler();
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
	 * Checks for each database if at least one parent node is attached, otherwise the connection with this database
	 * will be closed.
	 */
	private destroyUnusedConnection() {
		const { name } = this.node.config;
		const { rtdb, firestore } = this.statusListeners;

		if (!rtdb.length && !firestore.length && !this.destroyUCMsgEmitted) {
			this.destroyUCMsgEmitted = true;
			this.node.warn(`WARNING: '${name}' config node is unused! All connections with Firebase will be closed...`);
		}

		if (rtdb.length === 0 && this.node.rtdb && !this.node.rtdb.offline) {
			this.node.rtdb.goOffline();
			this.node.log("Connection with Firebase RTDB was closed because no node used.");
		}

		if (firestore.length === 0 && this.node.firestore && !this.node.firestore.offline) {
			this.node.firestore.goOffline();
			this.node.log("Connection with Firestore was closed because no node used.");
		}
	}

	private disableGlobalLogHandler() {
		this.RED.events.removeListener("Firebase:log", this.onLog);
	}

	private disableConnectionHandler() {
		this.RED.events.removeListener("flows:started", this.onFlowsStarted);
	}

	/**
	 * Creates and initializes a callback to verify that the config node is in use.
	 * Checks for each database if at least one parent node is attached, otherwise the connection with this database
	 * will be closed.
	 */
	private enableConnectionHandler() {
		this.RED.events.on("flows:started", this.onFlowsStarted);
	}

	/**
	 * Creates and initializes a logging to get warning message from bad database url configured and invalid credentials
	 * in order to make it an error message.
	 */
	private enableGlobalLogHandler() {
		// Works for both databases - for ALL config-node instances - call onlog once and ONLY once
		// Known Issue: how to know which module returned the log?
		if (!this.RED.events.eventNames().includes("Firebase:log"))
			onLog((log) => this.RED.events.emit("Firebase:log", log), { level: "warn" });

		this.RED.events.on("Firebase:log", this.onLog);
	}

	/**
	 * Evaluates a node property value according to its type.
	 *
	 * @param value the raw value
	 * @param type the type of the value
	 * @return A promise with the evaluted property
	 */
	private evaluateNodeProperty(value: string, type: string) {
		return new Promise((resolve, reject) =>
			this.RED.util.evaluateNodeProperty(value, type, this.node, {}, (error, result) => {
				if (error) return reject(error);

				resolve(result);
			})
		);
	}

	private getClaims() {
		const claims = this.node.config.claims || {};

		return Object.entries(claims).reduce<Promise<Record<string, unknown>>>(async (accP, [key, value]) => {
			const acc = await accP;
			acc[key] = await this.evaluateNodeProperty(value.value, value.type);
			return acc;
		}, Promise.resolve({}));
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
		// Init RTDB for connection status if no Firebase node used
		if (this.node.config.status?.firestore && !this.statusListeners.rtdb.length) {
			this.statusListeners.rtdb.push("fake-node-for-status");
			this.initRTDB();
		}

		if (type === "firestore") {
			this.initFirestore();
		} else if (type === "rtdb") {
			this.initRTDB();
		}
	}

	private initFirestore() {
		// Skip if database already instanciate
		if (this.node.firestore) return;
		if (!this.node.client?.clientInitialised) return;

		// TODO: Add log
		this.node.firestore = new Firestore(this.node.client);
	}

	private initRTDB() {
		// Skip if database already instanciated
		if (this.node.rtdb) return;
		if (!this.node.client?.clientInitialised) return;
		// TODO: pas l'idéal (comment gérer une mauvaise URL)
		if (this.statusListeners.rtdb.length > 1) return;

		try {
			this.node.rtdb = new RTDB(this.node.client);
			this.node.rtdb.onLog(({ level, message }) => this.node[level === "info" ? "log" : level](message));
			this.node.rtdb.onStatusUpdate((status) => this.updateGlobalStatus(status));
		} catch (error) {
			// For fatal error like DB URL missing
			if (error instanceof Error) {
				if (
					error.message.includes("Can't determine Firebase Database URL.") ||
					error.message.includes("Cannot parse Firebase url")
				)
					return this.onError(new FirebaseError("auth/invalid-database-url", ""));
			}

			this.node.error(error);
		}
	}

	/**
	 * Connects to Firebase with the authentication method defined in the `config-node`.
	 */
	public logIn() {
		(async () => {
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

				// Not ideal but it's common practice for Node-RED
				this.node.client.setMaxListeners(0);

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
						const claims = await this.getClaims();
						const cred = this.getJSONCredentials();
						const uid = this.node.credentials.uid;
						await this.node.client.signInWithCustomToken(cred, uid, claims);
						break;
					}
				}
			} catch (error) {
				this.onError(error);
			}
		})();
	}

	/**
	 * Disconnects from Firebase.
	 * @param done A function called when Firebase logout is complete
	 */
	public logOut(done: () => void) {
		(async () => {
			try {
				if (!this.node.client) return done();

				// TODO: Add firestore
				const rtdbOnline = this.node.rtdb && !this.node.rtdb.offline;
				const firestoreOnline = this.node.firestore && !this.node.firestore.offline;

				if (rtdbOnline) this.node.log("Closing connection with Firebase RTDB");
				if (firestoreOnline) this.node.log("Closing connection with Firestore");

				// Only RTDB has connection state
				this.node.rtdb?.removeConnectionState();

				this.disableConnectionHandler();
				this.disableGlobalLogHandler();

				await this.node.client.signOut();

				done();
			} catch (error) {
				// done(error) not yet supported for close event
				this.node.error(error);
				done();
			}
		})();
	}

	/**
	 * A custom method in case of error allowing to send a predefined error message if this error is known
	 * otherwise returns the message as it is.
	 * @param error The error received
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
		this.node.error(msg || error);
	}

	private removeStatusListener(id: string, type: ServiceType, done: () => void) {
		try {
			const nodes = this.statusListeners[type];

			// Remove id from array
			const indexToRemove = nodes.indexOf(id);
			if (indexToRemove !== -1) nodes.splice(indexToRemove, 1);

			done();
		} catch (error) {
			// done(error) not yet supported for close event
			this.node.error(error);
			done();
		}
	}

	/**
	 * Restores the connection with Firebase if at least one node is activated.
	 * @remarks This method should only be used if the connection has been destroyed.
	 */
	private restoreDestroyedConnection() {
		this.destroyUCMsgEmitted = false;
		if (this.node.rtdb?.offline && this.statusListeners.rtdb) this.node.rtdb.goOnline();
		if (this.node.firestore?.offline && this.statusListeners.firestore) this.node.firestore.goOnline();
	}

	private setCurrentStatus(id: string) {
		const { rtdb, firestore, storage } = this.statusListeners;

		// If the database has no connection state, need to clear the status to avoid keeping the default status
		if (
			rtdb.includes(id) ||
			(firestore.includes(id) && this.node.config.status?.firestore) ||
			(storage.includes(id) && this.node.config.status?.storage)
		) {
			this.RED.nodes.getNode(id)?.status(this.globalStatus);
		} else {
			this.RED.nodes.getNode(id)?.status({});
		}
	}

	private updateGlobalStatus(status: ConnectionStatus, text?: string) {
		// Keep error message if connection message comes
		if (this.globalStatus.text?.startsWith("Error") && status !== "error") return;

		const newGlobalStatus: NodeStatus =
			status === "error"
				? { fill: "red", shape: "dot", text: `Error${text ? ": ".concat(text) : ""}` }
				: nodeStatus[status];

		// Save the status
		this.globalStatus = newGlobalStatus;

		const nodes = this.statusListeners.rtdb;

		// Add status to Firestore and Storage nodes
		// Transmit status to all nodes if it's an error
		if (this.node.config.status?.firestore || status === "error") {
			nodes.push(...this.statusListeners.firestore);
		}
		if (this.node.config.status?.storage || status === "error") {
			nodes.push(...this.statusListeners.storage);
		}

		nodes.forEach((id) => this.RED.nodes.getNode(id)?.status(newGlobalStatus));
	}
}

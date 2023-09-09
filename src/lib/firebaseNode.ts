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

import { NodeAPI } from "node-red";
import { Client, FirebaseError, isFirebaseError, LogCallbackParams, onLog, RTDB, SignState } from "@gogovega/firebase-nodejs";
import { firebaseError } from "./const";
import { ConfigType, JSONContentType, NodeType, ServiceAccount } from "./types";

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
export class FirebaseConfig {
	constructor(private node: NodeType, config: ConfigType, RED: NodeAPI) {
		node.config = config;
		node.RED = RED;
		node.registeredNodes = { firestore: [], rtdb: [], storage: [] };
		node.clientSignedIn = this.clientSignedIn.bind(this);
		node.getRTDB = this.getRTDB.bind(this);
		node.destroyUnusedConnection = this.destroyUnusedConnection.bind(this);
		node.restoreDestroyedConnection = this.restoreDestroyedConnection.bind(this);
		this.initLogging();
	}

	/**
	 * This property contains the identifier of the timer used to check if the config-node is unused
	 * and will be used to clear the timeout in case at least one node is linked to this database.
	 */
	private destructionTimeouID?: ReturnType<typeof setTimeout>;

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
	 * @note Use of a timer is essential because it's necessary to allow time for all nodes to start before checking
	 * the number of nodes connected to this database.
	 * @param removed A flag that indicates whether the node is being closed because it has been removed entirely,
	 * or that it is just being restarted.
	 * If `true`, execute the callback after 15s otherwise skip it.
	 */
	private destroyUnusedConnection(removed: boolean) {
		const { rtdb } = this.node.registeredNodes;

		if (!removed || rtdb.length > 0) return;

		this.destructionTimeouID = setTimeout(() => {
			if (rtdb.length === 0 && this.node.rtdb) {
				this.node.warn(
					`WARNING: '${this.node.config.name}' config node is unused! The connection with Firebase RTDB will be closed.`
				);
				this.node.rtdb.goOffline();
				this.node.log("Connection with Firebase RTDB was closed because no node used.")
			}
		}, 15000);
	}

	private getClaims() {
		const claims = this.node.config.claims || {};

		return Object.entries(claims).reduce<Record<string, unknown | never>>((acc, [key, value]) => {
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
			const projectId = this.node.credentials.url
				?.split("https://")
				.pop()
				?.split(/-default-rtdb\.((asia-southeast1|europe-west1)\.firebasedatabase\.app|firebaseio\.com)(\/)?$/)[0];

			// For line breaks issue
			const privateKey = JSON.stringify(this.node.credentials.privateKey)
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

	private getRTDB() {
		// Skip if database already instanciate
		if (this.node.rtdb) return;
		if (!this.node.client?.clientInitialised) return;

		this.node.rtdb = new RTDB(this.node.client);
		this.initConnectionState();
	}

	private initConnectionState() {
		const { rtdb } = this.node.registeredNodes;

		this.node.rtdb && this.node.rtdb
			.on("connecting", () => this.setNodesConnecting(rtdb))
			.on("connected", () => this.setNodesConnected(rtdb))
			.on("disconnected", () => this.setNodesDisconnected(rtdb))
			.on("re-connecting", () => this.setNodesReconnecting(rtdb))
			.on("log", (msg) => this.node.log(msg));
	}

	/**
	 * Creates and initializes a logging to get warning message from bad database url configured and invalid credentials
	 * in order to make it an error message.
	 */
	private initLogging() {
		// Works for both databases
		// Known Issue: how to know which module returned the log?
		if (!this.node.RED.events.eventNames().includes("Firebase:log"))
			onLog((log) => this.node.RED.events.emit("Firebase:log", log), { level: "warn" });

		this.node.RED.events.on("Firebase:log", this.onLog);
	}

	/**
	 * Connects to Firebase with the authentication method defined in the `config-node`.
	 */
	public logIn() {
		(async () => {
			try {
				// Initialize App
				this.node.client = new Client({
					apiKey: this.node.credentials.apiKey,
					databaseURL: this.node.credentials.url,
					projectId: this.node.credentials.projectId,
					// storageBucket: this.node.credentials.storageBucket,
				}, this.node.id);

				// Initialize Client Logging
				this.node.client.on("warn", (msg) => this.node.warn(msg));

				// Log In
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
						const uid  = this.node.credentials.uid;
						await this.node.client.signInWithCustomToken(cred, uid, claims);
						break;
					}
				}
			} catch (error) {
				this.onError(error as Error);
			}
		})();
	}

	/**
	 * Disconnects from Firebase.
	 * @returns A promise for Firebase disconnection completion
	 */
	public logOut() {
		if (!this.node.client?.clientInitialised) return Promise.resolve();

		// If Node-RED is restarted, stop the timeout (avoid goOffline after logout request)
		clearTimeout(this.destructionTimeouID);
		this.node.rtdb && !this.node.rtdb.offline && this.node.log(`Closing connection with Firebase RTDB: ${this.node.client.app?.options.databaseURL}`);

		this.node.RED.events.removeListener("Firebase:log", this.onLog);

		return this.node.client.signOut();
	}

	/**
	 * A custom method in case of error allowing to send a predefined error message if this error is known
	 * otherwise returns the message as it is.
	 * @param error The error received
	 * @param done If defined this callback will return the error message
	 */
	public onError(error: Error | FirebaseError, done?: (error?: unknown) => void) {
		let msg = error.message || error.toString();

		if (isFirebaseError(error)) {
			msg = firebaseError[error.code.split(".")[0]];
			// Not working for firebase-admin... (hack working with log)
			if (error.code.match(/auth\/network-request-failed/)) {
				this.setNodesNoNetwork();
			} else if (error.code.startsWith("auth/")) {
				this.setNodesError(error.code.split("auth/").pop()?.split(".")[0].replace(/-/gm, " ").toPascalCase());
			} else {
				this.setNodesError();
			}
		} else {
			this.setNodesError();
		}

		msg = msg || error.message || error.toString();

		if (done) return done(msg);

		this.node.error(msg);
	}

	/**
	 * Property called by the `Firebase:log` event. Gets the log in order to make it an error and to update the status of
	 * the nodes.
	 * @param log The log received
	 */
	private onLog = (log: LogCallbackParams) => {
		if (log.message.includes("URL of your Firebase Realtime Database instance configured correctly")) {
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

	/**
	 * Restores the connection with Firebase if at least one node is activated.
	 * @remarks This method should only be used if the connection has been destroyed.
	 */
	private restoreDestroyedConnection() {
		const { rtdb } = this.node.registeredNodes;
		if (rtdb.length > 1) return;

		// If a node is started, stop the timeout
		clearTimeout(this.destructionTimeouID);
		this.destructionTimeouID = undefined;

		// Skip if Node-RED re-starts
		if (this.node.rtdb?.offline !== true) return;

		rtdb.length && this.node.rtdb?.goOnline();
	}

	/**
	 * Sets for each node defined in the array the status as "Connected".
	 * @param nodeIdArray An array containing node ids
	 */
	public setNodesConnected(nodeIdArray: string[]) {
		for (const nodeId of nodeIdArray) {
			this.node.RED.nodes.getNode(nodeId).status({ fill: "green", shape: "dot", text: "Connected" });
		}
	}

	/**
	 * Sets for each node defined in the array the status as `Connecting`.
	 * @param nodeIdArray An array containing node ids
	 */
	public setNodesConnecting(nodeIdArray: string[]) {
		for (const nodeId of nodeIdArray) {
			this.node.RED.nodes.getNode(nodeId).status({ fill: "yellow", shape: "ring", text: "Connecting" });
		}
	}

	/**
	 * Sets for each node defined in the array the status as `Disconnected`.
	 * @param nodeIdArray An array containing node ids
	 */
	public setNodesDisconnected(nodeIdArray: string[]) {
		if (this.node.client?.signState === SignState.ERROR) return;

		for (const nodeId of nodeIdArray) {
			this.node.RED.nodes.getNode(nodeId).status({ fill: "red", shape: "dot", text: "Disconnected" });
		}
	}

	/**
	 * Sets the status of nodes linked to this client as `Error`. An error code can also be set.
	 * @param code The error code to add to the status
	 */
	public setNodesError(code?: string) {
		for (const nodesArray of Object.values(this.node.registeredNodes) as Array<Array<string>>) {
			nodesArray.forEach((id) => this.node.RED.nodes.getNode(id).status({ fill: "red", shape: "dot", text: `Error${code ? ": ".concat(code) : ""}` }));
		}
	}

	/**
	 * Sets the status of nodes linked to this client as `No Network`.
	 */
	public setNodesNoNetwork() {
		for (const nodesArray of Object.values(this.node.registeredNodes) as Array<Array<string>>) {
			nodesArray.forEach((id) => this.node.RED.nodes.getNode(id).status({ fill: "red", shape: "ring", text: "No Network" }));
		}
	}

	/**
	 * Sets for each node defined in the array the status as `Reconnecting`.
	 * @param nodeIdArray An array containing node ids
	 */
	public setNodesReconnecting(nodeIdArray: string[]) {
		for (const nodeId of nodeIdArray) {
			this.node.RED.nodes.getNode(nodeId).status({ fill: "yellow", shape: "ring", text: "Reconnecting" });
		}
	}
}

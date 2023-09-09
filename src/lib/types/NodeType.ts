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

import { Node, NodeAPI } from "node-red";
import { ConfigType } from "./ConfigType";
import { Client, RTDB } from "@gogovega/firebase-nodejs";

export interface JSONContentType extends Partial<ServiceAccount> {
	client_email?: string;
	private_key?: string;
	project_id?: string;
}

export interface ServiceAccount {
	clientEmail: string;
	privateKey: string;
	projectId: string;
}

type Credentials = {
	apiKey: string;
	clientEmail: string;
	email: string;

	/**
	 * @deprecated Replaced by `clientEmail` and `privateKey`.
	 * Comes from version > v0.0.2 of `@gogovega/node-red-contrib-firebase-realtime-database`
	 */
	json: string;
	password: string;
	privateKey: string;
	projectId: string;
	storageBucket: string;
	uid: string;
	url: string;
};

interface RegisteredNodes {
	firestore: Array<string>;
	rtdb: Array<string>;
	storage: Array<string>;
}

export type NodeType = Node & {
	client?: Client;
	clientSignedIn(): Promise<boolean>;
	config: ConfigType;
	credentials: Credentials;

	/**
	 * Creates and initializes a callback to verify that the config node is in use.
	 * Otherwise the connection with Firebase will be closed.
	 * @note Use of a timer is essential because it's necessary to allow time for all nodes to start before checking
	 * the number of nodes connected to this database.
	 * @param removed A flag that indicates whether the node is being closed because it has been removed entirely,
	 * or that it is just being restarted.
	 * If `true`, execute the callback after 15s otherwise skip it.
	 */
	destroyUnusedConnection(removed: boolean): void;
	getFirestore(): void;
	getRTDB(): void;
	getStorage(): void;
	RED: NodeAPI;
	registeredNodes: RegisteredNodes;
	rtdb?: RTDB;

	/**
	 * Restores the connection with Firebase if at least one node is activated.
	 * @remarks This method should only be used if the connection has been destroyed.
	 */
	restoreDestroyedConnection(): void;
};

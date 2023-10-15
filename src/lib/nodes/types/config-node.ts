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

import { Node } from "node-red";
import { Config } from "./config";
import { Client, Firestore, RTDB, ServiceAccount } from "../../firebase";

export interface JSONContentType extends Partial<ServiceAccount> {
	client_email?: string;
	private_key?: string;
	project_id?: string;
}

/**
 * The different types of services supported by this node
 */
export type ServiceType = "firestore" | "rtdb" | "storage";

export type ConnectionStatus =
	| "connected"
	| "connecting"
	| "disconnect"
	| "disconnected"
	| "error"
	| "no-network"
	| "re-connecting";
export type StatusListeners = Record<ServiceType, Array<string>>;

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

export type ConfigNode = Node & {
	/**
	 * Add this node to the Global Configuration Node
	 * @param id The node ID
	 * @param type The Service Type
	 */
	addStatusListener(id: string, type: ServiceType): void;
	client?: Client;
	clientSignedIn(): Promise<boolean>;
	config: Config;
	credentials: Credentials;
	firestore?: Firestore;
	removeStatusListener(id: string, type: ServiceType, removed: boolean, done: () => void): void;
	/**
	 * Class representing a Firebase Realtime Database.
	 * Must be instantiated by calling {@link ConfigNode.addStatusListener | addStatusListener}
	 */
	rtdb?: RTDB;
	setCurrentStatus(id: string): void;
	readonly version: string;
};

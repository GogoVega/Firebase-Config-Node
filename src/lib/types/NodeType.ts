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
import { ConfigType } from "./ConfigType";
import { Client, Firestore, RTDB } from "@gogovega/firebase-nodejs";

export { BothDataSnapshot, Unsubscription } from "@gogovega/firebase-nodejs";

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

export interface StatusListeners {
	firestore: Array<string>;
	rtdb: Array<string>;
	storage: Array<string>;
}

export type ServiceType = keyof StatusListeners;

export type Status = "connected" | "connecting" | "disconnected" | "error" | "no-network" | "re-connecting";

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

export type NodeType = Node & {
	addStatusListener(id: string, type: ServiceType): void;
	client?: Client;
	clientSignedIn(): Promise<boolean>;
	config: ConfigType;
	credentials: Credentials;
	firestore?: Firestore;
	removeStatusListener(id: string, type: ServiceType, removed: boolean, done: () => void): void;
	rtdb?: RTDB;
	setCurrentStatus(id: string): void;
};

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
import { getDatabaseSettings, updateDatabaseSettings } from "../lib/nodes/rtdb-settings";
import { FirebaseClient } from "../lib/nodes/firebase-client";
import { Config, ConfigNode } from "../lib/nodes/types";

const VERSION = "0.2.3";

export default async function (RED: NodeAPI) {
	/**
	 * Firebase Configuration Node
	 *
	 * This Global Configuration Node is used by all other Firebase Nodes to access the Firebase RTDB,
	 * Firestore and Cloud Storage.
	 *
	 * It keeps track of incoming status messages and updates listening nodes' status in the UI accordingly.
	 *
	 * @param this The Firebase Config Node
	 * @param config Configuration associated with this Config Node
	 */
	function FirebaseConfigNode(this: ConfigNode, config: Config) {
		RED.nodes.createNode(this, config);

		const client = new FirebaseClient(this, config, RED);

		client.logIn();

		this.on("close", (done: () => void) => client.logOut(done));

		Object.defineProperty(this, "version", {
			value: VERSION,
			writable: false,
			enumerable: true,
			configurable: false,
		});
	}

	RED.nodes.registerType("firebase-config", FirebaseConfigNode, {
		credentials: {
			apiKey: { type: "text" },
			clientEmail: { type: "password" },
			email: { type: "text" },
			json: { type: "password" },
			password: { type: "password" },
			privateKey: { type: "password" },
			projectId: { type: "text" },
			storageBucket: { type: "text" },
			uid: { type: "text" },
			url: { type: "text" },
		},
	});

	RED.httpAdmin.get(
		"/firebase/config-node/rtdb/settings/:id",
		RED.auth.needsPermission("firebase-config.write"),
		(req, res) => getDatabaseSettings(RED, req, res)
	);

	RED.httpAdmin.post(
		"/firebase/config-node/rtdb/settings/:id",
		RED.auth.needsPermission("firebase-config.write"),
		(req, res) => updateDatabaseSettings(RED, req, res)
	);
}

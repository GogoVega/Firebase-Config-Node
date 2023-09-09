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
import { FirebaseConfig } from "../lib/firebaseNode";
import { ConfigType, NodeType } from "../lib/types";

export default function (RED: NodeAPI) {
	function FirebaseConfigNode(this: NodeType, config: ConfigType) {
		RED.nodes.createNode(this, config);
		const self = this;

		const firebase = new FirebaseConfig(self, config, RED);

		firebase.logIn();

		self.on("close", (done: (error?: Error) => void) =>
			firebase
				.logOut()
				.then(() => done())
				.catch((error: Error) => done(error))
		);
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
};

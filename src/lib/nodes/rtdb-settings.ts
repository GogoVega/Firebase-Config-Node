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

import { Request, Response } from "express";
import { ConfigNode } from "./types";
import { NodeAPI } from "node-red";
import { isFirebaseConfigNode } from "../firebase/utils";

async function getDatabaseSettings(RED: NodeAPI, got: typeof import("got").got, req: Request, res: Response) {
	try {
		const id = req.params.id;

		if (!id) {
			res.status(400).send("The config-node ID is missing!");
			return;
		}

		const node = RED.nodes.getNode(id) as ConfigNode | null;
		if (!node || !isFirebaseConfigNode(node) || !node.client) {
			res.json({});
			return;
		}

		const databaseURL = node.credentials.url;
		const token = await node.client.getAccessToken();

		const path = encodeURI(req.body.path || "defaultWriteSizeLimit");
		const url = `${databaseURL}.settings/${path}.json`;

		const response = await got.get(url, {
			headers: { Authorization: `Bearer ${token?.access_token}` },
			responseType: "json",
		});

		res.json({ defaultWriteSizeLimit: response.body });
	} catch (error) {
		res.status(500).send({ message: String(error) });
		RED.log.error("An error occured while getting RTDB settings: ");
		RED.log.error(error);
	}
}

async function updateDatabaseSettings(RED: NodeAPI, got: typeof import("got").got, req: Request, res: Response) {
	try {
		const id = req.params.id;

		if (!id) {
			res.status(400).send("The config-node ID is missing!");
			return;
		}

		const node = RED.nodes.getNode(id) as ConfigNode | null;
		if (!node || !isFirebaseConfigNode(node) || !node.client) {
			res.status(400).send("Config Node disabled or not yet deployed");
			return;
		}

		const databaseURL = node.credentials.url;
		const token = await node.client.getAccessToken();

		const path = encodeURI(req.body.path || "defaultWriteSizeLimit");
		const url = `${databaseURL}.settings/${path}.json`;
		const writeSizeLimit = req.body.writeSizeLimit;

		const response = await got.post(url, {
			headers: { Authorization: `Bearer ${token?.access_token}` },
			body: JSON.stringify(writeSizeLimit),
			responseType: "json",
		});

		res.status(200);
		console.log(response.body);
	} catch (error) {
		res.status(500).send({ message: String(error) });
		RED.log.error("An error occured while setting RTDB settings: ");
		RED.log.error(error);
	}
}

export { getDatabaseSettings, updateDatabaseSettings };

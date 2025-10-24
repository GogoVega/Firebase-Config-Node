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

import axios from "axios";
import { Request, Response } from "express";
import { ConfigNode } from "./types";
import { NodeAPI } from "node-red";
import { isFirebaseConfigNode } from "../firebase/utils";

async function getDatabaseSettings(RED: NodeAPI, req: Request, res: Response) {
	try {
		const id = req.params.id;

		RED.log.debug(`[firebase-config:${id}] Get 'defaultWriteSizeLimit' setting`);

		if (!id) {
			res.status(400).send("The config-node ID is missing!");
			return;
		}

		const node = RED.nodes.getNode(id) as ConfigNode | null;
		if (!node || !isFirebaseConfigNode(node)) {
			// Disabled or not yet deployed
			res.json({});
			return;
		}

		const databaseURL = node.credentials.url;
		if (!node.client?.admin || !databaseURL) {
			res.json({});
			return;
		}

		const token = await node.client.getAccessToken();
		const url = `${databaseURL}.settings/defaultWriteSizeLimit.json`;

		const response = await axios.get(url, {
			headers: { Authorization: `Bearer ${token?.access_token}` },
			responseType: "json",
		});

		res.json({ defaultWriteSizeLimit: response.data });
	} catch (error) {
		res.status(500).send({ message: String(error) });
		RED.log.error("An error occured while getting RTDB settings: ");
		RED.log.error(error);
	}
}

async function updateDatabaseSettings(RED: NodeAPI, req: Request, res: Response) {
	try {
		const id = req.params.id;
		const writeSizeLimit = req.body.writeSizeLimit;

		RED.log.debug(`[firebase-config:${id}] Set 'defaultWriteSizeLimit' setting to ${writeSizeLimit}`);

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
		const url = `${databaseURL}.settings/defaultWriteSizeLimit.json`;
		const token = await node.client.getAccessToken();

		await axios.put(url, JSON.stringify(writeSizeLimit), {
			headers: { Authorization: `Bearer ${token?.access_token}` },
			responseType: "json",
		});

		res.sendStatus(204);
	} catch (error) {
		res.status(500).send({ message: String(error) });
		RED.log.error("An error occured while setting RTDB settings: ");
		RED.log.error(error);
	}
}

export { getDatabaseSettings, updateDatabaseSettings };

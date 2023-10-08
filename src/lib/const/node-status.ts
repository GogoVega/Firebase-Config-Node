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

import { NodeStatus } from "node-red";
import { Status } from "../types";

export const nodeStatus: Record<Exclude<Status, "error">, NodeStatus> = {
	connected: { fill: "green", shape: "dot", text: "Connected" },
	connecting: { fill: "yellow", shape: "ring", text: "Connecting" },
	disconnected: { fill: "red", shape: "dot", text: "Disconnected" },
	"no-network": { fill: "red", shape: "ring", text: "No Network" },
	"re-connecting": { fill: "yellow", shape: "ring", text: "Reconnecting" },
};

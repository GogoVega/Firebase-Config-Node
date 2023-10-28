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

declare global {
	interface String {
		toPascalCase(): string;
	}
}

String.prototype.toPascalCase = function () {
	const words = this.match(/[a-z]+/gi);

	if (!words) return "";

	return words.map((word) => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase()).join(" ");
};

export {};

/*
import { join } from "node:path";
function configNodeAlreadyLoaded(): boolean {
	const serverDir = require.main?.path;

	if (!serverDir) return false;

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const registry = require(join(serverDir, "node_modules/@node-red/registry/lib/index.js"));

	if (!registry) return false;

	const modules: Record<string, object> = registry.getModuleList();

	const result = modules["@gogovega/node-red-contrib-firebase-realtime-database"];
	result && console.log("\nThe 'firebase-config' node is already loaded, you can ignore the below warning message:\n");

	return result ? true : false;
}

export { configNodeAlreadyLoaded };
*/

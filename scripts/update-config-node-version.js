#!/usr/bin/env node

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

const { join } = require("node:path");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");

const filePath = "src/nodes/firebase-config.ts";

const versionRegex = /VERSION = "([0-9]\.[0-9]+\.[0-9]+(?:-(alpha|beta)\.[0-9]+)?)"/;

try {
	console.log("Check if the Config Node version is up to date...");

	const packageFile = require("../package.json");
	const destinationFilePath = join(__dirname, "../", filePath);

	if (existsSync(destinationFilePath)) {
		const destinationFile = readFileSync(destinationFilePath, { encoding: "utf8" });

		const currentVersionRow = versionRegex.exec(destinationFile);

		if (currentVersionRow) {
			const packageVersion = packageFile.version;
			const currentVersion = currentVersionRow[1];

			console.log(`Current version: "${currentVersion}"\nPackage Version: "${packageVersion}"`);

			if (currentVersion !== packageVersion) {
				const contentToWrite = destinationFile.replace(versionRegex, `VERSION = "${packageVersion}"`);
				console.log("Writing...");
				writeFileSync(destinationFilePath, contentToWrite, { encoding: "utf8" });
				console.log("Write done");
			} else {
				console.log("The version is up to date");
			}
		}
	}

	console.log("Done.");
} catch (error) {
	console.error("An error occurred while updating:", error);
}

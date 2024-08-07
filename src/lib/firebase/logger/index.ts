/**
 * @license
 * Copyright 2023 Gauthier Dandele
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export { onLog } from "@firebase/app";
export { LogCallbackParams } from "@firebase/logger/dist/src/logger";

type Level = "info" | "warn";

interface Log {
	level: Level;
	message: string;
}

export type LogCallback = (log: Log) => void;
export type LogFn = (message: string) => void;

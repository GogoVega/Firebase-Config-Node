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

import { NodeDef } from "node-red";

type AuthType = "anonymous" | "email" | "privateKey" | "customToken";

type ClaimsType = Record<string, { value?: unknown; type?: unknown } | never>;

export type ConfigType = NodeDef & {
	authType?: AuthType;
	claims?: ClaimsType;
	createUser?: boolean;
	useClaims?: boolean;
};

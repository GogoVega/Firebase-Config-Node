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

import { DataSnapshot as AdminDataSnapshot } from "firebase-admin/database";
import { DataSnapshot as BaseDataSnapshot } from "firebase/database";
import { DataSnapshotType } from "./types";

class DataSnapshot implements DataSnapshotType {
	private data: AdminDataSnapshot | BaseDataSnapshot;

	public static from(data: AdminDataSnapshot | BaseDataSnapshot) {
		return new DataSnapshot(data);
	}

	private constructor(data: AdminDataSnapshot | BaseDataSnapshot) {
		this.data = data;
	}

	public get priority(): string | number | null {
		if (Object.prototype.hasOwnProperty.call(this.data, "getPriority"))
			return (this.data as AdminDataSnapshot).getPriority();
		return (this.data as BaseDataSnapshot).priority;
	}

	public get key(): string | null {
		return this.data.key;
	}

	public exists(): boolean {
		return this.data.exists();
	}

	public hasChild(path: string): boolean {
		return this.data.hasChild(path);
	}

	public hasChildren(): boolean {
		return this.data.hasChildren();
	}

	public toJSON(): object | null {
		return this.data.toJSON();
	}

	public val(): unknown {
		return this.data.val();
	}
}

export { DataSnapshot };

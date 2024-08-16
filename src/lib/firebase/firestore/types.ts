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

import { DocumentChangeType, DocumentData, OrderByDirection, WhereFilterOp } from "firebase-admin/firestore";

export type DocumentId = string;

export interface DocumentChange {
	id: DocumentId;
	doc: DocumentData;
	newIndex: number;
	oldIndex: number;
	type: DocumentChangeType;
}

export interface CollectionData {
	changes: Array<DocumentChange>;
	docs: Record<DocumentId, DocumentData>;
	size: number;
}

export type DataSnapshot = CollectionData | DocumentData | null;

export type SubscribeCallback = (snapshot: DataSnapshot) => void;
export type ErrorCallback = (error: Error) => void;
export type Unsubscribe = () => void;

export interface Constraint {
	endAt?: unknown;
	endBefore?: unknown;
	limitToFirst?: number;
	limitToLast?: number;
	orderBy?: Array<{ fieldPath: string; direction?: OrderByDirection }>;
	offset?: number;
	select?: string | Array<string>;
	startAfter?: unknown;
	startAt?: unknown;
	where?: Array<{ fieldPath: string; filter: WhereFilterOp; value: unknown }>;
}

export interface QueryConfig {
	collection?: string;
	collectionGroup?: string;
	constraints?: Constraint;
	document?: string;
}

export type QueryMethod = "delete" | "set" | "update";

interface SetMergeOption {
	merge?: boolean;
}

interface SetMergeFieldsOption {
	mergeFields?: Array<string>;
}

export type SetOptions = SetMergeOption | SetMergeFieldsOption;

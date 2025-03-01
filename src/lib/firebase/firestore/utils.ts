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

import {
	CollectionGroup as AdminCollectionGroup,
	CollectionReference as AdminCollectionReference,
	DocumentData,
	type DocumentReference as AdminDocumentReference,
	DocumentSnapshot as AdminDocumentSnapshot,
	type Firestore as AdminFirestore,
	type Query as AdminQuery,
	type QuerySnapshot as AdminQuerySnapshot,
	FieldValue,
	GeoPoint as AdminGeoPoint,
} from "firebase-admin/firestore";
import {
	arrayRemove,
	arrayUnion,
	collection,
	collectionGroup,
	CollectionReference,
	deleteField,
	doc,
	type DocumentReference,
	DocumentSnapshot,
	endAt,
	endBefore,
	type Firestore,
	GeoPoint,
	increment,
	limit,
	limitToLast,
	orderBy,
	type Query,
	query,
	type QueryConstraint,
	type QuerySnapshot,
	serverTimestamp,
	startAfter,
	startAt,
	where,
} from "@firebase/firestore";
import { CollectionData, Constraint, DataSnapshot, DocumentChange, DocumentId, QueryConfig } from "./types";
import { Entry } from "../utils";

// TODO: type guards
function applyQueryConstraints(constraints: Constraint | undefined, query: AdminQuery): AdminQuery;
function applyQueryConstraints(constraints: Constraint | undefined): Array<QueryConstraint>;
function applyQueryConstraints(constraints: Constraint = {}, query?: AdminQuery): AdminQuery | Array<QueryConstraint> {
	if (typeof constraints !== "object") throw new TypeError("Query Constraints must be an Object!");

	const queryConstraints: Array<QueryConstraint> = [];
	const constraintObject = Object.entries(constraints) as Entry<Constraint>[];
	for (const [method, value] of constraintObject) {
		switch (method) {
			case "endAt":
			case "endBefore":
			case "startAfter":
			case "startAt": {
				const firestore = { endAt, endBefore, startAfter, startAt };

				if (query) {
					query = query[method](value);
				} else {
					queryConstraints.push(firestore[method](value));
				}
				break;
			}
			case "limitToFirst":
				if (typeof value !== "number") throw new TypeError(`The value of the "${method}" constraint must be a number!`);

				if (query) {
					query = query.limit(value);
				} else {
					queryConstraints.push(limit(value));
				}
				break;
			case "limitToLast":
				if (typeof value !== "number") throw new TypeError(`The value of the "${method}" constraint must be a number!`);

				if (query) {
					query = query.limitToLast(value);
				} else {
					queryConstraints.push(limitToLast(value));
				}
				break;
			case "offset":
				if (typeof value !== "number") throw new TypeError(`The value of the "${method}" constraint must be a number!`);

				if (query) {
					query = query.offset(value);
				} else {
					throw new Error("Offset Query Constraint not available for this SDK.");
				}
				break;
			case "orderBy": {
				if (typeof value !== "object") throw new TypeError(`The value of the "${method}" constraint must be an array!`);

				let valArray = value;
				if (!Array.isArray(value)) {
					valArray = [value];
				}

				valArray.forEach((val) => {
					if (typeof val.fieldPath !== "string")
						throw new TypeError(`The fieldPath value of the "${method}" constraint must be a string!`);

					if (query) {
						query = query.orderBy(val.fieldPath, val.direction);
					} else {
						queryConstraints.push(orderBy(val.fieldPath, val.direction));
					}
				});

				break;
			}
			case "select":
				if (typeof value === "string" || (typeof value === "object" && value && Array.isArray(value))) {
					if (query) {
						query = query.select(...value);
					} else {
						throw new Error("Select Query Constraint not available for this SDK.");
					}
				} else {
					throw new TypeError(`The value of the "${method}" constraint must be a string or a string array!`);
				}
				break;
			case "where": {
				if (typeof value !== "object") throw new TypeError(`The value of the "${method}" constraint must be an array!`);

				let valArray = value;
				if (!Array.isArray(value)) {
					valArray = [value];
				}

				valArray.forEach((val) => {
					if (typeof val.fieldPath !== "string")
						throw new TypeError(`The fieldPath value of the "${method}" constraint must be a string!`);

					if (query) {
						query = query.where(val.fieldPath, val.filter, val.value);
					} else {
						queryConstraints.push(where(val.fieldPath, val.filter, val.value));
					}
				});

				break;
			}
			default:
				continue;
		}
	}

	return query || queryConstraints;
}

function isAdminFirestore(firestore: AdminFirestore | Firestore): firestore is AdminFirestore {
	return "settings" in firestore && "databaseId" in firestore;
}

function documentFrom<T extends AdminDocumentReference | AdminCollectionReference = AdminDocumentReference>(
	firestore: AdminFirestore,
	config: QueryConfig
): T;
function documentFrom<T extends DocumentReference | CollectionReference = DocumentReference>(
	firestore: Firestore,
	config: QueryConfig
): T;
function documentFrom(
	firestore: AdminFirestore | Firestore,
	config: QueryConfig
): AdminCollectionReference | AdminDocumentReference | CollectionReference | DocumentReference {
	let reference;

	if (config.collection) {
		if (typeof config.collection !== "string") throw new TypeError("CollectionPath must be a String.");

		if (isAdminFirestore(firestore)) {
			reference = firestore.collection(config.collection);
		} else {
			reference = collection(firestore, config.collection);
		}
	}

	if (config.document) {
		if (typeof config.document !== "string") throw new TypeError("DocumentPath must be a String.");

		if (isAdminFirestore(firestore)) {
			return reference instanceof AdminCollectionReference
				? reference.doc(config.document)
				: firestore.doc(config.document);
		}
		return reference instanceof CollectionReference ? doc(reference, config.document) : doc(firestore, config.document);
	}

	if (!reference) throw new Error("Path missing to Collection/Document reference.");

	return reference;
}

function queryFrom(firestore: AdminFirestore, config: QueryConfig): AdminDocumentReference | AdminQuery;
function queryFrom(firestore: Firestore, config: QueryConfig): DocumentReference | Query;
function queryFrom(
	firestore: AdminFirestore | Firestore,
	config: QueryConfig
): AdminDocumentReference | AdminQuery | DocumentReference | Query {
	let reference;

	if (config.collectionGroup) {
		if (typeof config.collectionGroup !== "string") throw new TypeError("CollectionGroupPath must be a String.");
		if (config.document) throw new Error("DocumentPath must be empty with CollectionGroup.");

		if (isAdminFirestore(firestore)) {
			reference = firestore.collectionGroup(config.collectionGroup);
		} else {
			reference = collectionGroup(firestore, config.collectionGroup);
		}
	} else if (config.collection) {
		if (typeof config.collection !== "string") throw new TypeError("CollectionPath must be a String.");

		if (isAdminFirestore(firestore)) {
			reference = firestore.collection(config.collection);
		} else {
			reference = collection(firestore, config.collection);
		}
	}

	if (config.document) {
		if (typeof config.document !== "string") throw new TypeError("DocumentPath must be a String.");

		if (isAdminFirestore(firestore)) {
			return reference instanceof AdminCollectionReference
				? reference.doc(config.document)
				: firestore.doc(config.document);
		}
		return reference instanceof CollectionReference ? doc(reference, config.document) : doc(firestore, config.document);
	}

	if (!reference) throw new Error("No Path Given - Collection(Group)Path or/and DocumentPath missing");

	if (reference instanceof AdminCollectionReference || reference instanceof AdminCollectionGroup) {
		return applyQueryConstraints(config.constraints, reference);
	}

	return query(reference, ...applyQueryConstraints(config.constraints));
}

class Snapshot {
	public static from(
		data: AdminDocumentSnapshot | AdminQuerySnapshot | DocumentSnapshot | QuerySnapshot
	): DataSnapshot {
		if (data instanceof DocumentSnapshot || data instanceof AdminDocumentSnapshot) {
			return data.data() || null;
		}

		return new Snapshot(data).toJSON();
	}

	private constructor(private query: AdminQuerySnapshot | QuerySnapshot) {}

	public get changes(): Array<DocumentChange> {
		return this.query.docChanges().map((change) => ({
			id: change.doc.id,
			doc: change.doc.data(),
			newIndex: change.newIndex,
			oldIndex: change.oldIndex,
			type: change.type,
		}));
	}

	/** An array of all the documents in the QuerySnapshot. */
	public get docs(): Record<DocumentId, DocumentData> {
		return this.query.docs.reduce<Record<string, DocumentData>>((acc, doc) => {
			acc[doc.id] = doc.data();
			return acc;
		}, {});
	}

	/** The number of documents in the QuerySnapshot. */
	public get size(): number {
		return this.query.size;
	}

	public toJSON(): CollectionData {
		return { docs: this.docs, size: this.size, changes: this.changes };
	}
}

class SpecialFieldValue {
	private admin: boolean = false;

	public constructor(isAdminFirestore: boolean) {
		this.admin = isAdminFirestore;
	}

	public arrayUnion(...elements: unknown[]) {
		if (this.admin) return FieldValue.arrayUnion(...elements);
		return arrayUnion(...elements);
	}

	public arrayRemove(...elements: unknown[]) {
		if (this.admin) return FieldValue.arrayRemove(...elements);
		return arrayRemove(...elements);
	}

	public delete() {
		if (this.admin) return FieldValue.delete();
		return deleteField();
	}

	public geoPoint(latitude: number, longitude: number) {
		if (typeof latitude !== "number" || typeof longitude !== "number")
			throw new TypeError("Latitude and Longitude of Geo Point must be a number");
		if (this.admin) return new AdminGeoPoint(latitude, longitude);
		return new GeoPoint(latitude, longitude);
	}

	public increment(delta: number) {
		if (this.admin) return FieldValue.increment(delta);
		return increment(delta);
	}

	public serverTimestamp() {
		if (this.admin) return FieldValue.serverTimestamp();
		return serverTimestamp();
	}
}

export { applyQueryConstraints, documentFrom, queryFrom, Snapshot, SpecialFieldValue };

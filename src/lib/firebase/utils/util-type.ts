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

type TupleEntry<T extends readonly unknown[], I extends unknown[] = [], R = never> = T extends readonly [
	infer Head,
	...infer Tail,
]
	? TupleEntry<Tail, [...I, unknown], R | [`${I["length"]}`, Head]>
	: R;

type ObjectEntry<T extends object> = T extends object
	? { [K in keyof T]: [K, Required<T>[K]] }[keyof T] extends infer E
		? E extends [infer K, infer V]
			? K extends string | number
				? [`${K}`, V]
				: never
			: never
		: never
	: never;

/**
 * These type definitions comes from the
 * {@link https://dev.to/harry0000/a-bit-convenient-typescript-type-definitions-for-objectentries-d6g | DEV Community}.
 */
export type Entry<T extends object> = T extends readonly [unknown, ...unknown[]]
	? TupleEntry<T>
	: T extends ReadonlyArray<infer U>
		? [`${number}`, U]
		: ObjectEntry<T>;

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

const FirebaseConfigClaimsContainer = (function () {
	"use strict";

	const validators = {
		claims: function () {
			return function (claims, opt) {
				// Ensure label is setted
				// Workaround to pass label to typedInput validation
				opt ||= {};
				opt.label ||= i18n("label.claims");

				if (typeof claims !== "object") return false;

				// TODO: validate Claims
				//for (const [k, v] of Object.entries(claims)) { }

				return true;
			}
		},
		claimsKey: function () {
			return function (value, opt) {
				if (
					typeof value === "string" &&
					/^(acr|amr|at_hash|aud|auth_time|azp|cnf|c_hash|exp|iat|iss|jti|nbf|nonce|sub|firebase|user_id)$/.test(value)
				) return false;

				if (typeof value === "string" && /^\s|\s$|^$/.test(value)) return false;

				return true;
			};
		},
	};

	class EditableClaimsList {
		constructor() {
			this.containerId = "#node-config-input-claims-container";
			this.containerClass = ".node-config-input-claims-container-row";
			this.useClaimsId = "#node-config-input-useClaims";
			this.node = {};
		}

		#buildContainer() {
			this.container?.css({ "min-height": "150px", "min-width": "300px" }).editableList({
				addButton: i18n("addClaim"),
				addItem: addItem,
				removable: true,
				sortable: true,
			});

			this.useClaims?.on("change", () => this.#claimsHandler());
		}

		#claimsHandler() {
			if (this.useClaims?.prop("checked") === true) {
				const claims = Object.entries(this.node.claims || {});

				if (claims.length === 0) claims.push(
					["admin", { value: false, type: "bool" }],
					["debug", { value: false, type: "bool" }],
				);

				claims.forEach((item) => this.container?.editableList("addItem", item));
				this.containerRow?.show();
			} else {
				this.containerRow?.hide();
				this.container?.editableList("empty");
			}

			RED.tray.resize();
		}

		build(node) {
			this.container = $(this.containerId);
			this.containerRow = $(this.containerClass);
			this.useClaims = $(this.useClaimsId);
			this.node = node;
			this.#buildContainer();
		}

		reSize(size) {
			let height = size.height;
			const rows = $(`#dialog-form>div:not(${this.containerClass})`);
			const editorRow = $(`#dialog-form>div${this.containerClass}`);

			for (let i = 0; i < rows.length; i++) {
				height -= $(rows[i]).outerHeight(true) || 0;
			}

			height -= (parseInt(editorRow.css("marginTop")) + parseInt(editorRow.css("marginBottom")));
			height += 16;
			this.container?.editableList("height", height);
		}

		saveItems() {
			const container = this.container?.editableList("items").sort(compareItemsList);
			const node = this.node;

			node.claims = {};

			container?.each(function () {
				const key = $(this).find("#node-config-input-claims-key").typedInput("value");
				const value = $(this).find("#node-config-input-claims-value").typedInput("value");
				const type = $(this).find("#node-config-input-claims-value").typedInput("type");

				if (type === "num" && Number.isNaN(Number(value || NaN))) RED.notify("Additional Claims: Setted value is not a number!", "error");
				if (type === "json") {
					try {
						JSON.parse(value);
					} catch (_error) {
						RED.notify("Additional Claims: Setted value is invalid JSON!", "error");
					}
				}

				node.claims[key] = { value: value, type: type };
			});
		}
	}

	function addItem(container, index, data) {
		const inputRows = $("<div></div>", { style: "flex-grow: 1" }).appendTo(container);
		const row = $("<div/>", { style: "width: 35%; vertical-align: top; display: inline-block;" }).appendTo(inputRows);
		const row2 = $("<div/>", { style: "width: calc(64% - 5px); margin-left: 5px; vertical-align: top; display: inline-block;" }).appendTo(inputRows);
		const keyField = $("<input/>", { type: "text", id: "node-config-input-claims-key", style: "width: 100%; text-align: center;", placeholder: i18n("placeholder.key") }).appendTo(row);
		const valueField = $("<input/>", { type: "text", id: "node-config-input-claims-value", style: "width: 100%;", placeholder: i18n("placeholder.value") }).appendTo(row2);

		container.css({
			overflow: "hidden",
			whiteSpace: "nowrap",
			display: "flex",
			"align-items": "center",
		});

		keyField.typedInput({
			default: "str",
			types: [{ value: "str", label: "string", icon: "red/images/typedInput/az.svg", validate: validators.claimsKey() }],
		});

		valueField.typedInput({
			default: "str",
			typeField: "#node-config-input-claims-valueType",
			types: ["str", "num", "bool", "date", "json"],
		});

		if (Array.isArray(data)) {
			const [key, object] = data;

			const value = typeof object.value === "object" ? JSON.stringify(object.value) : object.value?.toString();

			keyField.typedInput("value", key);
			valueField.typedInput("value", value ?? "");
			valueField.typedInput("type", object.type ?? "str");

			data = {};
			$(container).data("data", data);
		}

		data.index = index;
	}

	function compareItemsList(a, b) {
		return a.index - b.index;
	}

	function i18n(key) {
		return RED._(`@gogovega/firebase-config-node/firebase-config:firebase-config.${key}`);
	}

	return {
		editableClaimsList: { create: () => new EditableClaimsList() },
		validateClaims: validators.claims,
	};
})();

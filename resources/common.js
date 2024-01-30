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

const FirebaseConfigUI = (function () {
  "use strict";

  // TODO: Check all patterns
  const validators = {
    apiKey: function () {
      return function (value, opt) {
        if (/^AIza[a-zA-Z0-9-_\\]{35}$/.test(value)) return true;
        return opt ? i18n("validators.invalid-apiKey") : false;
      };
    },
    clientEmail: function () {
      return function (value, opt) {
        if (/^__PWRD__$|^[a-zA-Z0-9-]+\@[a-zA-Z0-9-]{4,30}\.iam\.gserviceaccount\.com$/.test(value)) return true;
        return opt ? i18n("validators.invalid-clientEmail") : false;
      };
    },
    email: function () {
      return function (value, opt) {
        if (/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/i.test(value)) return true;
        return opt ? i18n("validators.invalid-email") : false;
      };
    },
    password: function () {
      return function (value, opt) {
        if (/^.{6,}$/.test(value)) return true;
        return opt ? i18n("validators.invalid-password") : false;
      };
    },
    privateKey: function () {
      return function (value, opt) {
        if (/^__PWRD__$|-----BEGIN PRIVATE KEY-----\S+-----END PRIVATE KEY-----/.test(value)) return true;
        return opt ? i18n("validators.invalid-privateKey") : false;
      };
    },
    projectId: function () {
      return function (value, opt) {
        if (/^$|^[a-zA-Z0-9-]{4,30}$/.test(value)) return true;
        return opt ? i18n("validators.invalid-projectId") : false;
      };
    },
    storageBucket: function () {
      return function (value, opt) {
        if (/^$|^[a-zA-Z0-9-]{4,30}\.appspot\.com$/.test(value)) return true;
        return opt ? i18n("validators.invalid-storageBucket") : false;
      };
    },
    uid: function () {
      return function (value, opt) {
        if (/^.{1,128}$/.test(value)) return true;
        return opt ? i18n("validators.invalid-uid") : false;
      };
    },
    url: function () {
      return function (value, opt) {
        if (/^$|^https:\/\/[a-zA-Z0-9-]{4,30}-default-rtdb\.((asia-southeast1|europe-west1)\.firebasedatabase\.app|firebaseio\.com)\/$/.test(value)) return true;
        return opt ? i18n("validators.invalid-url") : false;
      };
    },
  };

  function appendTooltipsToAllFields() {
    const inputs = ["apiKey", "clientEmail", "email", "password", "privateKey", "projectId", "storageBucket", "uid", "url", "json"];

    inputs.forEach((name) => generateToolTip(`#node-config-input-${name}`, i18n(`tooltips.${name}`)));
  }

  function generateToolTip(element, message) {
    const tip = $('<i class="fa fa-info-circle"></i>').css("cursor", "pointer");
    //RED.popover.tooltip(tip, message);

    RED.popover.create({
      target: tip,
      direction: "right",
      maxWidth: 300,
      trigger: "hover",
      content: message,
      tooltip: true,
      interactive: true,
    });

    $(element).parent().append(tip);
  }

  function i18n(key, tplStrs) {
		return RED._(`@gogovega/firebase-config-node/firebase-config:firebase-config.${key}`, tplStrs);
	}

  function i18nFullOptions(key, dict, group = "", tplStrs) {
		if (typeof group === "object" && !tplStrs) {
			tplStrs = group;
			group = "";
		}

		return RED._(`@gogovega/firebase-config-node/${dict}:${group || dict}.${key}`, tplStrs);
	}

  return {
    _: i18nFullOptions,
    appendTooltipsToAllFields: appendTooltipsToAllFields,
    validators: validators,
  };
})();

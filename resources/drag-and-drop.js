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

const FirebaseConfigDropArea = (function () {
  "use strict";

  class DropTarget {
    constructor() {
      this.#appendDropFrameToEditor();

      this.dropTarget = $("#file-drop-target");
      this.editor = $("#red-ui-editor-stack");
      this.privateKeyFile = $("#json-drop-target");

      this.dropTarget.hide();
      this.#initializeHandler();
    }

    #appendDropFrameToEditor() {
      $(
        `<div id="file-drop-target">
          <div>
            <i class="fa fa-download"></i>
            <br/>
            <br/>
            <span data-i18n="@gogovega/firebase-config-node/firebase-config:firebase-config.dropFileHere"></span>
          </div>
        </div>`
      ).appendTo("#red-ui-editor-stack > div > div.red-ui-tray-body-wrapper > div");
    }

    #initializeHandler() {
      this.editor.on("dragenter", (event) => this.#dragEnter(event));
      this.privateKeyFile.on("click", () => this.#filePrompt());
      this.dropTarget
        .on("dragover", dragOverHandler)
        .on("dragleave", (event) => this.#dragLeave(event))
        .on("drop", (event) => this.#dropHandler(event));
    }

    #dragEnter(event) {
      event.preventDefault();
      event.stopPropagation();
      this.dropTarget.css({ display: "table" }).trigger("focus");
    }

    #dragLeave(event) {
      event.preventDefault();
      event.stopPropagation();
      this.dropTarget.hide();
    }

    // Read drag data
    #dropHandler(event) {
      event.preventDefault();
      event.stopPropagation();

      this.dropTarget.hide();

      if (event.originalEvent.dataTransfer.items) {
        [...event.originalEvent.dataTransfer.items].forEach((item) => {
          if (item.kind === "file") {
            const file = item.getAsFile();
            this.#saveFile(file);
          } else if (item.kind === "string") {
            if (item.type !== "text/plain") return alert("The dropped item type should be text/plain");
            item.getAsString((content) => this.#parseAndUpdateInputs(content));
          } else {
            alert("The dropped item must be an file .txt or .json");
          }
        });
      }
    }

    // Prompt file
    #filePrompt() {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = (e) => this.#saveFile(e.target?.files[0]);
      input.click();
    }

    // Read Data
    #saveFile(file) {
      const name = file.name.toLowerCase();
      const reader = new FileReader();

      if (!/\.(txt|json)$/.test(name)) return alert("The file extension must be .txt or .json");

      reader.onload = (ev) => this.#parseAndUpdateInputs(ev.target?.result);
      reader.readAsText(file, "UTF-8");
    }

    #parseAndUpdateInputs(content) {
      try {
        const data = JSON.parse(content);

        $("#node-config-input-clientEmail")
          .data("data", data["clientEmail"] || data["client_email"])
          .val("__PWRD__");
        $("#node-config-input-privateKey")
          .data("data", (data["privateKey"] || data["private_key"] || "").trim())
          .val("__PWRD__");
        $("#node-config-input-projectId").val(data["projectId"] || data["project_id"])
          .trigger("change"); // No need to trigger everything
        this.privateKeyFile.html("The file has been loaded.");
      } catch (error) {
        this.privateKeyFile.html("An error has occurred :(");
        alert(error.message ?? String(error));
      }
    }
  }

  // Prevent default behavior (Prevent file from being opened)
  function dragOverHandler(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  return {
    dropTarget: { create: () => new DropTarget() },
  };
})();

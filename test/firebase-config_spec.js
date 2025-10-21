/**
 * Copyright 2023-2024 Gauthier Dandele
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

const database = require("../build");
const { Client } = require("../build/lib/firebase/client");
const { Firestore } = require("../build/lib/firebase/firestore");
const { RTDB } = require("../build/lib/firebase/rtdb");

const helper = require("node-red-node-test-helper");
const should = require('should');

const apiKey = process.env.API_KEY;
const url = process.env.RTDB_URL;
const projectId = process.env.PROJECT_ID;

const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "email", createUser: true }];

// TODO: Add more tests
describe("Firebase Config Node", function () {
  before(function (done) {
    helper.startServer(done);
  });

  after(function (done) {
    helper.stopServer(done);
  });

  afterEach(function (done) {
    helper.unload().then(done);
  });

  context("When the config-node is loaded", () => {
    it("should have config", function (done) {
      helper.load([database], flow, function () {
        try {
          const n1 = helper.getNode("database");

          n1.should.have.property("name", "My Database");
          n1.should.have.property("type", "firebase-config");

          n1.config.should.have.property("authType", "email");

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should have emitted the 'unused' warning message", function (done) {
      helper.load([database], flow, function () {
        try {
          const n1 = helper.getNode("database");

          const logEvents = helper.log().args.filter(function (evt) {
            return evt[0].type === "firebase-config" && evt[0].level === 30;
          });

          logEvents[0][0].should.have.property("msg", "WARNING: 'My Database' config node is unused! All connections with Firebase will be closed...");

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should have called login", function (done) {
      helper.load([database], flow, function () {
        try {
          const n1 = helper.getNode("database");

          n1.client.should.be.Object();
          n1.client.should.be.instanceOf(Client);

          n1.client.signInAnonymously.should.have.been.called;

          const logEvents = helper.log().args.filter(function (evt) {
            return evt[0].type == "firebase-config" && evt[0].level === 20;
          });

          logEvents[0][0].should.have.property("msg", "Please check your API key.");

          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  context("When the credentials is setted", () => {
    const creds = { apiKey: apiKey, url: url, email: "actions@github.com", password: "awesomePassword4gh-actions" };

    it("should validate the API Key", function (done) {
      helper.load([database], flow, { "database": { apiKey: apiKey } }, async function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");

          await n1.clientSignedIn();

          const logEvents = helper.log().args.filter(function (evt) {
            return evt[0].type == "firebase-config" && evt[0].level === 20;
          });

          logEvents[0][0].should.have.property("msg", "Please check your database URL");

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should validate the Database URL", function (done) {
      helper.load([database], flow, { "database": creds }, async function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");

          await n1.clientSignedIn();

          const logEvents = helper.log().args.filter(function (evt) {
            return evt[0].type == "firebase-config" && evt[0].level === 20;
          });

          logEvents.should.have.length(0);

          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  context("When the database is used", () => {
    const creds = { apiKey: apiKey, url: url, email: "actions@github.com", password: "awesomePassword4gh-actions" };

    it("should have initialised the RTDB", function (done) {
      helper.load([database], flow, { "database": creds }, async function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");
          n1.addStatusListener.should.have.been.called;

          await n1.clientSignedIn();

          n1.rtdb.should.be.Object();
          n1.rtdb.should.be.instanceOf(RTDB);

          const logEvents = helper.log().args.filter(function (evt) {
            return evt[0].type == "firebase-config" && evt[0].level === 20;
          });

          logEvents.should.have.length(0);

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should have initialised Firestore", function (done) {
      helper.load([database], flow, { "database": { ...creds, projectId: projectId } }, async function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "firestore");
          n1.addStatusListener.should.have.been.called;

          await n1.clientSignedIn();

          n1.firestore.should.be.Object();
          n1.firestore.should.be.instanceOf(Firestore);

          const logEvents = helper.log().args.filter(function (evt) {
            return evt[0].type == "firebase-config" && evt[0].level === 20;
          });

          logEvents.should.have.length(0);

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should have initialised both RTDB and Firestore", function (done) {
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "email", status: { firestore: true } }];

      helper.load([database], flow, { "database": creds }, async function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "firestore");
          n1.addStatusListener.should.have.been.called;

          await n1.clientSignedIn();

          n1.rtdb.should.be.Object();
          n1.rtdb.should.be.instanceOf(RTDB);
          n1.firestore.should.be.Object();
          n1.firestore.should.be.instanceOf(Firestore);

          const logEvents = helper.log().args.filter(function (evt) {
            return evt[0].type == "firebase-config" && evt[0].level === 20;
          });

          logEvents.should.have.length(0);

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should triggers the connection events", function (done) {
      helper.load([database], flow, { "database": creds }, async function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");

          n1.rtdb.subscribeConnectionState.should.have.been.called;

          n1.rtdb
            .on("connecting", () => {
              n1.rtdb.offline.should.be.false;
              n1.rtdb.connectionState.should.be.equal(1);
            })
            .on("connected", () => {
              n1.rtdb.offline.should.be.false;
              n1.rtdb.connectionState.should.be.equal(2);
              done();
            });

          await n1.clientSignedIn();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  context("When the database becomes unused", () => {
    const creds = { apiKey: apiKey, url: url };

    it("should have emitted the 'closing' warning message", function (done) {
      helper.load([database], flow, { "database": creds }, function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");

          n1.rtdb.on("connected", () => {
            n1.removeStatusListener("fake-node", "rtdb", () => {});
            n1.removeStatusListener.should.have.been.called;

            n1.rtdb.goOffline.should.have.been.called;
            n1.rtdb.offline.should.be.true;
            n1.rtdb.removeConnectionState.should.have.been.called;

            const logEvents = helper.log().args.filter(function (evt) {
              return evt[0].type == "firebase-config" && evt[0].level === 30;
            });
  
            logEvents[0][0].should.have.property("msg", "WARNING: 'My Database' config node is unused! All connections with Firebase will be closed...");

            done();
          });
        } catch (error) {
          done(error);
        }
      });
    });
  });

  context("When the config-node is closed", function () {
    it("should signOut and delete App", function (done) {
      helper.load([database], flow, function () {
        try {
          const n1 = helper.getNode("database");

          n1.close(true)
            .then(() => {
              n1.client.signOut.should.have.been.called;
              n1.client._app.deleteApp.should.have.been.called;
              done();
            })
            .catch((error) => done(error));
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

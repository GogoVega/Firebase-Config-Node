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
const { RTDB } = require("../build/lib/firebase/rtdb");

const helper = require("node-red-node-test-helper");
const should = require('should');

const apiKey = process.env.API_KEY;
const url = process.env.RTDB_URL;

// TODO: Add more tests
describe("Firebase Config Node", function () {
  before(function (done) {
    helper.startServer(done);
  });

  after(function (done) {
    helper.stopServer(done);
  });

  afterEach(async function () {
    await helper.unload();
  });

  context("When the config-node is loaded", () => {
    it("should have config", function (done) {
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];

      helper.load([database], flow, function () {
        try {
          const n1 = helper.getNode("database");

          n1.should.have.property("name", "My Database");
          n1.should.have.property("type", "firebase-config");

          n1.config.should.have.property("authType", "anonymous");

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should have emitted the 'unused' warning message", function (done) {
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];

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
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];

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
    const creds = { apiKey: apiKey, url: url };

    it("should validate the API Key", function (done) {
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];
      const creds = { apiKey: apiKey };

      helper.load([database], flow, { "database": creds }, function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");

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
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];

      helper.load([database], flow, { "database": creds }, function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");

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
    const creds = { apiKey: apiKey, url: url };

    it("should have initialised the rtdb", function (done) {
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];

      helper.load([database], flow, { "database": creds }, function () {
        try {
          const n1 = helper.getNode("database");

          n1.addStatusListener("fake-node", "rtdb");
          n1.addStatusListener.should.have.been.called;

          n1.rtdb.should.be.Object();
          n1.rtdb.should.be.instanceOf(RTDB);

          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it("should triggers the connection events", function (done) {
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];

      helper.load([database], flow, { "database": creds }, function () {
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
        } catch (error) {
          done(error);
        }
      });
    });
  });

  context("When the database becomes unused", () => {
    const creds = { apiKey: apiKey, url: url };

    it("should have emitted the 'closing' warning message", function (done) {
      const flow = [{ id: "database", type: "firebase-config", name: "My Database", authType: "anonymous" }];

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
});

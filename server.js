require("dotenv").config();
const apiRoutes = require("./routes");
const red = require("redis");
const express = require("express");
const bodyParser = require("body-parser");
const admin = express();
const { createServer } = require("http");
const { Server } = require("socket.io");
const { log } = require("console");
const db = require("./modules/db");
const Engine = require("./modules/scaleEngine");

const AWSConfiguration = require("./modules/awsConfig");
const IController = new AWSConfiguration();
const SuccessHandler = require("./util/SuccessHandler");

const MonetIO = require("./modules/websockets");

let redis;

const PORT = process.env.PORT || 3000;

(async () => {
  redis = red.createClient({
    url: "redis://:monet%40615@34.220.116.222:6379",
  });
  redis.on("error", (err) => console.log("Redis Client Error", err));
  await redis.connect();
})();

/* Instantiate the engine class */
const engine = new Engine();
engine.DBEntryFunction(getAllAutoInstances);
engine.on("create-instance", ({ name }) => {
  console.log("Instance creation signal with name : ", name);
  /* Check whether this object needs to be recorded or not. */
  IController.createInstance(name)
    .then((data) => engine.addInternalIpImageId(data))
    .catch((err) =>
      console.log(
        "An error occured while attempting to create instance. Kindly check. : ",
        err
      )
    );
});

engine.on("delete-instance", async (instance) => {
  console.log(instance);
  const awsInstanceData = await IController.deleteInstance(instance.ImageId);
  await deleteInstance(instance.publicIP);
  engine.deleteConfirmation(awsInstanceData);
});

engine.on("up-instance-image", async ({ ImageId, privateIP }) => {
  const update = await updateImageId(ImageId, privateIP);
  console.log(`The update status for ${privateIP} is `, update);
});

const httpServer = createServer(admin);
const io = new Server(httpServer, {
  /* options */
  path: "/sock",
  transports: ["websocket"],
});

new db();
new MonetIO(io);

admin.use(bodyParser.json());
admin.use("/test", express.static("tests"));
admin.get('/register-instance', instanceRegistrationHandle);

admin.use("/", apiRoutes);

httpServer.listen(PORT, () => log(`[Server OK]`));

const instanceRegistrationHandle = async (req, res) => {
  await createOneInstance(req, res, ({ error, success }) => {
    if (error) return console.log('Instance creation error : ', error);
    console.log('Instance creation success : ', success, Object.keys(success));
    if (success) if (success.publicIP) engine.addInstance(success);
  });
};

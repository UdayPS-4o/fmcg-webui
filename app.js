const express = require("express");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const fs = require("fs").promises;
const path = require("path");
const app = express();
const PORT = 80;
const io = require("socket.io");
const {
  redirect,
  getDbfData,
  getCmplData,
  ensureDirectoryExistence,
  saveDataToJsonFile,
} = require("./routes/utilities");

app.use(cookieParser());

const spawn = require("child_process").spawn;
app.use(express.static("./node_modules/html-template-02"));
// app.use(express.static('./public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// use external routes from ./routes/login.js
const loginRoutes = require("./routes/login");
app.use(loginRoutes);

// set middleware to check if user is logged in
const middleware = require("./routes/middleware");
app.use(middleware);

app.set("view engine", "ejs");

// Endpoint to get data from CMPL.DBF and return as JSON
app.get("/cmpl", getCmplData);

app.get("/", (req, res) => {
  res.redirect("/account-master");
});

const dbfRoutes = require("./routes/get/db");
app.use(dbfRoutes);

const editRoutes = require("./routes/get/edit");
app.use(editRoutes);

const formRoutes = require("./routes/get/form");
app.use(formRoutes);

const postRoutes = require("./routes/post");
app.use(postRoutes);

// Initialize server
const initServer = () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

initServer();

require("./routes/watcher");

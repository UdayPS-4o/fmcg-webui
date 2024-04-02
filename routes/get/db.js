const express = require("express");
const app = express.Router();
const fs = require("fs").promises;
const path = require("path");
const {redirect, getDbfData, getCmplData, ensureDirectoryExistence, saveDataToJsonFile} = require("../utilities");

app.get("/json/:file", async (req, res) => {
  const { file } = req.params;
  try {
    let data = (await fs.readFile(`./db/${file}.json`, "utf8")) || "[]";
    res.json(JSON.parse(data));
  } catch (error) {
    console.error(`Failed to read or parse ${file}.json:`, error);
    res.status(500).send("Server error");
  }
});

app.get("/dbf/:file", async (req, res) => {
  let { file } = req.params;

  try {
    // let dbfFiles = await getDbfData(path.join(__dirname,"..",'d01-2324','data', file));
    let dbfFiles = await fs
      .readFile(
        path.join(
          __dirname,
          "..",
          "..",
          "..",
          "d01-2324",
          "data",
          "json",
          file.replace(".dbf", ".json").replace(".DBF", ".json")
        ),
        "utf8"
      )
      .then((data) => JSON.parse(data));
    res.render("pages/db/dbf", { dbfFiles, name: file, file: file });
    // res.json(dbfFile);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/api/dbf/:file", async (req, res) => {
  let { file } = req.params;

  try {
    // let dbfFiles = await getDbfData(path.join(__dirname,"..",'d01-2324','data', file));
    let dbfFiles = await fs
      .readFile(
        path.join(
          __dirname,
          "..",
          "..",
          "..",
          "d01-2324",
          "data",
          "json",
          file.replace(".dbf", ".json").replace(".DBF", ".json")
        ),
        "utf8"
      )
      // .then((data) => JSON.parse(data));
    res.send(dbfFiles);
    // res.json(dbfFile);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/dbf", async (req, res) => {
  try {
    const files = await fs.readdir(path.join("../", "./d01-2324/data"));
    // Filter out non-DBF files and create index key 1,2,3
    let dbfFiles = files
      .filter((file) => file.endsWith(".dbf") || file.endsWith(".DBF"))
      .map((file, index) => ({ name: file }));
    res.render("pages/db/dbf", {
      dbfFiles,
      name: "DBF Files",
      file: "dbf-files",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

module.exports = app;

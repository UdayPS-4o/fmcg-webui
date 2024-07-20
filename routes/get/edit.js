const express = require("express");
const app = express.Router();
const fs = require("fs").promises;
const path = require("path");
const {
  redirect,
  getDbfData,
  getCmplData,
  ensureDirectoryExistence,
  saveDataToJsonFile,
} = require("../utilities");

const uniqueIdentifiers = ["receiptNo", "voucherNo", "subgroup", 'id'];

app.get("/edit/:page/:id", async (req, res) => {
  const { page, id } = req.params;
  let data = (await fs.readFile(`./db/${page}.json`, "utf8")) || "[]";
  data = JSON.parse(data);

  // find the entry with the specified receiptNo or voucherNo or any unique identifier
  let keys = Object.keys(data[0]);
  let validKey = keys.find((key) => uniqueIdentifiers.includes(key));
  console.log("validKEY", validKey);
  let receipt = data.find((entry) => entry[validKey] === id);

  if (!receipt) {
    res.status(404).send("Receipt not found " + redirect(`/db/${page}`, 2000));
    return;
  }

  res.render(`pages/edit/${page}`, { receipt });

  return;
});

// make this route delete/cash-receipts/${id}
app.get("/delete/:page/:id", async (req, res) => {
  const { page, id } = req.params;
  let data = (await fs.readFile(`./db/${page}.json`, "utf8")) || "[]"; // read the file
  data = JSON.parse(data); // parse the data
  let keys = Object.keys(data[0]); // get the keys
  let validKey = keys.find((key) => uniqueIdentifiers.includes(key)); // get the valid key
  let receipt = data.find((entry) => entry[validKey] === id); // find the entry with the specified key
  if (!receipt) {
    res.status(404).send("Receipt not found " + redirect(`/db/${page}`, 2000));
    return;
  }
  let index = data.findIndex((entry) => entry[validKey] === id); // get the index of the entry
  data.splice(index, 1); // remove the entry
  await fs.writeFile(
    `./db/${page}.json`,
    JSON.stringify(data, null, 2),
    "utf8"
  ); // write the data back to the file
  res
    .status(200)
    .send("Entry deleted successfully " + redirect(`/db/${page}`, 1000)); // send a success message
});

module.exports = app;

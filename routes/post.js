const express = require("express");
const app = express.Router();
const fs = require('fs');
const path = require('path');


const {
  redirect,
  getDbfData,
  getCmplData,
  ensureDirectoryExistence,
  saveDataToJsonFile,
} = require("./utilities");

const uniqueIdentifiers = ["receiptNo", "voucherNo", "subgroup",'id'];

app.post("/:formType", async (req, res) => {
  const { formType } = req.params;
  const formData = req.body;

  if (formData.items && typeof formData.items === "string") {
    formData.items = JSON.parse(formData.items);
  }

  const ogform = JSON.parse(JSON.stringify(formData));
  
  if (formData.party && typeof formData.party === "string") {
    formData.party = JSON.parse(formData.party)[0].value;
  }
  if (formData.subgroup && typeof formData.subgroup === "string") {
    formData.subgroup = JSON.parse(formData.subgroup)[0].value;
  }

  const filePath = path.join(__dirname, "..", "db", `${formType}.json`);

  function convertAmountToWords(amount) {
    const oneToTwenty = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const scales = ["", "Thousand", "Lakh", "Crore"];

    function convertLessThanOneThousand(number) {
      let words;
      if (number % 100 < 20) {
        words = oneToTwenty[number % 100];
        number = Math.floor(number / 100);
      } else {
        words = oneToTwenty[number % 10];
        number = Math.floor(number / 10);
        words = tens[number % 10] + " " + words;
        number = Math.floor(number / 10);
      }
      if (number === 0) return words;
      return oneToTwenty[number] + " Hundred " + words;
    }

    function convert(amount) {
      let words = "";
      for (let i = 0; i < scales.length; i++) {
        if (amount % 1000 !== 0) {
          words =
            convertLessThanOneThousand(amount % 1000) +
            " " +
            scales[i] +
            " " +
            words;
        }
        amount = Math.floor(amount / 1000);
      }
      return words.trim();
    }

    const words = convert(amount);
    return words ? words + " Only" : "Zero Only";
  }

  function ToBeRedirect(formType, val) {
    if (formType === "cash-receipts") {
      let url = `/print?date=${formData.date}&receiptNo=${formData.receiptNo}&amount=${formData.amount}&inWords=${convertAmountToWords(formData.amount)}&party=${formData.party}&series=${formData.series}&discount=${formData.discount}&name=${formData.name}`;
      return res.redirect(url);
    }
    if (formType === "godown") {
      // convert formData to GET query string and redirect to print page 
      let url = `/printGODOWN?data=${encodeURIComponent(JSON.stringify(formData))}`;
      return res.redirect(url);
    }
    return res.redirect(`/db/${formType}`);
  }

  try {
    let dbData = [];
    try {
      const data = await fs.promises.readFile(filePath, "utf8");
      dbData = JSON.parse(data);
    } catch (err) {
      console.log("No existing file, creating a new one." + err);
    }

    const validKEY = uniqueIdentifiers.find((key) => formData[key]);
    const entryExists = dbData.some(
      (entry) => entry[validKEY] === formData[validKEY]
    );

    if (entryExists) {
      return res
        .status(400)
        .send(
          "Error: Entry with this receiptNo already exists. " +
            validKEY +
            " | " +
            JSON.stringify(ogform)
        );
    } else {
      dbData.push(formData);
      await fs.promises.writeFile(filePath, JSON.stringify(dbData, null, 2), "utf8");
      res
        .status(200)
        .send("Entry added successfully." + ToBeRedirect(formType, 500));
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to add data.");
  }
});




app.post("/edit/:formType", async (req, res) => {
  const { formType } = req.params;
  const formData = req.body;

  if (formData.items && typeof formData.items === "string") {
    try {
      formData.items = JSON.parse(formData.items);
    } catch (error) {
      console.error("Failed to parse items:", error);
      return res.status(400).send("Invalid format for items.");
    }
  }

  if (formData.party && typeof formData.party === "string") {
    try {
      formData.party = JSON.parse(formData.party)[0].value;
    } catch (error) {
      console.error("Failed to parse party:", error);
      return res.status(400).send("Invalid format for party.");
    }
  }

  const filePath = path.join(__dirname, "..", "db", `${formType}.json`);

  console.log(`Checking if the file exists: ${filePath}`);

  try {
    let dbData;
    try {
      const data = await fs.promises.readFile(filePath, "utf8");
      dbData = JSON.parse(data);
    } catch (readError) {
      if (readError.code === 'ENOENT') {
        console.error(`File not found: ${filePath}`);
        return res.status(404).send("Database file does not exist.");
      } else {
        console.error("Error reading database file:", readError);
        return res.status(500).send("Database file read error." + filePath);
      }
    }

    const entryIndex = dbData.findIndex(
      (entry) => entry.receiptNo === formData.receiptNo
    );

    if (entryIndex > -1) {
      dbData[entryIndex] = { ...dbData[entryIndex], ...formData };
      try {
        await fs.promises.writeFile(filePath, JSON.stringify(dbData, null, 2), "utf8");
        res
          .status(200)
          .send(
            "Entry updated successfully. " + redirect(`/db/${formType}`, 500)
          );
      } catch (writeError) {
        console.error("Error writing to database file:", writeError);
        res.status(500).send("Failed to write updated data.");
      }
    } else {
      res
        .status(404)
        .send(
          `Error: Entry with specified receiptNo does not exist. <br> ${JSON.stringify(
            formData
          )} <br> ${entryIndex} <br> ${dbData.length}`
        );
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).send("Failed to edit data.");
  }
});





app.get("/add/godown", async (req, res) => {
  let { data } = req.query;
  const filePath = path.join(__dirname, "..", "db", "godown.json");

  data = decodeURIComponent(data);
  data = JSON.parse(data);

  const getDbfData = async (file) => {
    let filepath = (path.join(__dirname, "..", "..", "d01-2324", "data", "json", file.replace(/\.dbf$/i, ".json")))
    const data = fs.readFileSync(filepath, "utf8");
    return JSON.parse(data);
  }
  const jsonGodown = await getDbfData("godown.json");
  const pmplJSON = (await getDbfData("pmpl.json")).filter(item => item.STK > 0);

  function findElmPMPL(code) {
    return pmplJSON.find(item => item.CODE === code);
  }


  let datax = {};
  datax.voucher = {
    number: data.series+ " - " + data.id,
    id: data.id,
    date: data.date,
    transfer_from: jsonGodown.find(item => item.GDN_CODE === data.fromGodown).GDN_NAME,
    transfer_to: jsonGodown.find(item => item.GDN_CODE === data.toGodown).GDN_NAME,
  }

  let i=1;
  datax.items = data.items.map(item => {
    const pmplItem = findElmPMPL(item.code);
    return {
      "s_n"          : i++,
      "code"         : item.code,
      "particular"   : pmplItem.PRODUCT,
      "pack"         : pmplItem.PACK,
      "gst_percent"  : parseFloat(pmplItem.GST).toFixed(2),
      "unit"         : (item.unit == "01" ? pmplItem.UNIT_1 : pmplItem.UNIT_2) + (pmplItem.UNIT_1 == pmplItem.UNIT_2 && pmplItem.MULT_F == 1 ? "" : " - " + pmplItem.MULT_F),
      "quantity"     : item.qty
    }
  });

  res.send(JSON.stringify(datax));
});






app.get("/api/TRFLAST", async (req, res) => {
  const getDbfData = async (file) => {
    let filepath = (path.join(__dirname, "..", "..", "d01-2324", "data", "json", file.replace(/\.dbf$/i, ".json")))
    const data = fs.readFileSync(filepath, "utf8");
    return JSON.parse(data);
  }
  const trfJSON = await getDbfData("transfer.json");
  const TRFLAST = parseInt(trfJSON[trfJSON.length - 1].BILL);
  const godownJSON = await fs.promises.readFile(path.join(__dirname, "..", "db", "godown.json"), "utf8").then(data => JSON.parse(data));
  const LOCALLAST = parseInt(godownJSON[godownJSON.length - 1].id);


  res.send(`${Math.max(TRFLAST, LOCALLAST) + 1}`);
});






module.exports = app;

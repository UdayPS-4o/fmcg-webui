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
} = require("./utilities");

const uniqueIdentifiers = ["receiptNo", "voucherNo", "subgroup"];

app.post("/:formType", async (req, res) => {
  const { formType } = req.params;
  const formData = req.body;
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
      // form data is date: '2024-03-31', receiptNo: '72',party: 'CT000',series: '345',  amount: '23452345',discount: '0.03  url  is  /print?companyName=ABC%20Corporation&address=123%20Main%20Street%2C%20Anytown&date=01.01.2025&mode=Credit%20Card&receiptNo=1234&name=John%20Doe&code=ABC123&amount=500.00&inWords=Five%20Hundred%20Only
      let url = `/print?date=${formData.date}&receiptNo=${
        formData.receiptNo
      }&amount=${formData.amount}&inWords=${convertAmountToWords(
        formData.amount
      )}&party=${formData.party}&series=${formData.series}&discount=${
        formData.discount
      }&name=${formData.name}`;
      return redirect(url, val);
    }
    return redirect(`/db/${formType}`, val);
  }

  try {
    let dbData = [];
    try {
      const data = await fs.readFile(filePath, "utf8");
      dbData = JSON.parse(data);
    } catch (err) {
      console.log("No existing file, creating a new one.");
    }

    // const entryExists = dbData.some(entry => entry.receiptNo === formData.receiptNo);
    // entry key can be voucherNo or receiptNo

    // const entryExists = dbData.some(entry => uniqueIdentifiers.some(key => entry[key] === formData[key]));

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
      await fs.writeFile(filePath, JSON.stringify(dbData, null, 2), "utf8");
      res
        .status(200)
        .send("Entry added successfully." + ToBeRedirect(formType, 500));
    }
  } catch (err) {
    console.error(err);
    console.error(err);
    res.status(500).send("Failed to add data.");
  }
});

app.post("/edit/:formType", async (req, res) => {
  const { formType } = req.params;
  const formData = req.body;

  if (formData.party && typeof formData.party === "string") {
    console.log(formData);
    formData.party = JSON.parse(formData.party)[0].value;
  }

  const filePath = path.join(__dirname, "..", "db", `${formType}.json`);

  try {
    let dbData = await fs
      .readFile(filePath, "utf8")
      .then((data) => JSON.parse(data))
      .catch(() => {
        throw new Error("Database file read error or file does not exist.");
      });

    const entryIndex = dbData.findIndex(
      (entry) => entry.receiptNo === formData.receiptNo
    );

    if (entryIndex > -1) {
      dbData[entryIndex] = { ...dbData[entryIndex], ...formData };
      await fs.writeFile(filePath, JSON.stringify(dbData, null, 2), "utf8");
      res
        .status(200)
        .send(
          "Entry updated successfully. " + redirect(`/db/${formType}`, 500)
        );
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
    console.error(err);
    res.status(500).send("Failed to edit data.");
  }
});

module.exports = app;

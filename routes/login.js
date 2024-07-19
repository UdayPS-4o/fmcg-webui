const express = require('express');
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

app.post("/api/login", async (req, res) => {
  const formData = req.body;
  console.log(formData);
  const { username, password } = formData;
  const filePath = path.join(__dirname, "..", "db", "users.json");
  try {
    let dbData = await fs
      .readFile(filePath, "utf8")
      .then((data) => JSON.parse(data))
      .catch(() => {
        throw new Error("Database file read error or file does not exist.");
      });

    const user = dbData.find(
      (entry) => entry.username === username && entry.password === password
    );

    if (user) {
      const newToken = Math.random().toString(36).substring(7);
      user.token = newToken;
      await fs.writeFile(filePath, JSON.stringify(dbData, null, 2), "utf8");
      res.status(200)
        .header("Set-Cookie", `token=${newToken}; Path=/; Max-Age=3600;`)
        .send("Login successful." + redirect(`/db/cash-receipts`, 500))
    } else {
      res.status(404).send("Error: Invalid username or password.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to login." + err);
  }
});
  
app.get("/login", async (req, res) => {
  let firms = await getDbfData(path.join(__dirname, "..", "..", "FIRM", "FIRM.DBF")); 
  res.render("pages/login/login", { firm: firms });
});

app.get("/logout", (req, res) => {
res
  .status(200)
  .clearCookie("token")
  .redirect("/login");
  // .send("Logout successful." + redirect("/login", 2000));
});


app.get("/admin", async (req, res) => {
  let firms = await getDbfData(path.join(__dirname, "..", "..", "FIRM", "FIRM.DBF")); 
  res.render("pages/admin/admin", { firm: firms });
});

module.exports = app;
import * as cheerio from "cheerio";
import fs from "fs";
(async () => {
  let links = [];
  await fetch("https://www.whtsgrouplinks.net/", {
    method: "GET",
  })
    .then((res) => res.text())
    .then((html) => {
      const $ = cheerio.load(html);

      $("a").each((index, element) => {
        links.push($(element).attr("href"));
      });
    });

  let headings = links.filter((link) =>
    link.split("/").includes("www.whtsgrouplinks.net")
  );
  let chatLinks = links.filter((link) =>
    link.split("/").includes("chat.whatsapp.com")
  );

  const data = {
    headings: headings,
    chatLinks: chatLinks,
  };

  fs.writeFile("whatsapp.json", JSON.stringify(data), (err) => {
    if (err) throw err;
    console.log("Data written to file");
  });
})();

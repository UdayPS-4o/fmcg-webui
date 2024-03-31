const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises; 
const path = require('path');
const app = express();
const PORT = 80;
const io = require('socket.io');
const { get } = require('http');

const spawn = require('child_process').spawn;
// app.use(express.static('./node_modules/public'));
app.use(express.static('./public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use((err, req, res, next) => {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('io')) {
        // Hide the 'io' error in development
        if (process.env.NODE_ENV === 'development') { return next(); } 

        // Alternatively, display a basic message to the user if preferred
        res.status(500).send("Something went wrong. Please try again later."); 
    } else {
        next(err); // Pass other errors to the default handler 
    }
});


app.set('view engine', 'ejs');

const uniqueIdentifiers = ['receiptNo', 'voucherNo', 'subgroup'];



const getDbfData = (path) => {
    return new Promise((resolve, reject) => {
        const process = spawn('python', ['dbfJS.py', path]);
        let data = '';
        process.stdout.on('data', (chunk) => {
            data += chunk;
        });
        process.on('close', (code) => {
            if (code === 0) {
                resolve(JSON.parse(data));
            } else {
                reject(`Process exited with code ${code}`);
            }
        });
    });
}


let i = 0;
setInterval(() => {
  i++;
}, 1000);

// getDbfData("C:/Users/udayps/Documents/code/1TA/fmcg/d01-2324/data/CASH.DBF").then(data => {
//     fs.writeFile("CASH.json", JSON.stringify(data,null,2), 'utf8');
//     console.log(`Data converted in ${i} seconds`);
// })


const processData = async (dbData) => {
  let data = dbData;

  // Find unique party codes
  const uniquePartyCodes = [...new Set(data.map(item => item.C_CODE))];

  // Array to store results
  const partyResults = [];

  // Calculate results for each party code
  uniquePartyCodes.forEach(partycode => {
      const partyData = data.filter(item => item.C_CODE === partycode);
      let cr = 0, dr = 0;

      partyData.forEach(item => {
          cr += item.CR;
          dr += item.DR;
      });

      let result = cr - dr;
      if (result < 0) {
          result = Math.abs(result) + " DR";
      } else {
          result = result + " CR";
      }

      partyResults.push({ partycode: partycode, result: result });
  });

  const results = {
    lastModifiedTime: new Date().toISOString(),
    data: partyResults 
};
return results;
};


async function watchFile() {
  const dbfFilePath = "C:/Users/udayps/Documents/code/1TA/fmcg/d01-2324/data/CASH.DBF";
  let lastModifiedTime = null;

  setInterval(async () => {
      try {
          // if (fs.existsSync(dbfFilePath)) {
          // fs.existsSync equivalent
          try {
          
            if (fs.access(dbfFilePath)) {
              lastModifiedTime = await fs.readFile('./db/balance.json', 'utf8').then(data => {
                return JSON.parse(data).lastModifiedTime;
              });
            }
          } catch (error) {
          }

          const stats = await fs.stat(dbfFilePath);
          const currentModifiedTime = stats.mtimeMs;
          console.log('Current Modified Time:', currentModifiedTime);
          console.log('Last Modified Time:', lastModifiedTime);
          if (!lastModifiedTime || currentModifiedTime > lastModifiedTime) {
              lastModifiedTime = currentModifiedTime;
              console.log('File updated - processing...');

              const dbData = await getDbfData(dbfFilePath);
              let results = await processData(dbData);
              results.lastModifiedTime = currentModifiedTime;
              await fs.writeFile('./db/balance.json', JSON.stringify(results, null, 2));

              console.log('Results updated');
          }
      } catch (error) {
          console.error('Error checking file:', error);
      }
  }, 60 * 1000); // Check every 5 minutes
}

// watchFile(); 


const dbfDir = 'C:/Users/udayps/Documents/code/1TA/fmcg/d01-2324/data';
const jsonDir = path.join(dbfDir, 'json');

async function convertDbfToJson() {
  try {
    const files = await fs.readdir(dbfDir);
    const dbfFiles = files.filter(file => path.extname(file).toLowerCase() === '.dbf');

    for (const dbfFile of dbfFiles) {
      const dbfFilePath = path.join(dbfDir, dbfFile);
      const jsonFilePath = path.join(jsonDir, `${path.basename(dbfFile, '.dbf')}.json`);

      const dbData = await getDbfData(dbfFilePath);
      await fs.writeFile(jsonFilePath, JSON.stringify(dbData, null, 2));

      console.log(`Converted ${dbfFile} to ${path.basename(jsonFilePath)}`);
    }
  } catch (error) {
    console.error('Error converting DBF to JSON:', error);
  }
}

convertDbfToJson();

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises; 
const path = require('path');
const app = express();
const PORT = 80;
const io = require('socket.io');

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

const getCmplData = async (req, res) => {
    const dbfFilePath = path.join(__dirname, "..",'d01-2324/data', 'CMPL.dbf');
    console.log(dbfFilePath);
    try {
        const jsonData = await getDbfData(dbfFilePath);
        if (req === "99") return jsonData; else res.json(jsonData);
    } catch (error) {
        res.status(500).send(error);
    }
};



// Endpoint to get data from CMPL.DBF and return as JSON
app.get('/cmpl', getCmplData);

app.get('/json/:file', async (req, res) => {
    const { file } = req.params;
    try {
        let data = await fs.readFile(`./db/${file}.json`, 'utf8') || '[]';
        res.json(JSON.parse(data));
    }
    catch (error) {
        console.error(`Failed to read or parse ${file}.json:`, error);
        res.status(500).send('Server error');
    }

});

app.get('/dbf/:file', async (req, res) => {
    let { file } = req.params;
    
    try {
        let dbfFiles = await getDbfData(path.join(__dirname,"..",'d01-2324','data', file));
        res.render('pages/db/dbf', { dbfFiles , name: file, file: file});
        // res.json(dbfFile);
    } catch (error) {
        res.status(500).send(error);
    }
});


app.get('/dbf', async (req, res) => {
    try {
        const files = await fs.readdir(path.join("../",'./d01-2324/data'));
        // Filter out non-DBF files and create index key 1,2,3
        let dbfFiles = files.filter(file => file.endsWith('.dbf') || file.endsWith('.DBF')).map((file, index) => ({ name: file }));
        res.render('pages/db/dbf', { dbfFiles , name: 'DBF Files', file: 'dbf-files'});
    } catch (error) {
        res.status(500).send(error);
    }
});



// Function to ensure directory exists
const ensureDirectoryExistence = async (filePath) => {
    const dirname = path.dirname(filePath);
    try {
        await fs.access(dirname);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirname, { recursive: true });
        } else {
            throw error; // Rethrow unexpected errors
        }
    }
};


// Function to save data to JSON file
const saveDataToJsonFile = async (filePath, data) => {
    await ensureDirectoryExistence(filePath);

    let existingData = [];
    try {
        const fileContent = await fs.readFile(filePath, 'utf8').catch(error => {
            if (error.code !== 'ENOENT') throw error; // Ignore file not found errors
        });
        existingData = fileContent ? JSON.parse(fileContent) : [];
    } catch (error) {
        console.error('Error parsing existing file content:', error);
    }

    existingData.push(data);
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 4));
};




// Dynamic route to handle form submission based on the form action

// app.post('/:formType', (req, res) => {
//     const { formType } = req.params;
//     let formData = req.body; // This contains your form data

//     if (formData.party) {
//         formData.party = JSON.parse(formData.party)[0].value;
//     }

//     const filePath = path.join(__dirname, 'db', `${formType}.json`);

//     // Function to read JSON file, update or add data, and save back to the file
//     function updateOrAddData(filePath, formData) {
//         fs.readFile(filePath, (err, data) => {
//             if (err && err.code === 'ENOENT') {
//                 // If the file does not exist, create a new array with formData and save it
//                 fs.writeFile(filePath, JSON.stringify([formData]), err => {
//                     if (err) throw err;
//                     res.send('Data saved successfully');
//                 });
//             } else if (err) {
//                 throw err;
//             } else {
//                 // Parse the existing data in the file
//                 let existingData = JSON.parse(data);

//                 // Check if the receiptNo already exists
//                 let index = existingData.findIndex(item => item.receiptNo === formData.receiptNo);

//                 if (index !== -1) {
//                     // Update existing object
//                     existingData[index] = formData;
//                 } else {
//                     // Add new object
//                     existingData.push(formData);
//                 }

//                 // Save the updated data back to the file
//                 fs.writeFile(filePath, JSON.stringify(existingData), err => {
//                     if (err) throw err;
//                     res.send('Data updated or added successfully'+ redirect(`/db/${formType}`, 2000));
//                 });
//             }
//         });
//     }

//     updateOrAddData(filePath, formData);
// });

// Dynamic route to handle form submission based on the form action


app.post('/:formType', async (req, res) => {
    const { formType } = req.params;
    const formData = req.body;
    const ogform = JSON.parse(JSON.stringify(formData));
    if (formData.party && typeof formData.party === 'string') {
        formData.party = JSON.parse(formData.party)[0].value;
    }
    if (formData.subgroup && typeof formData.subgroup === 'string') {
        formData.subgroup = JSON.parse(formData.subgroup)[0].value;
    }
    
    const filePath = path.join(__dirname, 'db', `${formType}.json`);
    
    try {
        let dbData = [];
        try {
            const data = await fs.readFile(filePath, 'utf8');
            dbData = JSON.parse(data);
        } catch (err) {
            console.log('No existing file, creating a new one.');
        }
        
        // const entryExists = dbData.some(entry => entry.receiptNo === formData.receiptNo);
        // entry key can be voucherNo or receiptNo

        // const entryExists = dbData.some(entry => uniqueIdentifiers.some(key => entry[key] === formData[key]));
        const validKEY = uniqueIdentifiers.find(key => formData[key]);
        const entryExists = dbData.some(entry => entry[validKEY] === formData[validKEY]);
        
        if (entryExists) {
            return res.status(400).send('Error: Entry with this receiptNo already exists. ' + validKEY +" | "+ JSON.stringify(ogform));
        } else {
            dbData.push(formData);
            await fs.writeFile(filePath, JSON.stringify(dbData, null, 2), 'utf8');
            res.status(200).send('Entry added successfully.'+ redirect(`/db/${formType}`, 500));
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to add data.');
    }
});

app.post('/edit/:formType', async (req, res) => {
    const { formType } = req.params;
    const formData = req.body;

    if (formData.party && typeof formData.party === 'string') {
        console.log(formData)
        formData.party = JSON.parse(formData.party)[0].value;
    }
    
    const filePath = path.join(__dirname, 'db', `${formType}.json`);
    
    try {
        let dbData = await fs.readFile(filePath, 'utf8').then(data => JSON.parse(data)).catch(() => {
            throw new Error('Database file read error or file does not exist.');
        });
        
        const entryIndex = dbData.findIndex(entry => entry.receiptNo === formData.receiptNo);

        if (entryIndex > -1) {
            dbData[entryIndex] = { ...dbData[entryIndex], ...formData };
            await fs.writeFile(filePath, JSON.stringify(dbData, null, 2), 'utf8');
            res.status(200).send('Entry updated successfully. ' + redirect(`/db/${formType}`, 500));
        } else {
            res.status(404).send(`Error: Entry with specified receiptNo does not exist. <br> ${JSON.stringify(formData)} <br> ${entryIndex} <br> ${dbData.length}`);
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to edit data.');
    }
});







app.get('/cash-receipts', async (req, res) => {
    const filePath = path.join(__dirname, 'db', 'cash-receipts.json');
    let nextReceiptNo = 1;

    try {
        const data = await fs.readFile(filePath, 'utf8').then(data => JSON.parse(data), error => {
            if (error.code !== 'ENOENT') throw error; // Ignore file not found errors
        });
        if (data && data.length) {
            const lastEntry = data[data.length - 1];
            nextReceiptNo = Number(lastEntry.receiptNo) + 1;
        }
    } catch (error) {
        console.error('Failed to read or parse cash-receipts.json:', error);
        res.status(500).send('Server error');
        return;
    }

    res.render('pages/cash-receipts', { nextReceiptNo });
});


app.get('/:page', (req, res) => {
    const { page } = req.params;
    res.render(`pages/${page}`);
});

// create a redirect function after 2 seconds to a url 
let redirect = (url, time) => {
    return `<script>
    setTimeout(function(){
        window.location.href = "${url}";
    }, ${time});
    </script>`;
}

app.get('/edit/:page/:id', async (req, res) => {
    const { page , id } = req.params;
        let data = await fs.readFile(`./db/${page}.json`, 'utf8') || '[]';
        data = JSON.parse(data);

        // find the entry with the specified receiptNo or voucherNo or any unique identifier
        let keys = Object.keys(data[0]);
        let validKey = keys.find(key => uniqueIdentifiers.includes(key));
        console.log("validKEY",validKey)
        let receipt = data.find(entry => entry[validKey] === id);
        
        if (!receipt) {
            res.status(404).send('Receipt not found ' + redirect(`/db/${page}`, 2000));
            return;
        }

        res.render(`pages/edit/${page}`, { receipt });

        return;
});



app.get('/db/:file', async (req, res) => {
    const { file } = req.params;
    // captialize the first letter of every word
    let name = file.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    try {
        let data = await fs.readFile(`./db/${file}.json`, 'utf8') || '[]';
        data = JSON.parse(data);
        res.render(`pages/db/${file}`, { data , file , name });
    } catch (error) {
        console.error(`Failed to read or parse ${file}.json:`, error);
        res.status(500).send('Server error');
    }
});







// Initialize server
const initServer = () => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};


initServer();






// ignore errors
process.env.NODE_ENV==='production';

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});



process.on('uncaughtException', (err) => {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('io')) {
        // Do nothing: Hide this error
        console.log('Suppressed "Cannot find module \'io\'" error'); // Log the suppression
    } else {
        console.error("--------------",err); // Log other errors
    }
});



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
        // console.log('Current Modified Time:', currentModifiedTime);
        // console.log('Last Modified Time:', lastModifiedTime);
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
  
watchFile(); 
  
  
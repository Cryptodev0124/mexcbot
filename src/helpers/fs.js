const fs = require('fs');
const path = require('path');

const storageFile = path.join(__dirname, 'storage.json');

function writeToStorage(key, value) {
    try {
        // Read existing data from storage file
        const data = fs.existsSync(storageFile) ? JSON.parse(fs.readFileSync(storageFile, 'utf8')) : {};
        
        // Update data with new key/value pair
        data[key] = value;
        
        // Write updated data back to storage file
        fs.writeFileSync(storageFile, JSON.stringify(data));
    } catch (error) {
        console.error('Error writing to storage:', error);
    }
}

function readFromStorage(key) {
    try {
        // Read data from storage file
        const data = fs.existsSync(storageFile) ? JSON.parse(fs.readFileSync(storageFile, 'utf8')) : {};
        
        // Return value corresponding to the key
        return data[key];
    } catch (error) {
        console.error('Error reading from storage:', error);
        return null;
    }
}

module.exports = {writeToStorage, readFromStorage}
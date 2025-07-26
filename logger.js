const fsp = require('fs/promises');
const { constants } = require('fs');

var useVerbose = false;
var logfile;

async function log(prefix, input) {
    try {
        await fsp.access(logfile, constants.F_OK);
        await fsp.appendFile(logfile, prefix + " " + new Date().toISOString() + " (" + typeof input + "): " + process(input) + "\n");
    } catch (e) {
        _verbose("Log file error: " + e.message);
        return;
    }
}

function process(input) {
    return input.toString().trim();
}

function print(input) {
    console.log("\x1b[0mLOG " + new Date().toISOString() + " (" + typeof input + "): ", process(input) + "\x1b[0m");
    log("LOG", input);
}

function warn(input) {
    console.log("\x1b[0m\x1b[33mWRN " + new Date().toISOString() + " (" + typeof input + "): ", process(input) + "\x1b[0m");
    log("WRN", input);
}

function verbose(input) {
    log("VBS", input);
    if (useVerbose !== true) return;
    _verbose(input, false);
}

function _verbose(input) {
    console.log("\x1b[0m\x1b[2mVBS " + new Date().toISOString() + " (" + typeof input + "): ", process(input) + "\x1b[0m");
}

function setVerbose(status=true) {
    if (status === true) _verbose("Enabling verbose...");
    useVerbose = status;
}

function setLogFile(path) {
    logfile = path;
}

module.exports = {
    print,
    warn,
    verbose,
    setVerbose,
    setLogFile,
};
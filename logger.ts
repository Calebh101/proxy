import fsp from 'fs/promises';
import { constants } from 'fs';

var useVerbose = false;
var logfile: string;

async function log(prefix: string, input: any) {
    try {
        await fsp.access(logfile, constants.F_OK);
        await fsp.appendFile(logfile, prefix + " " + new Date().toISOString() + " (" + typeof input + "): " + _process(input) + "\n");
    } catch (e) {
        _verbose("Log file error: " + (e as any)?.message);
        return;
    }
}

function _process(input: any) {
    return input.toString().trim();
}

export function print(input: any) {
    console.log("\x1b[0mLOG " + new Date().toISOString() + " (" + typeof input + "): ", _process(input) + "\x1b[0m");
    log("LOG", input);
}

export function warn(input: any) {
    console.log("\x1b[0m\x1b[33mWRN " + new Date().toISOString() + " (" + typeof input + "): ", _process(input) + "\x1b[0m");
    log("WRN", input);
}

export function verbose(input: any) {
    log("VBS", input);
    if (useVerbose !== true) return;
    _verbose(input);
}

function _verbose(input: any) {
    console.log("\x1b[0m\x1b[2mVBS " + new Date().toISOString() + " (" + typeof input + "): ", _process(input) + "\x1b[0m");
}

export function setVerbose(status=true) {
    if (status === true) _verbose("Enabling verbose...");
    useVerbose = status;
}

export function setLogFile(path: any) {
    logfile = path;
}
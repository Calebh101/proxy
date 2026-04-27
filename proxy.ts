import { hideBin } from "yargs/helpers";
import * as a from "./config.js";
import { Config, ConfigData } from "./types";
import yargs from "yargs";
import * as os from 'os';
import * as p from 'path';
import * as fs from 'fs';
import { setLogFile, setVerbose } from "./logger.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = p.dirname(__filename);

if ((a as any).config == undefined) {
    throw new Error("Please define 'config' in config.js.");
}

if (!((a as any).config instanceof Config)) {
    throw new Error("Variable 'config' needs to be of type 'Config', not '" + typeof (a as any).config + "'.");
}

const config: ConfigData = (a as any).config!.data;

const args = yargs(hideBin(process.argv))
    .option('config', {type: 'string', description: "Path to config file. Defaults to root of the script plus config.js.", demandOption: false, default: p.join(__dirname, "config.js"), coerce: (arg: any) => {
        arg = arg.replace("~", os.homedir());
        arg = p.resolve(arg);
        if (!fs.existsSync(arg)) throw new Error("Config file " + arg + " doesn't exist!");
        return arg;
    }})
    .option('logfile', {type: 'string', description: "Path to log file. Defaults to root of the script plus proxy.log.", demandOption: false, default: p.join(__dirname, "proxy.log"), coerce: (arg: any) => {
        arg = arg.replace("~", os.homedir());
        arg = p.resolve(arg);
        if (!fs.existsSync(arg)) fs.writeFileSync(arg, "Log file created!\n");
        setLogFile(arg);
        return arg;
    }})
    .option('verbose', {type: "boolean", description: "Enable verbose logs.", demandOption: false, default: false})
    .version(os.version()).parseSync();

if (args.verbose) {
    setVerbose(true);
}
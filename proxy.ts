import * as a from "./config.js";
import { Config, ConfigData } from "./types";

if ((a as any).config == undefined) {
  throw new Error("Please define 'config' in config.js.");
}

if (!((a as any).config instanceof Config)) {
  throw new Error("Variable 'config' needs to be of type 'Config', not '" + typeof (a as any).config + "'.");
}

const config: ConfigData = (a as any).config!.data;
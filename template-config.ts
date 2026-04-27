import { Config } from "./types";

export const config: Config = new Config({
    ports: [],
    hosts: [
        {
            id: "self",
            address: "127.0.0.1",
        }
    ],
});
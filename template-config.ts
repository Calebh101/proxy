import { Config, create } from "./types";

export const config = create({
    ports: [],
    hosts: {
        "self": {
            address: "127.0.0.1",
        }
    },
});
import { hideBin } from "yargs/helpers";
import * as a from "./config.js";
import { Config, ConfigData, HttpPortConfig, HttpProxyMode, httpProxyModes, PortConfig, ProxyProcessError, ProxySetupError } from "./types";
import yargs from "yargs";
import * as os from 'os';
import * as p from 'path';
import * as fs from 'fs';
import { print, setLogFile, setVerbose, warn } from "./logger.js";
import { fileURLToPath } from "url";
import httpProxy from "http-proxy";
import * as tls from 'tls';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = p.dirname(__filename);

if ((a as any).config == undefined) {
    throw new Error("Please define 'config' in config.js.");
}

if (!((a as any).config instanceof Config)) {
    throw new Error("Variable 'config' needs to be of type 'Config', not '" + typeof (a as any).config + "'.");
}

interface HttpPort {
    index: number;
    hosts?: string[];
    address: string;
    base: string | undefined;
    path: string | undefined;
    port: PortConfig<string>,
    mode: HttpProxyMode,
    secure: boolean;
    websocket: boolean;
}

const config: ConfigData = (a as any).config!.data;
const proxy = httpProxy.createProxyServer({});
const usedHttpPorts: Record<number, HttpPort[]> = {};
const useSecureProxy = false;
const version = "2.0.0A";

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

function getOptions() {
    const data = config.certificates;
    if (data == null) throw new ProxySetupError("Certificates not provided, even though they are needed as per the config.");

    return {
        cert: fs.readFileSync(data.cert),
        key: fs.readFileSync(data.key),
    };
}

async function main() {
    if (config.ports.length < 0) throw new ProxySetupError("No ports defined!");
    const hosts = Object.entries(config.hosts).map(([id, rest]) => ({ id, ...rest }));

    config.ports.forEach((port, i) => {
        const host = hosts.find(x => x.id == port.host)!;
        const mode = {isHttp: httpProxyModes.includes(port.mode as HttpProxyMode), mode: port.mode};

        print("Registering port " + i + ": self:" + port.in + " to " + host.address + ":" + port.out + " as " + mode.mode + " (http: " + mode.isHttp + ")");

        switch (mode.mode) {
            case "wss":
            case "raw-tls":
                tls.createServer(getOptions(), (clientSocket) => {
                    try {
                        const remoteSocket = tls.connect({
                            host: host.address,
                            port: port.out,
                            rejectUnauthorized: false,
                        });

                        clientSocket.pipe(remoteSocket);
                        remoteSocket.pipe(clientSocket);

                        print("TLS: Proxying " + (clientSocket.address() as net.AddressInfo | undefined)?.address + " to " + (remoteSocket.address() as net.AddressInfo | undefined)?.address + ":" + port.out);

                        clientSocket.on('error', (e: any) => warn("Client socket: " + e.message));
                        remoteSocket.on('error', (e: any) => warn("Remote socket: " + e.message));
                    } catch (e) {
                        warn("Raw TLS server: " + e);
                    }
                }).listen(port.in, () => {
                    print("Setup TLS port " + port.in);
                });

                break;
            case "ws":
            case "raw":
                net.createServer((clientSocket) => {
                    try {
                        const remoteSocket = net.connect({
                            host: host.address,
                            port: port.out,
                        });

                        clientSocket.pipe(remoteSocket);
                        remoteSocket.pipe(clientSocket);

                        print("NET: Proxying " + (clientSocket.address() as net.AddressInfo | undefined)?.address + " to " + (remoteSocket.address() as net.AddressInfo | undefined)?.address + ":" + port.out);

                        clientSocket.on('error', (e) => warn("Client socket: " + e.message));
                        remoteSocket.on('error', (e) => warn("Remote socket: " + e.message));
                    } catch (e) {
                        warn("Raw server: " + e);
                    }
                }).listen(port.in, () => {
                    print("Setup raw port " + port.in);
                });

                break;
            case "http":
            case "https":
                usedHttpPorts[port.in] ??= [];

                usedHttpPorts[port.in].push({
                    index: i,
                    hosts: (port as HttpPortConfig<string>).hosts,
                    address: host.address,
                    base: host.base,
                    path: host.path,
                    port: port,
                    mode: mode.mode,
                    secure: port.mode == "wss" || port.mode == "https",
                    websocket: port.mode == "ws" || port.mode == "wss",
                });

                break;
        }
    });

    const portsToUse = Object.keys(usedHttpPorts).map(Number);

    portsToUse.forEach(portin => {
        const items = usedHttpPorts[portin];

        const httpServer = http.createServer((req, res) => {
            try {
                var matched = false;
                print("received http input");

                req.on("error", (e) => {
                    warn("HTTP request error: " + e);
                });

                items.forEach(port => {
                    const data = port.port as HttpPortConfig<string>;
                    print("trying port " + data.in + ":" + data.out);
                    const host = req.headers.host?.split(":")[0] ?? "localhost";

                    if (data.forceHttps ?? false) {
                        const redirect = `https://${host}${data.forceHttpsPort ? `:${data.forceHttpsPort}` : ""}${req.url}`;

                        if (res.headersSent) return;
                        res.writeHead(301, {Location: redirect});
                        res.end();

                        matched = true;
                        return;
                    }

                    if (port.secure) return;
                    print("more http input");
                    const address = getProtocol(false, false) + "://" + port.address;

                    if (port.hosts == undefined || isHostsMatch(host, port.hosts, port.base)) {
                        matched = true;
                        print("yay going with it");
                        proxy.web(req, res, { target: address + ":" + port.port.out, secure: useSecureProxy });
                    }
                });

                if (!matched) {
                    print("Unable to proxy HTTP request: Port not found");
                    req.socket.destroy();
                }
            } catch (e) {
                warn("HTTP server: " + e);
            }
        });

        httpServer.on("upgrade", (req, socket, head) => {
            try {
                var matched = false;

                req.on('error', (e) => {
                    warn("WS request error: " + e);
                });

                items.forEach(port => {
                    if (!port.secure && port.websocket) {
                        const address = getProtocol(false, true) + "://" + port.address;
                        const host = req.headers.host?.split(":")[0] ?? "localhost";

                        if (port.hosts == undefined || isHostsMatch(host, port.hosts, port.base)) {
                            if (port.websocket) {
                                matched = true;
                                proxy.ws(req, socket, head, { target: address, secure: useSecureProxy, changeOrigin: true });
                            }
                        }
                    }
                });

                if (matched == false) {
                    print("Unable to proxy HTTP request: Port not found");
                    socket.destroy();
                }
            } catch (e) {
                warn("HTTP server upgrade: " + e);
            }
        });

        const httpsServer = https.createServer(getOptions(), (req, res) => {
            try {
                var matched = false;

                req.on("error", (e) => {
                    warn("HTTPS request error: " + e);
                });

                items.forEach(port => {
                    if (!port.secure) return;
                    const data = port.port as HttpPortConfig<string>;
                    const useHttpForBackend = data.useHttpForBackend ?? false;
                    const address = getProtocol(!useHttpForBackend, false) + "://" + port.address;
                    const host = req.headers.host?.split(":")[0] ?? "localhost";

                    if (port.hosts == undefined || isHostsMatch(host, port.hosts, port.base)) {
                        matched = true;
                        proxy.web(req, res, { target: address + ":" + port.port.out + (port.path || ""), changeOrigin: true, secure: useSecureProxy && !useHttpForBackend });
                    }
                });

                if (matched == false) {
                    print("Unable to proxy HTTPS request: Port not found");
                    req.socket.destroy();
                }
            } catch (e) {
                warn("HTTPS server: " + e);
            }
        });

        httpsServer.on("upgrade", (req, socket, head) => {
            try {
                var matched = false;

                req.on("error", (e) => {
                    warn("HTTPS request error: " + e);
                });

                items.forEach(port => {
                    if (!port.secure || !port.websocket) return;
                    const address = getProtocol(true, true) + "://" + port.address;
                    const host = req.headers.host?.split(":")[0] ?? "localhost";

                    if (port.hosts == undefined || isHostsMatch(host, port.hosts, port.base)) {
                        matched = true;
                        proxy.ws(req, socket, head, { target: address, secure: useSecureProxy, changeOrigin: true });
                    }
                });

                if (matched == false) {
                    print("Unable to proxy Secure WebSocket request: Port not found");
                    socket.destroy();
                }
            } catch (e) {
                warn("HTTPS server upgrade: " + e);
            }
        });

        httpsServer.on('tlsClientError', (e) => {
            warn("HTTPS client error: " + e.message);
        });

        httpServer.on('error', (e) => {
            warn("HTTP server error: " + e.message);
        });

        httpsServer.on('error', (e) => {
            warn("HTTPS server error: " + e.message);
        });

        const multiplexer = net.createServer((socket) => {
            print("smth from " + (socket.address() as Record<string, string> | undefined)?.address);

            socket.once('readable', () => {
                try {
                    const buf = socket.read(1);

                    if (!buf) {
                        socket.destroy();
                        return;
                    }

                    const isTLS = buf[0] === 0x16;
                    const target = isTLS ? httpsServer : httpServer;
                    print("target from " + typeof target);

                    socket.unshift(buf);
                    target.emit('connection', socket);
                } catch (e) {
                    warn("Multiplexer: " + e);
                }
            });
        });

        multiplexer.listen(portin, () => {
            print("Setup HTTP port " + portin);
        });
    });
}

function isHostsMatch(host: string, hosts: string[], base: string | undefined) {
    function generateRegex(host: string) {
        if (host.includes("@")) {
            if (base == undefined) throw new ProxyProcessError("Proxy port required 'base' property for host, but none was provided!");
            host = host.replaceAll("@", base);
        }

        return RegExp("^" + host.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll("*", "[A-Za-z0-9!@_+:`~-]+") + "$");
    }

    for (const h of hosts) {
        const r = generateRegex(h);
        const match = r.test(host);
        if (match) return true;
    }

    return false;
}

function getProtocol(secure: boolean, websocket: boolean) {
    if (websocket) return secure ? "wss" : "ws";
    return secure ? "https" : "http";
}

main();
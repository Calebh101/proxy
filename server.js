const { print, warn, verbose, setVerbose, setLogFile } = require('./logger');
const p = require("path");
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const os = require('os');
const { ProxySetupError } = require('./classes');

const proxy = httpProxy.createProxyServer({});
const usedHttpPorts = {};
const useSecureProxy = false;
const version = "0.0.0A";

const args = yargs(hideBin(process.argv))
    .option('config', {type: 'string', description: "Path to config file. Defaults to root of the script plus config.json.", demandOption: false, default: p.join(__dirname, "config.json"), coerce: (arg) => {
        arg = arg.replace("~", os.homedir());
        arg = p.resolve(arg);
        if (!fs.existsSync(arg)) throw new Error("Config file " + arg + " doesn't exist!");
        return arg;
    }})
    .option('logfile', {type: 'string', description: "Path to log file. Defaults to root of the script plus proxy.log.", demandOption: false, default: p.join(__dirname, "proxy.log"), coerce: (arg) => {
        arg = arg.replace("~", os.homedir());
        arg = p.resolve(arg);
        if (!fs.existsSync(arg)) fs.writeFileSync(arg, "Log file created!\n");
        setLogFile(arg);
        return arg;
    }})
    .option('verbose', {type: "boolean", description: "Enable verbose logs.", demandOption: false, default: false})
    .version(version).argv;

if (args.verbose) {
    setVerbose(true);
}

function getConfig() {
    const path = fs.readFileSync(args.config);
    return JSON.parse(path, 'utf8');
}

function getOptions() {
    const config = getConfig();
    if (config == null) return null;
    const data = config.certificates;
    if (data == null) throw new ProxySetupError("Certificates not provided");

    return {
        cert: fs.readFileSync(data.cert),
        key: fs.readFileSync(data.key),
    };
}

(async () => {
    print("Starting proxy server version " + version);
    verbose("Found config path: " + args.config);
    const data = getConfig();

    if (data == null) return;
    if (data.ports == null) throw new ProxySetupError("Config [ports] field is empty!");

    data.ports.forEach(function(port, i) {
        const hostTarget = port.host ?? "main";
        const to = data.hosts.find(x => x.id == hostTarget);
        const address = to?.address;
        const mode = port.mode;
        if (port.in == null) throw new ProxySetupError("Port [in] field is empty!");
        if (port.out == null) throw new ProxySetupError("Port [out] field is empty!");
        if (mode == null) throw new ProxySetupError("Port [mode] field is empty!");
        if (to == null) throw new ProxySetupError("Could not find host " + hostTarget + "!");
        if (address == null) throw new ProxySetupError("Host [address] field is empty!");
        print("Registering port " + i + ": self:" + port.in + " to " + to.address + ":" + port.out + " as " + mode);

        switch (mode) {
            case "wss":
            case "raw-tls":
                tls.createServer(getOptions(), (clientSocket) => {
                    logProxyRaw(mode, port, i, address);

                    const remoteSocket = tls.connect({
                        host: address,
                        port: port.out,
                        rejectUnauthorized: false,
                    });

                    clientSocket.pipe(remoteSocket);
                    remoteSocket.pipe(clientSocket);

                    clientSocket.on('error', (e) => warn("Client socket: " + e.message));
                    remoteSocket.on('error', (e) => warn("Remote socket: " + e.message));
                }).listen(port.in, () => {
                    print("Setup TLS port " + port.in);
                });
                break;
            case "ws":
            case "raw":
                net.createServer((clientSocket) => {
                    const remoteSocket = net.connect({
                        host: address,
                        port: port.out,
                    });

                    clientSocket.pipe(remoteSocket);
                    remoteSocket.pipe(clientSocket);

                    clientSocket.on('error', (e) => warn("Client socket: " + e.message));
                    remoteSocket.on('error', (e) => warn("Remote socket: " + e.message));
                }).listen(port.in, () => {
                    print("Setup raw port " + port.in);
                });
                break;
            case "https":
            case "http":
                usedHttpPorts[port.in] ??= [];
                usedHttpPorts[port.in].push({
                    "index": i,
                    "subdomains": port.subdomain,
                    "address": address,
                    "port": port,
                    "mode": mode,
                    "secure": mode == "wss" || mode == "https",
                    "websocket": mode == "ws" || mode == "wss",
                });
                break;
            default:
                throw new ProxySetupError("Invalid port mode: " + port.mode);
        }
    });

    const portsToUse = Object.keys(usedHttpPorts);
    verbose("Setting up " + portsToUse.length + " ports");

    portsToUse.forEach(key => {
        const items = usedHttpPorts[key];
        const portin = key;

        const httpServer = http.createServer((req, res) => {
            const subdomains = getSubdomains(req);
            var matched = false;

            req.on('error', (e) => {
                warn("HTTP request error: " + e);
            });

            items.forEach(port => {
                if (port.secure == true) return;
                const address = getProtocol(false, false) + "://" + port.address;

                if (port.subdomains == null || arraysEqual(port.subdomains, subdomains)) {
                    matched = true;
                    logProxy("web", port, address);
                    proxy.web(req, res, { target: address, secure: useSecureProxy });
                }
            });

            if (matched == false) {
                print("Unable to proxy HTTP request: Port not found");
                req.socket.destroy();
            }
        });

        httpServer.on('upgrade', (req, socket, head) => {
            verbose("Found HTTP upgrade");
            const subdomains = getWsSubdomains(req);
            var matched = false;

            req.on('error', (e) => {
                warn("WS request error: " + e);
            });

            items.forEach(port => {
                if (port.secure === true) return;
                const address = getProtocol(false, true) + "://" + port.address;

                if (port.subdomains == null || arraysEqual(port.subdomains, subdomains)) {
                    if (port.websocket) {
                        matched = true;
                        logProxy("ws", port, address);
                        proxy.ws(req, socket, head, { target: address, secure: useSecureProxy, changeOrigin: true });
                    }
                }
            });

            if (matched == false) {
                print("Unable to proxy WebSocket request: Port not found");
                socket.destroy();
            }
        });

        const httpsServer = https.createServer(getOptions(), (req, res) => {
            const subdomains = getSubdomains(req);
            var matched = false;

            req.on('error', (e) => {
                warn("HTTPS request error: " + e);
            });

            items.forEach(port => {
                if (port.secure == false) return;
                const address = getProtocol(true, false) + "://" + port.address;

                if (port.subdomains == null || arraysEqual(port.subdomains, subdomains)) {
                    matched = true;
                    logProxy("web", port, address);
                    proxy.web(req, res, { target: address, changeOrigin: true, secure: useSecureProxy });
                }
            });

            if (matched == false) {
                print("Unable to proxy HTTPS request: Port not found");
                req.socket.destroy();
            }
        });

        httpsServer.on('upgrade', (req, socket, head) => {
            verbose("Found HTTPS upgrade");
            const subdomains = getWsSubdomains(req);
            var matched = false;

            req.on('error', (e) => {
                warn("WSS request error: " + e);
            });

            items.forEach(port => {
                if (port.secure === false) return;
                const address = getProtocol(true, true) + "://" + port.address;

                if (port.subdomains == null || arraysEqual(port.subdomains, subdomains)) {
                    if (port.websocket) {
                        matched = true;
                        logProxy("wss", port, address);
                        proxy.ws(req, socket, head, { target: address, secure: useSecureProxy, changeOrigin: true });
                    }
                }
            });

            if (matched == false) {
                print("Unable to proxy Secure WebSocket request: Port not found");
                socket.destroy();
            }
        });

        httpsServer.on('tlsClientError', (e, socket) => {
            warn("HTTPS client error: " + e.message);
        });

        httpServer.on('error', (e) => {
            warn("HTTP server error: " + e.message);
        });

        httpsServer.on('error', (e) => {
            warn("HTTPS server error: " + e.message);
        });

        httpServer.on('connection', () => {
            verbose("HTTP server: Connection established");
        });

        httpsServer.on('connection', () => {
            verbose("HTTPS server: Connection established");
        });

        const multiplexer = net.createServer((socket) => {
            socket.once('readable', () => {
                const buf = socket.read(1);
                if (!buf) {
                    socket.destroy();
                    return;
                }

                verbose(`Multiplexer first byte: ${buf[0]}`);
                const isTLS = buf[0] === 0x16;
                const target = isTLS ? httpsServer : httpServer;

                socket.unshift(buf);
                target.emit('connection', socket);
            });
        });

        multiplexer.listen(portin, () => {
            print("Setup HTTP port " + portin);
        });
    });
})();

function subdomainString(subdomains) {
    return subdomains.join(".") + ".*";
}

function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
}

function getSubdomains(req) {
    var host = req.headers?.host?.split(":")[0];
    var special = host?.endsWith("localhost") ?? false;
    var out = host?.split('.')?.slice(0, special ? -1 : -2);
    verbose("Found subdomains: " + JSON.stringify(out));
    return out ?? [];
}

function getWsSubdomains(req) {
    return getSubdomains(req);
}

function logProxy(type, port, address) {
    print("Proxying " + type + ":" + port.mode + " " + port.index + ": self:" + port.port.in + " to " + address + ":" + port.port.out);
}

function logProxyRaw(type, port, index, address) {
    print("Proxying " + type + " " + index + ": self:" + port.in + " to " + address + ":" + port.out);
}

function resError(res, code=500) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({"error": "Unable to proxy this request."}));
}

function getProtocol(secure, websocket) {
    return (secure ? (websocket ? "https" : "https") : "http");
}
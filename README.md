# What is this, and why did I make this?

This is a very simple proxy that I made for a home server of mine. However, I decided to make it configurable when I wanted to *not* have to edit the code directly to change things. Over time I made it have more features like also being a reverse proxy and such.

## config.json

```json
{
    "ports": [
        {
            "in": 80,
            "out": 5000,
            "mode": "http", // This can be [http], [https], [ws], [wss], [raw], or [raw-tls].
            "subdomain": ["subdomain"], // Optional subdomain, only for HTTP/S and WebSocket. If you wanted your subdomain to forward only my.subdomain.calebh101.com, this would be ["my", "subdomain"]. This can also be null, which will match any subdomain or root domain. Set it to just [] for root.
            "host": "main", // This is optional and defaults to 'main'
            "useHttpForBackend": true, // This is optional, and converts HTTPS requests to HTTP
            "forceHttps": true, // This is optional, and forces the client to redirect to an HTTPS version of their request
            "forceHttpsPort": 443 // This is optional, and specifies the HTTPS port to redirect to if forceHttps is true. The default is 443
        },
        {
            "in": 443,
            "out": 443,
            "mode": "https",
            "subdomain": ["subdomain"]
        },
        {
            "in": 8080,
            "out": 8080,
            "mode": "raw"
        },
        {
            "in": 8888,
            "out": 8888,
            "mode": "raw-tls" // Same as [raw], but uses a TLS-only server.
        }
    ],
    "hosts": [
        {
            "id": "main", // This is the default. You can specify several hosts.
            "address": "target" // This can be an IP address or anything else.
        },
        {
            "id": "self",
            "address": "127.0.0.1"
        }
    ],
    "certificates": {
        "cert": "cert/cert.pem", // File path of certificate.
        "key": "cert/key.pem" // File path of certificate key.
    }
}
```

# What is this?

This is a cool little tool to proxy connections to your server to another server.

## config.json

```json
{
    "ports": [
        {
            "in": 80,
            "out": 5000,
            "mode": "http", // This can be [http], [https], [ws], [wss], [raw], or [raw-tls].
            "subdomain": ["subdomain"], // Optional subdomain, only for HTTP/S and WebSocket. If you wanted your subdomain to forward only my.subdomain.calebh101.com, this would be ["my", "subdomain"]. This can also be null, which will match any subdomain or root domain. Set it to just [] for root.
            "host": "main" // This is optional and defaults to 'main'
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
# What is this, and why did I make this?

This is a very simple proxy that I made for a home server of mine. However, I decided to make it configurable when I wanted to *not* have to edit the code directly to change things. Over time I made it have more features like also being a reverse proxy and such.

# Usage

Run `proxy.js` with Node.js. Possible arguments:

- `--verbose`: Run in verbose mode. This provides some extra logs.
- `--config [path]`: Run with a specific `config.json` file specified.

# Configuration

A configuration file defaults to `config.json` in the project directory, but can also be specified (see above). A template config can be found at `template-config.json`.

In config.json you'll find `ports`, `hosts`, and `certificates`. `certificates` is only necessary if you use TCP, HTTPS, or some form of secure connection needing certificates.

`hosts` contains possible hosts to proxy to. They each are a JSON object with these properties:

- `id`: The ID that will be referenced by ports using them.
- `address`: The address that will be proxied to. This can be an IP address, or the *base URL* of an actual website. (`like calebh101.github.io`)
- `path`: If you'd like to specify a path for the above address, do it here. This is optional. (E.G. would be `/slope` if you were trying to proxy to `https://calebh101.github.io/slope`)
- `base`: The base domain that ports can use to resolve their targets. This is optional if not using it.

`ports` contains the actual configurable different servers and ports you can proxy. It's another JSON object with these properties:

- `in`: The port that is received from clients. This is a required integer.
- `out`: The port that the data is proxied on to a server. This is a required integer.
- `mode`: The mode that the port runs on. This can be `http`, `https`, `ws`, `wss`, `raw`, or, `raw-tls`. This is a required string.
- `host`: The host ID pointing to a host in the `hosts` section. This is a required string.
- `hosts`: This is an array of strings, and it defaults to covering all incoming requests for that port. These are subdomains. In a subdomain you can also put `@`, which means the `base` property of the specified host, or `*`, which is a wildcard matching **one** piece of the subdomain.
- `forceHttps`: Redirect the client to port 443 of the same host automatically. Defaults to false.
- `useHttpForBackend`: Internally turn HTTPS requests into HTTP requests. Defaults to false.

For the sake of ease of use, the directories `bak` and `configs` are in `.gitignore`.
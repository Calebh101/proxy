class ProxySetupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProxySetupError';
        this.code = 'PROXY_SETUP_ERROR';
        Error.captureStackTrace(this, this.constructor);
    }
}

class ProxyProcessError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProxySetupError';
        this.code = 'PROXY_PROCESS_ERROR';
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    ProxySetupError,
    ProxyProcessError,
};
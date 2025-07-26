class ProxySetupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProxySetupError';
        this.code = 'PROXY_SETUP_ERROR';
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    ProxySetupError,
};
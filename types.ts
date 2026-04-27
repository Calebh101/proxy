export const proxyMOdes = ["ws", "wss", "raw", "raw-tls", "http", "https"] as const;
export type ProxyMode = (typeof proxyMOdes)[number];

export const httpProxyModes = ["http", "https"] as const;
export type HttpProxyMode = (typeof httpProxyModes)[number];

export interface PortConfig<H extends string> {
  /**
   * Incoming client port
   */
  in: number;

  /**
   * Destination/backend port
   */
  out: number;

  /**
   * Proxy mode
   */
  mode: ProxyMode;

  /**
   * References `HostConfig.id`
   */
  host: H;
}

export interface HttpPortConfig<H extends string> extends PortConfig<H> {
  /**
   * Proxy mode (HTTP or HTTPS)
   */
  mode: HttpProxyMode;

  /**
   * Subdomain matching rules.
   * - `@` = host.base
   * - `*` = wildcard for one segment
   *
   * Defaults to all requests if omitted.
   */
  hosts?: string[];

  /**
   * Redirect to HTTPS on port 443
   */
  forceHttps?: boolean;

  /**
   * Downgrade HTTPS backend requests to HTTP internally
   */
  useHttpForBackend?: boolean;
}

export interface HostConfig {
  /**
   * IP address or domain to proxy to
   * Example: "192.168.1.5" or "calebh101.github.io"
   */
  address: string;

  /**
   * Optional path appended to the address
   * Example: "/slope"
   */
  path?: string;

  /**
   * Base domain for subdomain resolution (using `@`)
   * Example: "example.com"
   */
  base?: string;
}

export interface CertificateConfig {
  cert: string;
  key: string;
}

export interface ConfigData<H extends string = string> {
  hosts: Record<H, HostConfig>;
  ports: (PortConfig<H> | HttpPortConfig<H>)[];

  /**
   * Required only for TCP/HTTPS/TLS setups
   */
  certificates?: CertificateConfig[];
}

export class Config<H extends string = string> {
  readonly data: ConfigData<H>;

  private constructor(data: ConfigData<H>) {
    this.data = data;
  }

  static create<H extends string>(data: ConfigData<H>): Config<H> {
    return new Config(data);
  }
}

/**
 * Create a new `Config`. You must name and export the result of this as `config`.
 */
export function create<H extends string>(data: ConfigData<H>): Config<H> {
  return Config.create<H>(data);
}

export class ProxySetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxySetupError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ProxyProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyProcessError';
    Error.captureStackTrace(this, this.constructor);
  }
}
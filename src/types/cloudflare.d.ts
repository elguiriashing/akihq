interface CloudflareEnv {
  AKIHQ_GATEWAY: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
}

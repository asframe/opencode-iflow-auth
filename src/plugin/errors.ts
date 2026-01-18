export class IFlowAuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message)
    this.name = 'IFlowAuthError'
  }
}

export class IFlowTokenRefreshError extends IFlowAuthError {
  constructor(message: string) {
    super(message, 'TOKEN_REFRESH_FAILED')
  }
}

export class IFlowApiKeyInvalidError extends IFlowAuthError {
  constructor(message: string) {
    super(message, 'API_KEY_INVALID')
  }
}

export class IFlowRateLimitError extends IFlowAuthError {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message, 'RATE_LIMIT')
  }
}

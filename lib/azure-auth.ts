interface TokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface CachedToken {
  token: string
  expiresAt: number
}

let tokenCache: CachedToken | null = null

const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000 // 5 minute buffer

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER) {
    return tokenCache.token
  }

  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Azure credentials: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET"
    )
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://ai.azure.com/.default",
  })

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(
        `Token acquisition failed (${response.status}): ${error.substring(0, 200)}`
      )
    }

    const data: TokenResponse = await response.json()

    // Cache token with buffer
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    }

    console.log(`[Auth] Token acquired, expires in ${data.expires_in}s`)
    return data.access_token
  } catch (error) {
    console.error("[Auth] Token acquisition error:", error)
    throw error
  }
}

export function invalidateTokenCache() {
  tokenCache = null
  console.log("[Auth] Token cache invalidated")
}

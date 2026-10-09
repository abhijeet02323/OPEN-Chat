# OPEN-chat Cognito integration bundle

## Contents
- `template.yaml`: SAM template with Cognito WebSocket `$connect` authorizer.
- `functions/auth_authorizer/app.py`: validates Cognito access-token JWTs against the pool JWKS.
- `functions/auth_authorizer/requirements.txt`: PyJWT dependency.
- `functions/connect/app.py`: example `$connect` handler storing verified identity on each connection.
- `frontend/auth-markup.html`: markup to merge into the current `index.html`.
- `frontend/auth.css`: custom auth screen styles.
- `frontend/auth.js`: signup, email confirmation, sign-in, forgot-password request, and sign-out using Cognito APIs.
- `frontend/app.js.cognito.js`: patched copy of the current frontend JS. Review before replacing the original.

## Before deployment
1. Create the Cognito user pool in `ap-south-1`.
2. Create a public app client with **no client secret** and enable `ALLOW_USER_PASSWORD_AUTH` (console wording may be “Sign in with username and password”).
3. Replace `REPLACE_WITH_USER_POOL_ID` and `REPLACE_WITH_PUBLIC_APP_CLIENT_ID` in `frontend/auth.js`.
4. Merge the auth markup into `index.html`, add `<link rel="stylesheet" href="auth.css">`, copy `auth.css` and `auth.js` next to the frontend, and load `auth.js` before the app script. Add the sign-out button inside the chat header.
5. Copy `functions/auth_authorizer/` and `functions/connect/` into the SAM project. If you already have a connect handler, merge the identity fields rather than overwriting project-specific logic.
6. Update `send_message` to query `ConnectionsTable` via `ConnectionIdIndex` using `event.requestContext.connectionId`; use the stored `username` as the sender and ignore any `sender` or `userId` supplied in message JSON. Apply equivalent connection/room membership checks in `get_messages`.
7. Build and deploy the SAM template with your Cognito IDs.

## Deploy
```bash
sam validate --template-file template.yaml
sam build --template-file template.yaml
sam deploy --guided
```
For an existing stack:
```bash
sam deploy --template-file template.yaml \
  --stack-name YOUR_EXISTING_STACK_NAME \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides StageName=prod CognitoUserPoolId=YOUR_POOL_ID CognitoAppClientId=YOUR_APP_CLIENT_ID
```

## Security notes
- The browser WebSocket API cannot set arbitrary Authorization headers, so this prototype passes the access token as a query parameter. Query strings can appear in logs/diagnostics; for production, prefer a short-lived one-time WebSocket ticket exchange.
- This authorizer validates the JWT signature, issuer, token use, and app-client ID. It returns only a generic denial to avoid leaking token-validation details.
- The `$connect` authorizer does not automatically validate the identity on each WebSocket message. The connect handler must store the validated user identity, and message handlers must retrieve it by connection ID. Do not trust a client-provided `sender`.
- Review all SAM changes and test in a non-production stack before replacing your live deployment.

import json
import os
from functools import lru_cache

import jwt
from jwt import PyJWKClient

USER_POOL_ID = os.environ["COGNITO_USER_POOL_ID"]
APP_CLIENT_ID = os.environ["COGNITO_APP_CLIENT_ID"]
REGION = os.environ.get("AWS_REGION", "ap-south-1")
ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"


@lru_cache(maxsize=1)
def jwks_client():
    return PyJWKClient(JWKS_URL, cache_keys=True)


def deny(method_arn):
    return {
        "principalId": "unauthorized",
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
                "Action": "execute-api:Invoke",
                "Effect": "Deny",
                "Resource": method_arn,
            }],
        },
    }


def lambda_handler(event, context):
    method_arn = event.get("methodArn", "*")
    token = (event.get("queryStringParameters") or {}).get("token")

    if not token:
        return deny(method_arn)

    try:
        signing_key = jwks_client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=ISSUER,
            options={"verify_aud": False},
        )

        # Cognito access tokens use client_id and token_use=access.
        if claims.get("token_use") != "access":
            return deny(method_arn)
        if claims.get("client_id") != APP_CLIENT_ID:
            return deny(method_arn)
        if not claims.get("sub"):
            return deny(method_arn)

        subject = claims["sub"]
        email = claims.get("email", "")
        username = claims.get("cognito:username") or claims.get("username") or email or subject

        return {
            "principalId": subject,
            "policyDocument": {
                "Version": "2012-10-17",
                "Statement": [{
                    "Action": "execute-api:Invoke",
                    "Effect": "Allow",
                    "Resource": method_arn,
                }],
            },
            "context": {
                "userId": str(subject),
                "username": str(username)[:100],
                "email": str(email)[:254],
            },
        }
    except Exception:
        # Do not log tokens or return validation details to the client.
        return deny(method_arn)

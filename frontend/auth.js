/*
 * OPEN-chat browser authentication using Amazon Cognito User Pools.
 * Configure USER_POOL_ID and APP_CLIENT_ID below. This public app client
 * must have NO client secret.
 *
 * Tokens are kept in sessionStorage for this browser tab only. Do not store
 * passwords. For higher-security production deployments, consider a BFF or
 * one-time WebSocket ticket exchange to avoid putting tokens in URLs.
 */
(() => {
  const REGION = "ap-south-1";
  const USER_POOL_ID = "ap-south-1_VI4tKQ38I";
  const APP_CLIENT_ID = "7nqse59taedut5rvpje2mqvru6";
  const API = `https://cognito-idp.${REGION}.amazonaws.com/`;
  const STORAGE_KEY = "openchat.cognito.session";

  const $ = (id) => document.getElementById(id);
  const authScreen = $("auth-screen");
  const authMessage = $("auth-message");
  const authForms = document.querySelectorAll("[data-auth-form]");
  let mode = "signin";

  function session() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }
  function saveSession(data) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      accessToken: data.AccessToken,
      idToken: data.IdToken,
      refreshToken: data.RefreshToken,
      expiresAt: Date.now() + (Number(data.ExpiresIn || 3600) * 1000)
    }));
  }
  function clearSession() { sessionStorage.removeItem(STORAGE_KEY); }

  async function cognito(target, payload, includeClientId = true) {
    const requestBody = includeClientId ? { ClientId: APP_CLIENT_ID, ...payload } : payload;
    const response = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`
      },
      body: JSON.stringify(requestBody)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || body.Message || "Authentication failed.");
      error.code = body.__type || body.code || "";
      throw error;
    }
    return body;
  }

  function showMessage(message, isError = false) {
    authMessage.textContent = message || "";
    authMessage.classList.toggle("error", isError);
    authMessage.classList.toggle("success", !isError && Boolean(message));
  }
  function showMode(nextMode) {
    mode = nextMode;
    authForms.forEach(form => {
      form.hidden = form.dataset.authForm !== mode;
    });
    document.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.classList.toggle("active", button.dataset.authMode === mode);
    });
    showMessage("");
  }
  function showApp() {
    authScreen.classList.add("hidden");
    $("join-screen").classList.remove("hidden");
    const s = session();
    const email = s?.email || "";
    const name = email || "User";
    const username = $("username");
    if (username) {
      username.value = name;
      username.readOnly = true;
      username.setAttribute("aria-readonly", "true");
    }
    const accountLabel = $("account-label");
    if (accountLabel) accountLabel.textContent = email || name;
  }
  function showAuth() {
    authScreen.classList.remove("hidden");
    $("join-screen").classList.add("hidden");
    $("chat-screen").classList.add("hidden");
  }

  async function signUp(event) {
    event.preventDefault();
    const email = $("signup-email").value.trim().toLowerCase();
    const password = $("signup-password").value;
    try {
      await cognito("SignUp", {
        Username: email,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }]
      });
      $("confirm-email").value = email;
      showMode("confirm");
      showMessage("Check your email for the verification code.");
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function confirmSignUp(event) {
    event.preventDefault();
    const email = $("confirm-email").value.trim().toLowerCase();
    const code = $("confirm-code").value.trim();
    try {
      await cognito("ConfirmSignUp", { Username: email, ConfirmationCode: code });
      $("signin-email").value = email;
      showMode("signin");
      showMessage("Email verified. Sign in to continue.");
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const email = $("signin-email").value.trim().toLowerCase();
    const password = $("signin-password").value;
    try {
      const result = await cognito("InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: password }
      });
      if (result.ChallengeName) {
        throw new Error(`Cognito requires an additional challenge (${result.ChallengeName}). Configure the app client for the selected sign-in flow.`);
      }
      saveSession(result.AuthenticationResult);
      const current = session();
      current.email = email;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      showMessage("");
      showApp();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function forgotPassword(event) {
    event.preventDefault();
    const email = $("signin-email").value.trim().toLowerCase();
    if (!email) {
      showMessage("Enter your email address first.", true);
      return;
    }
    try {
      await cognito("ForgotPassword", { Username: email });
      showMessage("If the account exists, a password-reset code will be sent to its verified email.");
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function logout() {
    const s = session();
    try {
      if (s?.accessToken) {
        await cognito("GlobalSignOut", { AccessToken: s.accessToken }, false);
      }
    } catch (error) {
      // Clear local session even if remote sign-out cannot be reached.
      console.warn("Cognito sign-out request failed.");
    } finally {
      clearSession();
      if (window.OPENCHAT_CLOSE_SOCKET) window.OPENCHAT_CLOSE_SOCKET();
      showAuth();
      showMode("signin");
    }
  }

  $("signup-form").addEventListener("submit", signUp);
  $("confirm-form").addEventListener("submit", confirmSignUp);
  $("signin-form").addEventListener("submit", signIn);
  $("forgot-password").addEventListener("click", forgotPassword);
  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => showMode(button.dataset.authMode));
  });
  $("logout-button")?.addEventListener("click", logout);

  window.OPENCHAT_AUTH = {
    getAccessToken() {
      const s = session();
      if (!s || !s.accessToken || Date.now() >= s.expiresAt) return null;
      return s.accessToken;
    },
    getEmail() { return session()?.email || ""; },
    logout
  };

  // Do not automatically treat an expired access token as authenticated.
  const s = session();
  if (s?.accessToken && Date.now() < s.expiresAt) showApp();
  else { clearSession(); showAuth(); showMode("signin"); }
})();

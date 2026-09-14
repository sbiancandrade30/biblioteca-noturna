import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_EMAILS = ["sbiancandrade@gmail.com"];
const qs = selector => document.querySelector(selector);
const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
let auth, db, unsubscribe = null;

function prettyMonth(value) { const [year, monthNumber] = value.split("-").map(Number); return formatter.format(new Date(year, monthNumber - 1, 1)).replace(/^(.)/, (_, character) => character.toUpperCase()); }
function setMessage(message, error = false) { const output = qs("#adminMessage"); output.textContent = message; output.style.color = error ? "#a13e32" : "#226149"; }
function showAdmin(user) {
  const googleUser = user && !user.isAnonymous;
  const email = String(googleUser?.email || "").trim().toLowerCase();
  const allowed = Boolean(googleUser) && ADMIN_EMAILS.includes(email);
  const identity = qs("#accountIdentity");
  qs("#loginCard").hidden = allowed;
  qs("#adminPanel").hidden = !allowed;
  qs("#switchAccountButton").hidden = !googleUser || allowed;
  identity.hidden = !googleUser || allowed;
  identity.textContent = googleUser ? `Conta conectada: ${email || "e-mail não informado"}` : "";
  if (!allowed && googleUser) qs("#loginMessage").textContent = "Esta conta ainda não está autorizada para a administração.";
  if (!googleUser) qs("#loginMessage").textContent = "";
  if (allowed) subscribeToActivePoll();
}
function subscribeToActivePoll() {
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(doc(db, "settings", "active-poll"), snapshot => {
    const key = snapshot.data()?.key || "2026-09";
    qs("#currentPollTitle").textContent = prettyMonth(key);
    qs("#adminPollMonth").value = key;
    qs("#adminStatus").textContent = `A votação de ${prettyMonth(key)} está disponível para o grupo.`;
  }, () => { qs("#adminStatus").textContent = "Não foi possível carregar a votação ativa."; });
}
async function openGoogleLogin() {
  const message = qs("#loginMessage");
  message.textContent = "Abrindo a escolha de conta Google.";
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    message.textContent = error.code === "auth/popup-blocked"
      ? "O navegador bloqueou a janela de login. Permita pop-ups para este site e tente novamente."
      : "Não foi possível entrar com o Google. Tente novamente.";
  }
}
qs("#googleLoginButton").onclick = openGoogleLogin;
qs("#logoutButton").onclick = async () => { await signOut(auth); };
qs("#switchAccountButton").onclick = async () => {
  await signOut(auth);
  await openGoogleLogin();
};
qs("#activatePollButton").onclick = async () => {
  const key = qs("#adminPollMonth").value;
  if (!key) { setMessage("Escolha um mês antes de continuar.", true); return; }
  qs("#activatePollButton").disabled = true;
  try {
    await setDoc(doc(db, "settings", "active-poll"), { key, updatedAt: serverTimestamp() });
    setMessage(`Votação de ${prettyMonth(key)} ativada com sucesso.`);
  } catch (error) { console.error(error); setMessage("Não foi possível ativar a votação.", true); }
  finally { qs("#activatePollButton").disabled = false; }
};
const config = window.BIBLIOTECA_FIREBASE_CONFIG;
if (!config) qs("#loginMessage").textContent = "A configuração do Firebase não foi encontrada.";
else {
  const app = initializeApp(config);
  auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, showAdmin);
}

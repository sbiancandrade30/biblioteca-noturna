import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_EMAILS = ["sbiancandrade@gmail.com"];
const qs = selector => document.querySelector(selector);
const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
let auth, db, unsubscribe = null;
let loginInProgress = false;
let activePollKey = "", activePollClosed = false;

function prettyMonth(value) { const [year, monthNumber] = value.split("-").map(Number); return formatter.format(new Date(year, monthNumber - 1, 1)).replace(/^(.)/, (_, character) => character.toUpperCase()); }
function prettyDate(value) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`)).replace(/^(.)/, (_, character) => character.toUpperCase()); }
function setMessage(message, error = false) { const output = qs("#adminMessage"); output.textContent = message; output.style.color = error ? "#a13e32" : "#226149"; }
function showAdmin(user) {
  const googleProfile = user?.providerData?.find(profile => profile.providerId === "google.com");
  const googleUser = Boolean(googleProfile);
  const email = String(user?.email || googleProfile?.email || "").trim().toLowerCase();
  const allowed = Boolean(googleUser) && ADMIN_EMAILS.includes(email);
  const identity = qs("#accountIdentity");
  qs("#loginCard").hidden = allowed;
  qs("#adminPanel").hidden = !allowed;
  qs("#switchAccountButton").hidden = !googleUser || allowed;
  identity.hidden = !googleUser || allowed;
  identity.textContent = googleUser ? `Conta conectada: ${email || "e-mail não informado"}` : "";
  if (!allowed && googleUser) qs("#loginMessage").textContent = email
    ? "Esta conta ainda não está autorizada para a administração."
    : "O Google não enviou o e-mail desta conta. Clique em Trocar de conta e escolha seu Gmail novamente.";
  if (!googleUser) qs("#loginMessage").textContent = "";
  if (allowed) {
    const name = String(user?.displayName || googleProfile?.displayName || email.split("@")[0] || "Administradora").trim();
    const photoUrl = String(user?.photoURL || googleProfile?.photoURL || "").trim();
    const avatar = qs("#adminAvatar");
    const initial = qs("#adminInitial");
    qs("#adminAccountName").textContent = name;
    initial.textContent = name.charAt(0).toUpperCase();
    avatar.hidden = !photoUrl;
    initial.hidden = Boolean(photoUrl);
    if (photoUrl) {
      avatar.src = photoUrl;
      avatar.alt = `Foto de ${name}`;
      avatar.onerror = () => { avatar.hidden = true; initial.hidden = false; };
    }
    subscribeToActivePoll();
  }
}
function subscribeToActivePoll() {
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(doc(db, "settings", "active-poll"), snapshot => {
    const poll = snapshot.data() || { key: "2026-09", status: "open", chosenDate: null };
    const key = poll.key || "2026-09";
    activePollKey = key;
    activePollClosed = poll.status === "closed";
    qs("#currentPollTitle").textContent = prettyMonth(key);
    qs("#adminPollMonth").value = key;
    const chosenDate = String(poll.chosenDate || "");
    const [year, month] = key.split("-").map(Number);
    qs("#chosenMeetingDate").min = `${key}-01`;
    qs("#chosenMeetingDate").max = `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    qs("#chosenMeetingDate").value = chosenDate;
    qs("#chosenMeetingDate").disabled = activePollClosed;
    qs("#closePollButton").disabled = activePollClosed;
    qs("#closePollMessage").textContent = activePollClosed && chosenDate
      ? `Encontro definido para ${prettyDate(chosenDate)}.`
      : "";
    qs("#adminStatus").textContent = activePollClosed && chosenDate
      ? `A votação foi encerrada. Encontro confirmado para ${prettyDate(chosenDate)}.`
      : `A votação de ${prettyMonth(key)} está disponível para o grupo.`;
  }, () => { qs("#adminStatus").textContent = "Não foi possível carregar a votação ativa."; });
}
async function openGoogleLogin() {
  if (loginInProgress) return;
  loginInProgress = true;
  const message = qs("#loginMessage");
  const loginButton = qs("#googleLoginButton");
  loginButton.disabled = true;
  loginButton.textContent = "Abrindo o Google...";
  message.textContent = "Aguarde um instante.";
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    const messages = {
      "auth/popup-blocked": "O navegador bloqueou a janela de login. Permita pop-ups para este site e tente novamente.",
      "auth/popup-closed-by-user": "A janela do Google foi fechada antes do fim. Tente novamente.",
      "auth/cancelled-popup-request": "Já havia uma tentativa de login em andamento. Aguarde e tente novamente.",
      "auth/unauthorized-domain": "Este endereço ainda não está autorizado no Firebase."
    };
    message.textContent = messages[error.code] || "Não foi possível entrar com o Google. Tente novamente.";
  } finally {
    loginInProgress = false;
    loginButton.disabled = false;
    loginButton.textContent = "Entrar com Google";
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
  if (key === activePollKey) { setMessage("Escolha um mês diferente para criar uma nova votação.", true); return; }
  qs("#activatePollButton").disabled = true;
  try {
    await setDoc(doc(db, "settings", "active-poll"), { key, status: "open", chosenDate: null, updatedAt: serverTimestamp() });
    setMessage(`Votação de ${prettyMonth(key)} ativada com sucesso.`);
  } catch (error) { console.error(error); setMessage("Não foi possível ativar a votação.", true); }
  finally { qs("#activatePollButton").disabled = false; }
};
qs("#closePollButton").onclick = async () => {
  const chosenDate = qs("#chosenMeetingDate").value;
  if (!chosenDate) { qs("#closePollMessage").textContent = "Escolha a data do encontro antes de encerrar."; return; }
  if (activePollClosed) return;
  qs("#closePollButton").disabled = true;
  try {
    await setDoc(doc(db, "settings", "active-poll"), { key: activePollKey, status: "closed", chosenDate, updatedAt: serverTimestamp() });
  } catch (error) { console.error(error); qs("#closePollMessage").textContent = "Não foi possível encerrar a votação."; qs("#closePollButton").disabled = false; }
};
const config = window.BIBLIOTECA_FIREBASE_CONFIG;
if (!config) qs("#loginMessage").textContent = "A configuração do Firebase não foi encontrada.";
else {
  const app = initializeApp(config);
  auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, showAdmin);
}

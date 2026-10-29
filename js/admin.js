import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ADMIN_EMAILS = ["sbiancandrade@gmail.com"];
const qs = selector => document.querySelector(selector);
const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const shortMonthNames = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
let auth, db, unsubscribe = null, unsubscribeResponses = null, activeResponses = new Map();
let loginInProgress = false;
let activePollKey = "", activePollClosed = false, activePollMaxDates = 3;

function prettyMonth(value) { const [year, monthNumber] = value.split("-").map(Number); return formatter.format(new Date(year, monthNumber - 1, 1)).replace(/^(.)/, (_, character) => character.toUpperCase()); }
function prettyDate(value) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`)).replace(/^(.)/, (_, character) => character.toUpperCase()); }
function shortDate(value) { const [, month, day] = value.split("-").map(Number); return `${day} ${shortMonthNames[month - 1]}`; }
function setMessage(message, error = false) { const output = qs("#adminMessage"); output.textContent = message; output.style.color = error ? "#a13e32" : "#226149"; }
function setResponsesMessage(message, error = false) { const output = qs("#responsesAdminMessage"); output.textContent = message; output.style.color = error ? "#a13e32" : "#226149"; }
function setSettingsMessage(message, error = false) { const output = qs("#pollSettingsMessage"); output.textContent = message; output.style.color = error ? "#a13e32" : "#226149"; }
function normalizedMaxDates(value) { const number = Number(value); return Number.isInteger(number) && number >= 1 && number <= 31 ? number : null; }
function readMaxDatesSetting() {
  if (qs("#unlimitedDates").checked) return null;
  return normalizedMaxDates(qs("#maxDatesPerPerson").value);
}
function updateDateLimitControl() { qs("#maxDatesPerPerson").disabled = qs("#unlimitedDates").checked; }
function setDateLimitControl(value) {
  activePollMaxDates = value;
  qs("#unlimitedDates").checked = value === null;
  qs("#maxDatesPerPerson").value = value === null ? 3 : value;
  updateDateLimitControl();
}
function renderResponseList(snapshot) {
  const responses = snapshot.docs.map(item => ({ name: item.data().name || item.id, dates: item.data().dates || [] })).sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
  activeResponses = new Map(responses.map(response => [response.name, response.dates]));
  qs("#adminResponsesList").innerHTML = responses.length
    ? responses.map(response => `<article class="admin-response-row"><strong>${response.name}</strong><div class="admin-response-dates">${response.dates.map(date => `<button type="button" class="remove-date-button" data-response-name="${response.name}" data-response-date="${date}" aria-label="Remover ${prettyDate(date)} de ${response.name}" title="Remover ${prettyDate(date)}"><span>${shortDate(date)}</span><b aria-hidden="true">×</b></button>`).join("")}</div></article>`).join("")
    : "<p class='field-note'>Ainda não há respostas nesta votação.</p>";
}
function subscribeToPollResponses() {
  if (unsubscribeResponses) unsubscribeResponses();
  qs("#adminResponsesList").innerHTML = "<p class='field-note'>Carregando respostas...</p>";
  unsubscribeResponses = onSnapshot(collection(db, "polls", `encontro-${activePollKey}`, "responses"), renderResponseList, () => {
    qs("#adminResponsesList").innerHTML = "<p class='field-note'>Não foi possível carregar as respostas.</p>";
  });
}
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
    const storedMaxDates = poll.maxDates;
    setDateLimitControl(storedMaxDates === null ? null : normalizedMaxDates(storedMaxDates) || 3);
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
      ? `Encontro confirmado para ${prettyDate(chosenDate)}.`
      : "";
    qs("#adminStatus").textContent = activePollClosed && chosenDate
      ? `A votação foi encerrada. Encontro confirmado para ${prettyDate(chosenDate)}.`
      : `A votação de ${prettyMonth(key)} está disponível para o grupo.`;
    subscribeToPollResponses();
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
qs("#unlimitedDates").onchange = updateDateLimitControl;
qs("#savePollSettingsButton").onclick = async () => {
  const maxDates = readMaxDatesSetting();
  if (maxDates === null && !qs("#unlimitedDates").checked) { setSettingsMessage("Informe um número entre 1 e 31, ou escolha Sem limite.", true); return; }
  qs("#savePollSettingsButton").disabled = true;
  setSettingsMessage("");
  try {
    await setDoc(doc(db, "settings", "active-poll"), { maxDates, updatedAt: serverTimestamp() }, { merge: true });
    setSettingsMessage(maxDates === null ? "Configuração salva: sem limite de datas." : `Configuração salva: até ${maxDates} ${maxDates === 1 ? "data" : "datas"} por pessoa.`);
  } catch (error) {
    console.error(error);
    setSettingsMessage("Não foi possível salvar a configuração.", true);
  } finally { qs("#savePollSettingsButton").disabled = false; }
};
qs("#adminResponsesList").onclick = async event => {
  const button = event.target.closest("[data-response-name][data-response-date]");
  if (!button) return;
  const name = button.dataset.responseName;
  const date = button.dataset.responseDate;
  const dates = activeResponses.get(name) || [];
  if (!dates.includes(date)) return;
  if (!window.confirm(`Remover ${prettyDate(date)} da resposta de ${name}?`)) return;
  button.disabled = true;
  setResponsesMessage("");
  try {
    const remainingDates = dates.filter(value => value !== date);
    if (remainingDates.length) {
      await setDoc(doc(db, "polls", `encontro-${activePollKey}`, "responses", name), { name, dates: remainingDates, updatedAt: serverTimestamp() });
    } else {
      await deleteDoc(doc(db, "polls", `encontro-${activePollKey}`, "responses", name));
    }
    setResponsesMessage(`${prettyDate(date)} foi removido da resposta de ${name}.`);
  } catch (error) {
    console.error(error);
    setResponsesMessage("Não foi possível remover esta data.", true);
    button.disabled = false;
  }
};
qs("#activatePollButton").onclick = async () => {
  const key = qs("#adminPollMonth").value;
  if (!key) { setMessage("Escolha um mês antes de continuar.", true); return; }
  if (key === activePollKey) { setMessage("Escolha um mês diferente para criar uma nova votação.", true); return; }
  const maxDates = readMaxDatesSetting();
  if (maxDates === null && !qs("#unlimitedDates").checked) { setMessage("Informe um número entre 1 e 31, ou escolha Sem limite.", true); return; }
  qs("#activatePollButton").disabled = true;
  try {
    await setDoc(doc(db, "settings", "active-poll"), { key, status: "open", chosenDate: null, maxDates, updatedAt: serverTimestamp() });
    setMessage(`Votação de ${prettyMonth(key)} ativada com sucesso.`);
  } catch (error) { console.error(error); setMessage("Não foi possível ativar a votação.", true); }
  finally { qs("#activatePollButton").disabled = false; }
};
qs("#closePollButton").onclick = async () => {
  const chosenDate = qs("#chosenMeetingDate").value;
  if (!chosenDate) { qs("#closePollMessage").textContent = "Escolha a data definida pelo grupo antes de confirmar."; return; }
  if (activePollClosed) return;
  qs("#closePollButton").disabled = true;
  try {
    await setDoc(doc(db, "settings", "active-poll"), { key: activePollKey, status: "closed", chosenDate, maxDates: activePollMaxDates, updatedAt: serverTimestamp() });
  } catch (error) { console.error(error); qs("#closePollMessage").textContent = "Não foi possível encerrar a votação."; qs("#closePollButton").disabled = false; }
};
const config = window.BIBLIOTECA_FIREBASE_CONFIG;
if (!config) qs("#loginMessage").textContent = "A configuração do Firebase não foi encontrada.";
else {
  const app = initializeApp(config);
  auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, showAdmin);
}

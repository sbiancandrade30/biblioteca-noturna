import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const participants = ["Ana Cristina", "Bianca", "Larissa", "Luana", "Maria Eduarda", "Pricila", "Rhullya", "Tainara"];
const qs = selector => document.querySelector(selector);
const calendar = qs("#calendar");
const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

let remoteResponses = {}, db = null, firebaseReady = false, isSaving = false, unsubscribeResponses = null;
let selectedName = "", draft = [], pollKey = "2026-09", month = new Date(2026, 8, 1);

function key(date) { return date.toISOString().slice(0, 10); }
function pollId() { return `encontro-${pollKey}`; }
function pollDate() { const [year, monthNumber] = pollKey.split("-").map(Number); return new Date(year, monthNumber - 1, 1); }
function initials(name) { return name.split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase(); }
function prettyDate(dateKey) { return dayFormat.format(new Date(`${dateKey}T12:00:00`)).replace(/^(.)/, (_, character) => character.toUpperCase()); }
function prettyMonth(value) { const [year, monthNumber] = value.split("-").map(Number); return formatter.format(new Date(year, monthNumber - 1, 1)).replace(/^(.)/, (_, character) => character.toUpperCase()); }
function allResponses() { return { ...remoteResponses, ...(selectedName && draft.length ? { [selectedName]: draft } : {}) }; }
function isPastPoll() { const today = new Date(); return pollDate() < new Date(today.getFullYear(), today.getMonth(), 1); }

function updateActivePoll() {
  qs("#activePollLabel").textContent = `VOTAÇÃO DE ${prettyMonth(pollKey).toUpperCase()}`;
  month = pollDate();
}
function renderCalendar() {
  qs("#monthTitle").textContent = formatter.format(month);
  calendar.innerHTML = "";
  const first = month.getDay(), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = key(new Date()), locked = isPastPoll();
  for (let index = 0; index < first; index += 1) calendar.insertAdjacentHTML("beforeend", '<span class="empty"></span>');
  for (let day = 1; day <= days; day += 1) {
    const dateKey = key(new Date(month.getFullYear(), month.getMonth(), day, 12));
    const disabled = locked || dateKey < today;
    calendar.insertAdjacentHTML("beforeend", `<button type="button" data-day="${dateKey}" class="${draft.includes(dateKey) ? "selected" : ""} ${dateKey === today ? "today" : ""}" ${disabled ? "disabled" : ""}>${day}</button>`);
  }
}
function renderSummary() {
  const summary = qs("#summary");
  summary.hidden = !draft.length;
  summary.innerHTML = `<h3>Dias selecionados</h3><div class="selected-chips">${draft.slice().sort().map(date => `<span class="selected-chip">${prettyDate(date)}</span>`).join("")}</div>`;
  qs("#saveButton").disabled = isPastPoll() || !selectedName || !draft.length;
  qs("#participantName").disabled = isPastPoll();
}
function tally() {
  const results = {};
  for (const [person, dates] of Object.entries(allResponses())) for (const date of dates) {
    results[date] ??= { date, people: new Set() };
    results[date].people.add(person);
  }
  return Object.values(results).sort((first, second) => first.date.localeCompare(second.date));
}
function avatars(names, responded = names) { return names.map(name => `<button type="button" class="avatar ${responded.includes(name) ? "done" : ""}" data-person-name="${name}" aria-label="Ver nome de ${name}">${initials(name)}</button>`).join(""); }
function renderResults() {
  const data = tally(), best = Math.max(0, ...data.map(item => item.people.size)), bests = data.filter(item => item.people.size === best);
  qs("#bestOption").innerHTML = `<span class="eyebrow">MELHOR OPÇÃO ATÉ AGORA</span>${bests.length ? bests.map(item => `<div class="best-choice"><strong>${prettyDate(item.date)}</strong><span>${item.people.size} participantes podem</span></div>`).join("") : '<div class="best-choice"><span>Aguardando respostas.</span></div>'}`;
  const responded = Object.keys(allResponses()), pending = participants.filter(name => !responded.includes(name));
  qs("#responses").innerHTML = `<span class="eyebrow">QUEM JÁ RESPONDEU</span><h2>${responded.length} de ${participants.length} responderam</h2><div class="avatar-list">${avatars(participants, responded)}</div><p class="pending">Ainda faltam: ${pending.join(", ") || "ninguém"}.</p>`;
  qs("#groupResults").innerHTML = `<span class="eyebrow">DISPONIBILIDADE DO GRUPO</span><h2>Possíveis datas</h2>${data.map(item => `<article class="result-row" data-result-date="${item.date}"><div><strong>${prettyDate(item.date)}</strong><b>${item.people.size} podem</b></div><div class="avatar-list" style="justify-content:flex-start;gap:5px;margin:10px 0 0">${avatars([...item.people])}</div></article>`).join("") || "<p class='field-note'>As respostas aparecerão aqui.</p>"}`;
}
function refresh() { renderCalendar(); renderSummary(); renderResults(); }
function syncName() {
  selectedName = qs("#participantName").value;
  draft = remoteResponses[selectedName] ? [...remoteResponses[selectedName]] : [];
  const notice = qs("#replaceNotice");
  notice.hidden = !selectedName || !remoteResponses[selectedName];
  notice.textContent = remoteResponses[selectedName] ? "Você já respondeu. Se quiser, pode ajustar os dias e salvar novamente." : "";
  refresh();
}
function subscribeToResponses() {
  if (unsubscribeResponses) unsubscribeResponses();
  remoteResponses = {}; selectedName = ""; draft = [];
  qs("#participantName").value = "";
  qs("#saveMessage").textContent = isPastPoll() ? "Esta votação está encerrada e disponível para consulta." : "";
  updateActivePoll();
  unsubscribeResponses = onSnapshot(collection(db, "polls", pollId(), "responses"), snapshot => {
    remoteResponses = Object.fromEntries(snapshot.docs.map(item => [item.data().name, item.data().dates || []]).filter(([name]) => participants.includes(name)));
    if (selectedName && remoteResponses[selectedName] && !isSaving) draft = [...remoteResponses[selectedName]];
    refresh();
  }, error => { console.error(error); qs("#saveMessage").textContent = "A votação online não pôde ser atualizada."; });
  refresh();
}
qs("#participantName").addEventListener("change", syncName);
qs("#previousMonth").onclick = () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); renderCalendar(); };
qs("#nextMonth").onclick = () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); renderCalendar(); };
calendar.addEventListener("click", event => {
  const button = event.target.closest("[data-day]");
  if (!button || isPastPoll()) return;
  const dateKey = button.dataset.day;
  draft = draft.includes(dateKey) ? draft.filter(date => date !== dateKey) : [...draft, dateKey];
  refresh();
});
qs("#saveButton").onclick = async () => {
  if (!firebaseReady || !db) { qs("#saveMessage").textContent = "A votação online ainda não está conectada. Tente novamente em alguns segundos."; return; }
  isSaving = true; qs("#saveButton").disabled = true;
  try {
    await setDoc(doc(db, "polls", pollId(), "responses", selectedName), { name: selectedName, dates: [...draft].sort(), updatedAt: serverTimestamp() });
    qs("#saveMessage").textContent = matchMedia("(max-width: 519px)").matches ? "Resposta registrada. Você pode alterar quando quiser." : "Resposta registrada. Você pode voltar e alterar quando quiser.";
  } catch (error) { console.error(error); qs("#saveMessage").textContent = "Não foi possível registrar sua resposta. Tente novamente."; }
  finally { isSaving = false; refresh(); }
};
qs("#groupResults").addEventListener("click", event => {
  if (event.target.closest("[data-person-name]")) return;
  const row = event.target.closest("[data-result-date]"); if (!row) return;
  const info = tally().find(item => item.date === row.dataset.resultDate);
  qs("#detailsContent").innerHTML = `<h2>${prettyDate(info.date)}</h2><div class="detail-period"><strong>${info.people.size} participantes podem</strong><span>${[...info.people].join(", ")}</span></div>`;
  qs("#detailsDialog").showModal();
});
qs("#closeDialog").onclick = () => qs("#detailsDialog").close();
qs("#detailsDialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
document.addEventListener("click", event => {
  const avatar = event.target.closest("[data-person-name]"), touchDevice = matchMedia("(hover: none), (pointer: coarse)").matches;
  document.querySelectorAll(".avatar.show-tooltip").forEach(item => { if (item !== avatar) item.classList.remove("show-tooltip"); });
  if (avatar && touchDevice) { event.preventDefault(); avatar.classList.toggle("show-tooltip"); }
});
async function initializeFirebase() {
  const config = window.BIBLIOTECA_FIREBASE_CONFIG;
  if (!config) { qs("#saveMessage").textContent = "A configuração da votação online não foi encontrada."; return; }
  try {
    const app = initializeApp(config); db = getFirestore(app); await signInAnonymously(getAuth(app)); firebaseReady = true;
    onSnapshot(doc(db, "settings", "active-poll"), snapshot => {
      const nextPoll = snapshot.data()?.key;
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(nextPoll || "") && nextPoll !== pollKey) pollKey = nextPoll;
      subscribeToResponses();
    }, error => { console.error(error); subscribeToResponses(); });
  } catch (error) { console.error(error); qs("#saveMessage").textContent = "A votação online não pôde ser conectada."; }
}
updateActivePoll(); refresh(); initializeFirebase();

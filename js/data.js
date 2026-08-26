const APP_STORAGE_KEY="biblioteca-noturna-final-v1";
const DEFAULT_APP_DATA={
 settings:{
  expectedParticipants:8,adminPassword:"bibliotecanoturna",themes:["Romance","Fantasia","Suspense"],currentTheme:0,
  identity:{clubEyebrow:"BIBLIOTECA NOTURNA",clubName:"Clube do Livro",quote:"“A leitura é a viagem de quem não pode pegar um trem.”",quoteAuthor:"Francis de Croisset",primaryColor:"#123f34",secondaryColor:"#365f4b",creamColor:"#f7f2e8",logo:"",favicon:""},
  labels:{home:"Início",meeting:"Encontro",choice:"Escolha do livro",shelf:"Estante",participants:"Participantes",history:"Histórico",messages:"Mensagens",more:"Mais"},
  clubMessage:"Que agosto seja cheio de boas leituras e ótimas conversas! Mal podemos esperar pelo nosso encontro."
 },
 currentBook:{title:"A Empregada",author:"Freida McFadden",cover:"assets/covers/a-empregada.png",description:"Todos os dias, Millie limpa a casa dos Winchester. Mas agora ela conhece seus segredos...",purchaseLink:"https://www.amazon.com.br/",pages:"320",genre:"Suspense psicológico",meetingDate:"15 de agosto, sexta-feira",meetingTime:"19h00",meetingPlace:"Café Central"},
 upcomingMeetings:[
  {month:"Agosto",date:"15/08 · 19h00",book:"A Empregada",active:true},
  {month:"Setembro",date:"A definir",book:"Em breve"},
  {month:"Outubro",date:"A definir",book:"Em breve"}
 ],
 availability:{
  month:"2026-08",periods:[{id:"morning",label:"Manhã",hint:"08h às 12h"},{id:"afternoon",label:"Tarde",hint:"13h às 18h"},{id:"evening",label:"Noite",hint:"18h às 23h"}],
  responses:[
   {name:"Juliana",code:"ju",choices:["2026-08-14|afternoon","2026-08-14|evening","2026-08-15|morning","2026-08-15|afternoon","2026-08-16|afternoon","2026-08-16|evening"]},
   {name:"Ana",code:"ana",choices:["2026-08-14|evening","2026-08-15|afternoon","2026-08-16|evening","2026-08-17|evening"]},
   {name:"Beatriz",code:"bia",choices:["2026-08-14|afternoon","2026-08-14|evening","2026-08-15|morning","2026-08-15|afternoon","2026-08-16|afternoon"]},
   {name:"Camila",code:"cam",choices:["2026-08-14|evening","2026-08-15|afternoon","2026-08-16|evening","2026-08-17|afternoon"]},
   {name:"Mariana",code:"mar",choices:["2026-08-14|morning","2026-08-15|morning","2026-08-16|afternoon","2026-08-16|evening"]}
  ]
 },
 participants:[
  {id:"juliana",name:"Juliana",phone:"(35) 99999-1001",birthday:"1996-04-12",instagram:"@juliana",favorite:"Suspense",bio:"Ama suspense, café e encontros longos para conversar sobre finais inesperados.",photo:"assets/avatars/juliana.png"},
  {id:"ana",name:"Ana",phone:"(35) 99999-1002",birthday:"1995-09-03",instagram:"@ana",favorite:"Romance",bio:"Leitora de romances e histórias emocionantes.",photo:"assets/avatars/ana.png"},
  {id:"beatriz",name:"Beatriz",phone:"(35) 99999-1003",birthday:"1997-02-18",instagram:"@beatriz",favorite:"Fantasia",bio:"Apaixonada por fantasia, mundos mágicos e dragões.",photo:"assets/avatars/beatriz.png"},
  {id:"camila",name:"Camila",phone:"(35) 99999-1004",birthday:"1996-11-09",instagram:"@camila",favorite:"Suspense",bio:"Sempre tenta descobrir o culpado antes do final.",photo:"assets/avatars/camila.png"},
  {id:"mariana",name:"Mariana",phone:"(35) 99999-1005",birthday:"1994-06-25",instagram:"@mariana",favorite:"Romance",bio:"Gosta de livros leves e personagens marcantes.",photo:"assets/avatars/mariana.png"},
  {id:"paula",name:"Paula",phone:"(35) 99999-1006",birthday:"1998-08-14",instagram:"@paula",favorite:"Fantasia",bio:"Adora sagas e livros com universos complexos.",photo:"assets/avatars/paula.png"},
  {id:"thais",name:"Thais",phone:"(35) 99999-1007",birthday:"1995-12-02",instagram:"@thais",favorite:"Suspense",bio:"Ama um bom mistério e reviravoltas.",photo:"assets/avatars/thais.png"},
  {id:"bianca",name:"Bianca",phone:"(35) 99999-1008",birthday:"1999-07-20",instagram:"@bianca",favorite:"Romance",bio:"Leitora curiosa, gosta de conversar sobre personagens.",photo:"assets/avatars/bianca.png"}
 ],
 suggestions:[
  {id:"s1",title:"A Hipótese do Amor",author:"Ali Hazelwood",cover:"assets/covers/hipotese-do-amor.png",pages:"400",suggestedBy:"Ana",description:"Uma comédia romântica acadêmica divertida e envolvente.",link:"https://www.amazon.com.br/"},
  {id:"s2",title:"A Paciente Silenciosa",author:"Alex Michaelides",cover:"assets/covers/paciente-silenciosa.png",pages:"336",suggestedBy:"Camila",description:"Um suspense psicológico sobre uma mulher que para de falar após um crime.",link:"https://www.amazon.com.br/"}
 ],
 library:[
  {id:"b1",title:"O Poder do Agora",author:"Eckhart Tolle",cover:"assets/covers/poder-do-agora.png",month:"Maio",rating:"4.7",notes:"Uma conversa profunda e tranquila."},
  {id:"b2",title:"É Assim que Acaba",author:"Colleen Hoover",cover:"assets/covers/e-assim-que-acaba.png",month:"Junho",rating:"4.8",notes:"Gerou uma discussão intensa."},
  {id:"b3",title:"Verity",author:"Colleen Hoover",cover:"assets/covers/verity.png",month:"Julho",rating:"4.9",notes:"O favorito do grupo até agora."}
 ],
 selectedSuggestionId:null,suggestionStage:"open"
};
function deepMerge(base,incoming){if(!incoming||typeof incoming!=="object")return base;for(const k of Object.keys(incoming)){if(incoming[k]&&typeof incoming[k]==="object"&&!Array.isArray(incoming[k])&&base[k])deepMerge(base[k],incoming[k]);else base[k]=incoming[k]}return base}
function loadAppData(){try{const saved=JSON.parse(localStorage.getItem(APP_STORAGE_KEY));return saved?deepMerge(structuredClone(DEFAULT_APP_DATA),saved):structuredClone(DEFAULT_APP_DATA)}catch{return structuredClone(DEFAULT_APP_DATA)}}
function persistAppData(data){localStorage.setItem(APP_STORAGE_KEY,JSON.stringify(data))}

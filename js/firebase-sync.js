(function(){
  const config=window.BIBLIOTECA_FIREBASE_CONFIG;
  if(!config||!window.firebase)return;
  try{
    const app=window.firebase.initializeApp(config);
    const auth=window.firebase.auth(app);
    const db=window.firebase.firestore(app);
    const ref=db.collection("club").doc("main");
    const publicData=data=>{
      const copy=JSON.parse(JSON.stringify(data));
      if(copy.settings)delete copy.settings.adminPassword;
      return copy;
    };
    const mergeRemote=remote=>{
      const api=window.BibliotecaApp;if(!api||!remote)return;
      const current=api.getState(),password=current.data.settings?.adminPassword;
      current.data={...current.data,...remote,settings:{...current.data.settings,...(remote.settings||{}),adminPassword:password}};
      persistAppData(current.data);api.render();
    };
    window.addEventListener("biblioteca:save",event=>{
      const data=event.detail;if(data)ref.set({appData:publicData(data),updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    });
    auth.signInAnonymously().then(()=>ref.get()).then(snapshot=>{
      if(snapshot.exists)mergeRemote(snapshot.data().appData);
      ref.onSnapshot(next=>{if(next.exists&&!next.metadata.hasPendingWrites)mergeRemote(next.data().appData)});
    }).catch(()=>{});
  }catch(e){/* O site continua funcionando localmente se o Firebase estiver indisponível. */}
})();

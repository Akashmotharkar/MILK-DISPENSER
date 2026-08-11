const App = (() => {
  let state = Storage.load();
  let amount = 100;
  let running = false;
  let rawLines = [];
  let logLines = [];

  const $ = id => document.getElementById(id);
  const money = n => `${state.currency}${Number(n||0).toFixed(2)}`;
  const qty = n => `${Number(n||0).toFixed(3)} L`;

  function log(message){
    const line = `${new Date().toLocaleTimeString()}  ${message}`;
    logLines.unshift(line);
    logLines = logLines.slice(0,100);
    $("appLog").textContent = logLines.join("\n");
  }
  function raw(data){
    rawLines.unshift(String(data));
    rawLines = rawLines.slice(0,100);
    $("rawData").textContent = rawLines.join("\n");
  }

  function targetQty(){ return state.rate > 0 ? amount / state.rate : 0; }

  function render(){
    $("rateDisplay").textContent = `${money(state.rate)} / L`;
    $("amountDisplay").textContent = money(amount);
    $("targetQty").textContent = qty(targetQty());
    $("statusTarget").textContent = qty(targetQty());
    $("rateInput").value = state.rate;
    $("timeoutInput").value = state.timeoutSeconds;
    $("operatorInput").value = state.operator || "";
    $("currencyInput").value = state.currency;
    renderPresets();
    renderSummary();
    $("queueCount").textContent = state.transactions.length;
  }

  function renderPresets(){
    $("presetRow").innerHTML = state.presets.map(v =>
      `<button data-preset="${v}">${money(v)}</button>`
    ).join("");
    document.querySelectorAll("[data-preset]").forEach(btn => {
      btn.onclick = () => { amount = Number(btn.dataset.preset); render(); };
    });
  }

  function renderSummary(){
    const tx = state.transactions.filter(t => t.status === "completed");
    const totalQty = tx.reduce((s,t)=>s+Number(t.actualQty||t.targetQty||0),0);
    const totalAmount = tx.reduce((s,t)=>s+Number(t.amount||0),0);
    $("totalQty").textContent = qty(totalQty);
    $("totalAmount").textContent = money(totalAmount);
  }

  function switchScreen(name){
    $("operationScreen").classList.toggle("active",name==="operation");
    $("developerScreen").classList.toggle("active",name==="developer");
  }

  function createTransaction(){
    const now = new Date();
    return {
      transactionId: `TX-${now.toISOString().replace(/\D/g,"").slice(0,14)}-${Math.floor(Math.random()*900+100)}`,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0,10),
      operator: state.operator || "",
      rate: Number(state.rate),
      amount: Number(amount),
      targetQty: Number(targetQty().toFixed(3)),
      actualQty: null,
      status: "pending",
      paymentMode: "cash"
    };
  }

  async function saveTransaction(tx){
    state = Storage.addTransaction(tx);
    render();
    const result = await API.saveTransaction(tx);
    if(result.ok){
      state = Storage.get();
      state.transactions = state.transactions.filter(t => t.transactionId !== tx.transactionId);
      Storage.save(state);
      log(`Transaction synced: ${tx.transactionId}`);
    }else{
      log(`Transaction queued locally: ${tx.transactionId}`);
    }
    render();
  }

  function startDispense(){
    if(running || amount <= 0 || state.rate <= 0) return;
    running = true;
    $("dispenseStatus").classList.remove("hidden");
    $("statusText").textContent = "Scale/valve integration will be connected later.";
    $("liveQty").textContent = "0.000 L";
    $("dispenseBtn").disabled = true;
    log(`Dispense requested: ${money(amount)}, target ${qty(targetQty())}`);
  }

  function stopDispense(){
    if(!running) return;
    running = false;
    $("dispenseBtn").disabled = false;
    $("statusText").textContent = "Stopped by operator.";
    log("Dispense stopped by operator.");
  }

  function openRateModal(){
    $("modalTitle").textContent = "Edit Rate";
    $("modalBody").innerHTML = `
      <div class="modal-body-row">
        <input id="modalRate" type="number" min="0" step="0.01" value="${state.rate}">
        <button id="modalSave" class="primary-btn">Save</button>
      </div>`;
    $("modal").classList.remove("hidden");
    $("modalSave").onclick = () => {
      const v = Number($("modalRate").value);
      if(v > 0){ state=Storage.update({rate:v}); closeModal(); render(); log(`Rate changed to ${money(v)}`); }
    };
  }
  function closeModal(){ $("modal").classList.add("hidden"); }

  function bind(){
    $("openDev").onclick=()=>switchScreen("developer");
    $("backToOperation").onclick=()=>switchScreen("operation");
    $("editRate").onclick=openRateModal;
    $("closeModal").onclick=closeModal;
    $("dispenseBtn").onclick=startDispense;
    $("stopBtn").onclick=stopDispense;

    document.querySelectorAll("#keypad button").forEach(btn => {
      btn.onclick=()=>{
        const k=btn.dataset.key;
        if(k==="clear") amount=0;
        else if(k==="back") amount=Math.floor(amount/10);
        else amount=Number(`${amount===0?"":amount}${k}`);
        render();
      };
    });

    $("saveSettings").onclick=async()=>{
      state=Storage.update({
        rate:Number($("rateInput").value)||state.rate,
        timeoutSeconds:Number($("timeoutInput").value)||state.timeoutSeconds,
        operator:$("operatorInput").value.trim(),
        currency:$("currencyInput").value.trim()||"₹"
      });
      render();
      const result=await API.saveSettings(state);
      $("connectionState").textContent=result.ok ? "Backend: connected" : "Backend: offline/test mode";
      log(result.ok ? "Settings synced" : "Settings saved locally");
    };

    $("syncNow").onclick=async()=>{
      const queue=[...state.transactions];
      for(const tx of queue){
        const result=await API.saveTransaction(tx);
        if(result.ok){
          state.transactions=state.transactions.filter(x=>x.transactionId!==tx.transactionId);
          Storage.save(state);
        }
      }
      render();
      log("Sync attempt completed");
    };

    $("clearLocal").onclick=()=>{
      if(confirm("Clear locally queued transactions? This does not delete Google Sheet data.")){
        state=Storage.clearQueue(); render(); log("Local queue cleared");
      }
    };
  }

  function init(){
    bind();
    render();
    log("UI initialized");
    raw("Waiting for RS485 integration…");
  }
  return {init};
})();

document.addEventListener("DOMContentLoaded", App.init);

const Storage = (() => {
  const KEY = "milk_dispenser_state_v1";
  const defaultState = {
    rate: CONFIG.DEFAULT_RATE,
    timeoutSeconds: CONFIG.DEFAULT_TIMEOUT_SECONDS,
    operator: CONFIG.DEFAULT_OPERATOR,
    currency: "₹",
    presets: CONFIG.DEFAULT_PRESETS,
    transactions: []
  };
  function load(){
    try { return {...defaultState, ...(JSON.parse(localStorage.getItem(KEY)) || {})}; }
    catch(e){ return {...defaultState}; }
  }
  function save(state){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function get(){ return load(); }
  function update(patch){ const s={...load(),...patch}; save(s); return s; }
  function addTransaction(tx){
    const s=load(); s.transactions.push(tx); save(s); return s;
  }
  function clearQueue(){ const s=load(); s.transactions=[]; save(s); return s; }
  return {load,save,get,update,addTransaction,clearQueue};
})();

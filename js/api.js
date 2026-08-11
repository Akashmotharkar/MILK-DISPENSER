const API = (() => {
  async function post(action, payload){
    if(!CONFIG.API_URL || CONFIG.API_URL.includes("PASTE_YOUR")){
      return {ok:false,offline:true,message:"Google Apps Script URL not configured"};
    }
    try{
      const response = await fetch(CONFIG.API_URL, {
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=utf-8"},
        body:JSON.stringify({action,payload})
      });
      return await response.json();
    }catch(error){
      return {ok:false,offline:true,message:error.message};
    }
  }
  async function saveTransaction(tx){ return post("saveTransaction",tx); }
  async function getSummary(date){ return post("getSummary",{date}); }
  async function getSettings(){ return post("getSettings",{}); }
  async function saveSettings(settings){ return post("saveSettings",settings); }
  return {saveTransaction,getSummary,getSettings,saveSettings};
})();

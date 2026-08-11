const CONFIG = {
  SPREADSHEET_ID: "", // Leave blank when script is bound to the target spreadsheet.
  TRANSACTIONS_SHEET: "Transactions",
  SETTINGS_SHEET: "Settings",
  SUMMARY_SHEET: "DailySummary"
};

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ok:true,service:"Milk Dispenser API"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;
    const payload = body.payload || {};
    let result;

    switch(action) {
      case "saveTransaction":
        result = saveTransaction_(payload);
        break;
      case "getSummary":
        result = getSummary_(payload.date);
        break;
      case "getSettings":
        result = getSettings_();
        break;
      case "saveSettings":
        result = saveSettings_(payload);
        break;
      default:
        throw new Error("Unknown action: " + action);
    }

    return json_(result);
  } catch(err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers) sh.appendRow(headers);
  return sh;
}

function saveTransaction_(tx) {
  const headers = [
    "Transaction ID","Timestamp","Date","Operator","Rate/L",
    "Amount","Target Qty (L)","Actual Qty (L)","Status",
    "Payment Mode","Device ID","Notes"
  ];
  const sh = getSheet_(CONFIG.TRANSACTIONS_SHEET, headers);

  const row = [
    tx.transactionId || "",
    tx.timestamp || new Date().toISOString(),
    tx.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    tx.operator || "",
    Number(tx.rate || 0),
    Number(tx.amount || 0),
    Number(tx.targetQty || 0),
    tx.actualQty == null ? "" : Number(tx.actualQty),
    tx.status || "pending",
    tx.paymentMode || "cash",
    tx.deviceId || "",
    tx.notes || ""
  ];

  sh.appendRow(row);
  formatTransactionSheet_(sh);
  return {ok:true,transactionId:tx.transactionId};
}

function getSummary_(date) {
  const sh = getSheet_(CONFIG.TRANSACTIONS_SHEET, null);
  if (sh.getLastRow() < 2) return {ok:true,date:date,totalQty:0,totalAmount:0,count:0};

  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const dateIndex = headers.indexOf("Date");
  const qtyIndex = headers.indexOf("Actual Qty (L)");
  const targetIndex = headers.indexOf("Target Qty (L)");
  const amountIndex = headers.indexOf("Amount");
  const statusIndex = headers.indexOf("Status");

  let totalQty=0,totalAmount=0,count=0;
  values.forEach(r=>{
    if(String(r[dateIndex]) !== String(date)) return;
    if(String(r[statusIndex]).toLowerCase() !== "completed") return;
    totalQty += Number(r[qtyIndex] || r[targetIndex] || 0);
    totalAmount += Number(r[amountIndex] || 0);
    count++;
  });

  return {ok:true,date,totalQty,totalAmount,count};
}

function getSettings_() {
  const sh = getSheet_(CONFIG.SETTINGS_SHEET, ["Key","Value","Updated At"]);
  const out = {};
  if(sh.getLastRow() < 2) return {ok:true,settings:out};
  sh.getRange(2,1,sh.getLastRow()-1,2).getValues().forEach(r=>out[String(r[0])] = r[1]);
  return {ok:true,settings:out};
}

function saveSettings_(settings) {
  const sh = getSheet_(CONFIG.SETTINGS_SHEET, ["Key","Value","Updated At"]);
  const map = {};
  if(sh.getLastRow() >= 2){
    sh.getRange(2,1,sh.getLastRow()-1,2).getValues().forEach((r,i)=>map[String(r[0])] = i+2);
  }
  Object.keys(settings).forEach(key=>{
    const value = typeof settings[key] === "object" ? JSON.stringify(settings[key]) : settings[key];
    if(map[key]) {
      sh.getRange(map[key],2,1,2).setValues([[value,new Date()]]);
    } else {
      sh.appendRow([key,value,new Date()]);
    }
  });
  return {ok:true};
}

function formatTransactionSheet_(sh) {
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight("bold");
  sh.autoResizeColumns(1, sh.getLastColumn());
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

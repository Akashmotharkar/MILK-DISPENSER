const App = (() => {

  let state = Storage.load();
  let amount = 100;
  let running = false;

  let rawLines = [];
  let logLines = [];

  const $ = id => document.getElementById(id);

  const money = n =>
    `₹${Number(n || 0).toFixed(2)}`;

  const qty = n =>
    `${Number(n || 0).toFixed(3)} L`;


  /* =========================================================
     LOGGING
  ========================================================= */

  function log(message) {

    const line =
      `${new Date().toLocaleTimeString()}  ${message}`;

    logLines.unshift(line);

    logLines =
      logLines.slice(0, 100);

    const element = $("appLog");

    if (element) {
      element.textContent =
        logLines.join("\n");
    }
  }


  function raw(data) {

    rawLines.unshift(String(data));

    rawLines =
      rawLines.slice(0, 100);

    const element = $("rawData");

    if (element) {
      element.textContent =
        rawLines.join("\n");
    }
  }


  /* =========================================================
     CALCULATION
  ========================================================= */

  function targetQty() {

    const rate =
      Number(state.rate);

    if (!rate || rate <= 0) {
      return 0;
    }

    return amount / rate;
  }


  /* =========================================================
     RENDER
  ========================================================= */

  function render() {

    const rateDisplay =
      $("rateDisplay");

    const amountDisplay =
      $("amountDisplay");

    const targetQtyDisplay =
      $("targetQty");

    const statusTarget =
      $("statusTarget");

    if (rateDisplay) {
      rateDisplay.textContent =
        `${money(state.rate)}/L`;
    }

    if (amountDisplay) {
      amountDisplay.textContent =
        money(amount);
    }

    if (targetQtyDisplay) {
      targetQtyDisplay.textContent =
        qty(targetQty());
    }

    if (statusTarget) {
      statusTarget.textContent =
        qty(targetQty());
    }


    /* Developer/settings fields */

    const rateInput =
      $("rateInput");
    
    const timeoutInput =
      $("timeoutInput");
    
    
    if (rateInput) {
      rateInput.value =
        state.rate;
    }
    
    if (timeoutInput) {
      timeoutInput.value =
        state.timeoutSeconds;
    }

    renderPresets();

    renderSummary();

    renderRunningState();


    const queueCount =
      $("queueCount");

    if (queueCount) {

      queueCount.textContent =
        Array.isArray(state.transactions)
          ? state.transactions.length
          : 0;
    }
  }


  /* =========================================================
     PRESETS
  ========================================================= */

  function renderPresets() {

    const container =
      $("presetRow");

    if (!container) {
      return;
    }

    const presets =
      Array.isArray(state.presets)
        ? state.presets
        : [20, 50, 100, 200];


    container.innerHTML =
      presets.map(value => `
        <button
          type="button"
          data-preset="${Number(value)}"
        >
          ${money(value)}
        </button>
      `).join("");


    container
      .querySelectorAll("[data-preset]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            amount =
              Number(button.dataset.preset) || 0;

            render();

            log(
              `Preset selected: ${money(amount)}`
            );
          }
        );

      });
  }


  /* =========================================================
     SUMMARY
  ========================================================= */

  function renderSummary() {

    const totalQtyElement =
      $("totalQty");

    const totalAmountElement =
      $("totalAmount");

    if (
      !totalQtyElement ||
      !totalAmountElement
    ) {
      return;
    }


    const transactions =
      Array.isArray(state.transactions)
        ? state.transactions
        : [];


    const completed =
      transactions.filter(
        transaction =>
          transaction.status === "completed"
      );


    const totalQty =
      completed.reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.actualQty ||
            transaction.targetQty ||
            0
          ),
        0
      );


    const totalAmount =
      completed.reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount || 0
          ),
        0
      );


    totalQtyElement.textContent =
      qty(totalQty);

    totalAmountElement.textContent =
      money(totalAmount);
  }


  /* =========================================================
     SCREEN TOGGLE
  ========================================================= */

  function switchScreen(screen) {

    const operationScreen =
      $("operationScreen");

    const developerScreen =
      $("developerScreen");

    if (
      !operationScreen ||
      !developerScreen
    ) {
      return;
    }


    const showDeveloper =
      screen === "developer";


    operationScreen.classList.toggle(
      "active",
      !showDeveloper
    );

    developerScreen.classList.toggle(
      "active",
      showDeveloper
    );


    updateSettingsIcon(
      showDeveloper
    );


    log(
      showDeveloper
        ? "Developer & Settings opened"
        : "Operator mode opened"
    );
  }


  /* =========================================================
     SETTINGS ICON
  ========================================================= */

  function updateSettingsIcon(
    developerMode
  ) {

    const button =
      $("settingsToggle");

    if (!button) {
      return;
    }


    if (developerMode) {

      button.textContent =
        "↩";

      button.setAttribute(
        "aria-label",
        "Return to operator mode"
      );

    } else {

      button.textContent =
        "⚙";

      button.setAttribute(
        "aria-label",
        "Open developer and settings"
      );
    }
  }


  function toggleDeveloperScreen() {

    const developerScreen =
      $("developerScreen");

    if (!developerScreen) {
      return;
    }


    const currentlyDeveloper =
      developerScreen.classList.contains(
        "active"
      );


    switchScreen(
      currentlyDeveloper
        ? "operation"
        : "developer"
    );
  }


  /* =========================================================
     TRANSACTION
  ========================================================= */

  function createTransaction() {

    const now =
      new Date();


    return {

      transactionId:
        `TX-${now.toISOString()
          .replace(/\D/g, "")
          .slice(0, 14)}-${Math.floor(
            Math.random() * 900 + 100
          )}`,

      timestamp:
        now.toISOString(),

      date:
        now.toISOString()
          .slice(0, 10),

      operator:
        state.operator || "",

      rate:
        Number(state.rate),

      amount:
        Number(amount),

      targetQty:
        Number(
          targetQty().toFixed(3)
        ),

      actualQty:
        null,

      status:
        "pending",

      paymentMode:
        "cash"
    };
  }


  async function saveTransaction(tx) {

    state =
      Storage.addTransaction(tx);

    render();


    const result =
      await API.saveTransaction(tx);


    if (result.ok) {

      state =
        Storage.get();


      state.transactions =
        state.transactions.filter(
          transaction =>
            transaction.transactionId !==
            tx.transactionId
        );


      Storage.save(state);


      log(
        `Transaction synced: ${tx.transactionId}`
      );

    } else {

      log(
        `Transaction queued locally: ${tx.transactionId}`
      );
    }


    render();
  }


  /* =========================================================
     DISPENSING
  ========================================================= */

  function renderRunningState() {

    const dispenseButton =
      $("dispenseBtn");

    const stopButton =
      $("stopBtn");

    const statusText =
      $("statusText");


    if (dispenseButton) {

      dispenseButton.disabled =
        running;
    }


    if (stopButton) {

      stopButton.classList.toggle(
        "hidden",
        !running
      );
    }


    if (
      statusText &&
      !running &&
      statusText.dataset.manual !== "true"
    ) {

      statusText.textContent =
        "Ready to dispense";
    }
  }


  function startDispense() {

    if (running) {
      return;
    }


    if (amount <= 0) {

      log(
        "Dispense rejected: amount is zero"
      );

      return;
    }


    if (Number(state.rate) <= 0) {

      log(
        "Dispense rejected: invalid rate"
      );

      return;
    }


    running = true;


    const liveQty =
      $("liveQty");

    const statusText =
      $("statusText");


    if (liveQty) {

      liveQty.textContent =
        "0.000 L";
    }


    if (statusText) {

      statusText.dataset.manual =
        "false";

      statusText.textContent =
        "Dispensing...";
    }


    renderRunningState();


    log(
      `Dispense requested: ${money(amount)}, target ${qty(targetQty())}`
    );


    /*
      Hardware integration will be added later.

      Normal stopping:
        Actual weighing-scale quantity
        reaches the target quantity.

      NOT time based.

      Safety timeout will only protect
      against faults such as:

        - scale communication failure
        - valve stuck open
        - ESP32 communication failure
    */
  }


  function stopDispense() {

    if (!running) {
      return;
    }


    running = false;


    const statusText =
      $("statusText");


    if (statusText) {

      statusText.dataset.manual =
        "true";

      statusText.textContent =
        "Stopped by operator.";
    }


    renderRunningState();


    log(
      "Dispense stopped by operator."
    );
  }


  /* =========================================================
     RATE
     
     IMPORTANT:
     Rate editing is ONLY available inside
     Developer & Settings.
  ========================================================= */

  function saveRateFromSettings() {

    const input =
      $("rateInput");

    if (!input) {
      return;
    }


    const value =
      Number(input.value);


    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {

      log(
        "Invalid rate entered"
      );

      return;
    }


    state =
      Storage.update({
        rate: value
      });


    render();


    log(
      `Rate changed to ${money(value)}`
    );
  }


  /* =========================================================
     KEYPAD
  ========================================================= */

  function handleKeypad(button) {

    const key =
      button.dataset.key;


    if (key === "clear") {

      amount = 0;

    } else if (key === "back") {

      amount =
        Math.floor(
          amount / 10
        );

    } else {

      const nextValue =
        Number(
          `${amount === 0 ? "" : amount}${key}`
        );


      if (
        Number.isFinite(nextValue)
      ) {

        amount =
          nextValue;
      }
    }


    render();


    log(
      `Amount: ${money(amount)}`
    );
  }


  function bindKeypad() {

    const keypad =
      $("keypad");

    if (!keypad) {
      return;
    }


    keypad
      .querySelectorAll(
        "button[data-key]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => handleKeypad(button)
        );

      });
  }


  /* =========================================================
     SETTINGS
  ========================================================= */

  function bindSettings() {

    const saveButton =
      $("saveSettings");


    if (saveButton) {

      saveButton.addEventListener(
        "click",
        saveSettings
      );
    }


    const syncButton =
      $("syncNow");


    if (syncButton) {

      syncButton.addEventListener(
        "click",
        syncTransactions
      );
    }


    const clearButton =
      $("clearLocal");


    if (clearButton) {

      clearButton.addEventListener(
        "click",
        clearLocalQueue
      );
    }
  }


  async function saveSettings() {

    const newRate =
      Number(
        $("rateInput").value
      );


    state =
      Storage.update({
    
        rate:
          newRate > 0
            ? newRate
            : state.rate,
    
        timeoutSeconds:
          Number(
            $("timeoutInput").value
          ) ||
          state.timeoutSeconds
      });

    render();


    const result =
      await API.saveSettings(
        state
      );


    const connection =
      $("connectionState");


    if (connection) {

      connection.textContent =
        result.ok
          ? "Backend: connected"
          : "Backend: offline/test mode";
    }


    log(
      result.ok
        ? "Settings synced"
        : "Settings saved locally"
    );
  }


  async function syncTransactions() {

    const queue =
      Array.isArray(
        state.transactions
      )
        ? [...state.transactions]
        : [];


    for (const tx of queue) {

      const result =
        await API.saveTransaction(tx);


      if (result.ok) {

        state.transactions =
          state.transactions.filter(
            item =>
              item.transactionId !==
              tx.transactionId
          );

        Storage.save(state);
      }
    }


    render();


    log(
      "Sync attempt completed"
    );
  }


  function clearLocalQueue() {

    if (
      !confirm(
        "Clear locally queued transactions? This does not delete Google Sheet data."
      )
    ) {
      return;
    }


    state =
      Storage.clearQueue();


    render();


    log(
      "Local queue cleared"
    );
  }


  /* =========================================================
     EVENT BINDING
  ========================================================= */

  function bind() {

    /*
      ONE button does both jobs:

      Operator → Developer
      Developer → Operator
    */

    const settingsToggle =
      $("settingsToggle");


    if (settingsToggle) {

      settingsToggle.addEventListener(
        "click",
        toggleDeveloperScreen
      );
    }


    /*
      Old Operation button is still present
      in the current HTML.

      Keep it working for now, although we
      can remove it from HTML later.
    */


    const dispenseButton =
      $("dispenseBtn");


    if (dispenseButton) {

      dispenseButton.addEventListener(
        "click",
        startDispense
      );
    }


    const stopButton =
      $("stopBtn");


    if (stopButton) {

      stopButton.addEventListener(
        "click",
        stopDispense
      );
    }


    bindKeypad();

    bindSettings();
  }


  /* =========================================================
     INITIALIZATION
  ========================================================= */

  function init() {

    try {

      bind();

      /*
        Always start in Operator mode.
      */

      switchScreen(
        "operation"
      );


      render();


      log(
        "UI initialized"
      );


      raw(
        "Waiting for RS485 integration…"
      );

    } catch (error) {

      console.error(
        "Application initialization failed:",
        error
      );

      log(
        `Initialization error: ${error.message}`
      );
    }
  }


  return {
    init
  };

})();


document.addEventListener(
  "DOMContentLoaded",
  App.init
);

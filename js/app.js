const App = (() => {

  let state = Storage.load();
  let amount = 100;
  let running = false;

  let rawLines = [];
  let logLines = [];

  const $ = id => document.getElementById(id);

  const money = n =>
    `${state.currency || "₹"}${Number(n || 0).toFixed(2)}`;

  const qty = n =>
    `${Number(n || 0).toFixed(3)} L`;

  /* ---------------------------------------------------------
     LOGGING
  --------------------------------------------------------- */

  function log(message) {
    const line =
      `${new Date().toLocaleTimeString()}  ${message}`;

    logLines.unshift(line);
    logLines = logLines.slice(0, 100);

    const el = $("appLog");
    if (el) {
      el.textContent = logLines.join("\n");
    }
  }

  function raw(data) {
    rawLines.unshift(String(data));
    rawLines = rawLines.slice(0, 100);

    const el = $("rawData");
    if (el) {
      el.textContent = rawLines.join("\n");
    }
  }

  /* ---------------------------------------------------------
     CALCULATIONS
  --------------------------------------------------------- */

  function targetQty() {
    if (Number(state.rate) <= 0) {
      return 0;
    }

    return amount / Number(state.rate);
  }

  /* ---------------------------------------------------------
     RENDER
  --------------------------------------------------------- */

  function render() {

    const rateDisplay = $("rateDisplay");
    const amountDisplay = $("amountDisplay");
    const targetQtyDisplay = $("targetQty");
    const statusTarget = $("statusTarget");

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

    const rateInput = $("rateInput");
    const timeoutInput = $("timeoutInput");
    const operatorInput = $("operatorInput");
    const currencyInput = $("currencyInput");

    if (rateInput) {
      rateInput.value = state.rate;
    }

    if (timeoutInput) {
      timeoutInput.value = state.timeoutSeconds;
    }

    if (operatorInput) {
      operatorInput.value = state.operator || "";
    }

    if (currencyInput) {
      currencyInput.value = state.currency || "₹";
    }

    renderPresets();
    renderSummary();
    renderRunningState();

    const queueCount = $("queueCount");

    if (queueCount) {
      queueCount.textContent =
        Array.isArray(state.transactions)
          ? state.transactions.length
          : 0;
    }
  }

  /* ---------------------------------------------------------
     PRESETS
  --------------------------------------------------------- */

  function renderPresets() {

    const container = $("presetRow");

    if (!container) {
      return;
    }

    const presets =
      Array.isArray(state.presets)
        ? state.presets
        : [20, 50, 100, 200];

    container.innerHTML = presets.map(value => `
      <button
        type="button"
        class="preset-btn"
        data-preset="${Number(value)}"
      >
        ${money(value)}
      </button>
    `).join("");

    container
      .querySelectorAll("[data-preset]")
      .forEach(button => {

        button.addEventListener("click", () => {

          amount =
            Number(button.dataset.preset) || 0;

          render();

          log(
            `Preset selected: ${money(amount)}`
          );
        });

      });
  }

  /* ---------------------------------------------------------
     SUMMARY
  --------------------------------------------------------- */

  function renderSummary() {

    const totalQtyElement = $("totalQty");
    const totalAmountElement = $("totalAmount");

    if (!totalQtyElement || !totalAmountElement) {
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
          Number(transaction.amount || 0),
        0
      );

    totalQtyElement.textContent =
      qty(totalQty);

    totalAmountElement.textContent =
      money(totalAmount);
  }

  /* ---------------------------------------------------------
     SCREEN NAVIGATION
  --------------------------------------------------------- */

  function switchScreen(name) {

    const operationScreen =
      $("operationScreen");

    const developerScreen =
      $("developerScreen");

    if (!operationScreen || !developerScreen) {
      return;
    }

    operationScreen.classList.toggle(
      "active",
      name === "operation"
    );

    developerScreen.classList.toggle(
      "active",
      name === "developer"
    );

    log(
      name === "operation"
        ? "Operation screen opened"
        : "Developer & Settings opened"
    );
  }

  /* ---------------------------------------------------------
     DEVELOPER BUTTON
     
     Your current index.html does not contain openDev.
     Therefore create it automatically if it doesn't exist.
  --------------------------------------------------------- */

  function ensureDeveloperButton() {

    if ($("openDev")) {
      return;
    }

    const rateInline =
      document.querySelector(".rate-inline");

    if (!rateInline) {
      return;
    }

    const button =
      document.createElement("button");

    button.id = "openDev";
    button.type = "button";
    button.className = "text-btn";
    button.textContent = "⚙";

    button.setAttribute(
      "aria-label",
      "Developer and settings"
    );

    rateInline.appendChild(button);

    button.addEventListener(
      "click",
      () => switchScreen("developer")
    );
  }

  /* ---------------------------------------------------------
     TRANSACTION
  --------------------------------------------------------- */

  function createTransaction() {

    const now = new Date();

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
        now.toISOString().slice(0, 10),

      operator:
        state.operator || "",

      rate:
        Number(state.rate),

      amount:
        Number(amount),

      targetQty:
        Number(targetQty().toFixed(3)),

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

  /* ---------------------------------------------------------
     DISPENSING STATE
  --------------------------------------------------------- */

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

    if (statusText && !running) {

      /*
       Don't overwrite the status after the
       operator has stopped dispensing.
      */

      if (
        statusText.dataset.manual !== "true"
      ) {
        statusText.textContent =
          "Ready to dispense";
      }
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
        "Dispense rejected: invalid milk rate"
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
      IMPORTANT:

      No time-based dispensing is performed here.

      Later this function will command the ESP32
      to open the solenoid valve.

      The weighing scale will provide actual quantity.

      Safety timeout will only act as a protection
      against the valve remaining open indefinitely.
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

    /*
      Later:

      ESP32 valve OFF command will go here.
    */
  }

  /* ---------------------------------------------------------
     RATE MODAL
  --------------------------------------------------------- */

  function openRateModal() {

    const modal =
      $("modal");

    const modalTitle =
      $("modalTitle");

    const modalBody =
      $("modalBody");

    if (!modal || !modalTitle || !modalBody) {
      return;
    }

    modalTitle.textContent =
      "Edit Rate";

    modalBody.innerHTML = `
      <div class="modal-body-row">

        <input
          id="modalRate"
          type="number"
          min="0"
          step="0.01"
          value="${Number(state.rate)}"
        >

        <button
          id="modalSave"
          type="button"
          class="primary-btn"
        >
          Save
        </button>

      </div>
    `;

    modal.classList.remove("hidden");

    const saveButton =
      $("modalSave");

    if (saveButton) {

      saveButton.addEventListener(
        "click",
        saveRateFromModal
      );
    }
  }

  function saveRateFromModal() {

    const input =
      $("modalRate");

    if (!input) {
      return;
    }

    const value =
      Number(input.value);

    if (!Number.isFinite(value) || value <= 0) {

      log(
        "Invalid rate entered"
      );

      return;
    }

    state =
      Storage.update({
        rate: value
      });

    closeModal();

    render();

    log(
      `Rate changed to ${money(value)}`
    );
  }

  function closeModal() {

    const modal =
      $("modal");

    if (modal) {
      modal.classList.add("hidden");
    }
  }

  /* ---------------------------------------------------------
     KEYPAD
  --------------------------------------------------------- */

  function handleKeypad(button) {

    const key =
      button.dataset.key;

    if (key === "clear") {

      amount = 0;

    } else if (key === "back") {

      amount =
        Math.floor(amount / 10);

    } else {

      /*
        Prevent accidental huge values.
        Amount is still integer because this
        dispenser accepts rupee amounts.
      */

      const nextValue =
        Number(
          `${amount === 0 ? "" : amount}${key}`
        );

      if (Number.isFinite(nextValue)) {
        amount = nextValue;
      }
    }

    render();

    log(
      `Amount entered: ${money(amount)}`
    );
  }

  function bindKeypad() {

    const keypad =
      $("keypad");

    if (!keypad) {
      return;
    }

    keypad
      .querySelectorAll("button[data-key]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => handleKeypad(button)
        );

      });
  }

  /* ---------------------------------------------------------
     SETTINGS
  --------------------------------------------------------- */

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

    state =
      Storage.update({

        rate:
          Number($("rateInput").value) ||
          state.rate,

        timeoutSeconds:
          Number($("timeoutInput").value) ||
          state.timeoutSeconds,

        operator:
          $("operatorInput").value.trim(),

        currency:
          $("currencyInput").value.trim() ||
          "₹"
      });

    render();

    const result =
      await API.saveSettings(state);

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
      Array.isArray(state.transactions)
        ? [...state.transactions]
        : [];

    for (const tx of queue) {

      const result =
        await API.saveTransaction(tx);

      if (result.ok) {

        state.transactions =
          state.transactions.filter(
            x =>
              x.transactionId !==
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

  /* ---------------------------------------------------------
     EVENT BINDING
  --------------------------------------------------------- */

  function bind() {

    ensureDeveloperButton();

    const openDev =
      $("openDev");

    if (openDev) {

      openDev.addEventListener(
        "click",
        () => switchScreen("developer")
      );
    }

    const backToOperation =
      $("backToOperation");

    if (backToOperation) {

      backToOperation.addEventListener(
        "click",
        () => switchScreen("operation")
      );
    }

    const editRate =
      $("editRate");

    if (editRate) {

      editRate.addEventListener(
        "click",
        openRateModal
      );
    }

    const closeModalButton =
      $("closeModal");

    if (closeModalButton) {

      closeModalButton.addEventListener(
        "click",
        closeModal
      );
    }

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

  /* ---------------------------------------------------------
     INITIALIZATION
  --------------------------------------------------------- */

  function init() {

    try {

      bind();

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

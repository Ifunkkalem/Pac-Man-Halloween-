// app.js
// Requires ethers v5 UMD loaded in index.html

let provider, signer, userAddress;
let gameContract;    // contract instance with signer
let readContract;    // contract instance read-only
let startFeeWei;     // BigNumber

async function connectWallet() {
  if (!window.ethereum) {
    alert("Wallet tidak ditemukan. Gunakan MetaMask atau wallet EVM.");
    return;
  }
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    // UI update
    document.getElementById("walletDisplay").innerText = userAddress;
    const balWei = await provider.getBalance(userAddress);
    document.getElementById("walletBalance").innerText = ethers.utils.formatEther(balWei) + " SOMI";

    // instantiate contract (read-only and signer)
    readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // read startFeeWei from contract (if available)
    try {
      startFeeWei = await readContract.startFeeWei();
    } catch (e) {
      console.warn("startFeeWei read failed, fallback to 0.01 SOMI");
      startFeeWei = ethers.utils.parseEther("0.01");
    }

    alert("Wallet connected ✅");
  } catch (err) {
    console.error(err);
    alert("Gagal connect wallet: " + (err.message || err));
  }
}

async function payToPlay() {
  if (!gameContract || !signer) {
    alert("Connect wallet dulu.");
    return;
  }
  try {
    // refresh balance
    const balWei = await provider.getBalance(userAddress);
    if (balWei.lt(startFeeWei)) {
      alert("Saldo SOMI tidak cukup untuk membayar fee.");
      return;
    }

    // send tx calling startGame with native value
    const tx = await gameContract.startGame({ value: startFeeWei });
    alert("Tunggu konfirmasi transaksi...\nHash: " + tx.hash);
    await tx.wait();
    alert("Payment sukses — game dapat dimulai.");
    // notify iframe
    const iframe = document.getElementById("gameFrame");
    iframe.contentWindow.postMessage({ type: "paySuccess" }, "*");

    // show game iframe
    iframe.style.display = "block";
    document.getElementById("leaderboardFrame").style.display = "none";
  } catch (err) {
    console.error(err);
    if (err.code === 4001) alert("Transaksi dibatalkan user.");
    else alert("Payment gagal: " + (err.message || err));
  }
}

async function submitScoreFromParent(score) {
  if (!gameContract || !signer) {
    alert("Connect wallet dulu sebelum submit skor.");
    return;
  }
  try {
    // sanitize score
    const s = Math.max(0, Math.min(3000, Number(score || 0)));
    const tx = await gameContract.submitScore(s);
    await tx.wait();
    alert("Skor terkirim ke leaderboard ✅");
    // optional: refresh leaderboard
    loadLeaderboardFrame();
  } catch (err) {
    console.error(err);
    alert("Gagal submit skor: " + (err.message || err));
  }
}

async function loadLeaderboardFrame() {
  // just reload iframe to call its own loader
  const lb = document.getElementById("leaderboardFrame");
  lb.src = "leaderboard.html?ts=" + Date.now();
  lb.style.display = "block";
  document.getElementById("gameFrame").style.display = "none";
}

// listen messages from iframe
window.addEventListener("message", (ev) => {
  const data = ev.data || {};
  if (data.type === "submitScore") {
    submitScoreFromParent(data.score);
  }
  if (data.type === "requestStartFee") {
    // send fee to iframe for display
    if (startFeeWei) {
      const feeEth = ethers.utils.formatEther(startFeeWei);
      document.getElementById("gameFrame").contentWindow.postMessage({ type: "startFee", feeWei: startFeeWei.toString(), feeEth }, "*");
    }
  }
});

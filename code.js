async function calculateCurrentStock() {
  // Fetch the sales, purchases, and transfers data
  const salesResponse = await fetch("/api/dbf/billdtl.json");
  const salesData = await salesResponse.json();

  const purchaseResponse = await fetch("/api/dbf/purdtl.json");
  const purchaseData = await purchaseResponse.json();

  const transferResponse = await fetch("/api/dbf/transfer.json");
  const transferData = await transferResponse.json();

  let stock = {};

  // Process purchases to increment stock
  purchaseData.forEach(purchase => {
    const { CODE: code, GDN_CODE: gdn_code, QTY: qty, MULT_F: multF, UNIT: unit } = purchase;
    const qtyInPieces = (unit === "BOX" || unit === "Box") ? qty * multF : qty;

    if (!stock[code]) {
      stock[code] = {};
    }
    if (!stock[code][gdn_code]) {
      stock[code][gdn_code] = 0;
    }
    stock[code][gdn_code] += qtyInPieces;
  });

  // Process sales to decrement stock
  salesData.forEach(sale => {
    const { CODE: code, GDN_CODE: gdn_code, QTY: qty, MULT_F: multF, UNIT: unit } = sale;
    const qtyInPieces = (unit === "BOX" || unit === "Box") ? qty * multF : qty;

    if (stock[code] && stock[code][gdn_code]) {
      stock[code][gdn_code] -= qtyInPieces;
    }
  });

  // Process transfers
  transferData.forEach(transfer => {
    const { CODE: code, GDN_CODE: from_gdn, TRF_TO: to_gdn, QTY: qty, MULT_F: multF, UNIT: unit } = transfer;
    const qtyInPieces = (unit === "BOX" || unit === "Box") ? qty * multF : qty;

    // Handle outgoing transfers
    if (stock[code] && stock[code][from_gdn]) {
      stock[code][from_gdn] -= Math.abs(qtyInPieces); // Ensure qty is subtracted
    }

    // Handle incoming transfers
    if (!stock[code]) {
      stock[code] = {};
    }
    if (!stock[code][to_gdn]) {
      stock[code][to_gdn] = 0;
    }
    stock[code][to_gdn] += Math.abs(qtyInPieces); // Ensure qty is added
  });

  return stock;
}
// Call the function and log the result
calculateCurrentStock().then(stock => console.log(stock["GJ871"]));

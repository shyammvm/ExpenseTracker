function generateDailySpend3D() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const targetSheetName = "Master Data";

  const fixedSheet = ss.getSheetByName("Fixed");
  const fixedCategories = fixedSheet ? fixedSheet.getRange("A2:A" + fixedSheet.getLastRow()).getValues().flat().filter(String) : [];
  const fixedSet = new Set(fixedCategories.map(c => c.trim().toLowerCase()));

  let outSheet = ss.getSheetByName(targetSheetName);
  if (!outSheet) outSheet = ss.insertSheet(targetSheetName);

  const masterValues = outSheet.getDataRange().getValues();
  const masterHeaders = masterValues[0] || [];
  const uidIdx = masterHeaders.indexOf("UID");

  if (uidIdx === -1) {
    outSheet.clear();
    outSheet.appendRow(["Date", "Category", "Expense", "Amount", "Week Number", "Week Type", "Month", "Spend Type", "Debit or Credit", "UID"]);
  }

  const refreshedMasterValues = outSheet.getDataRange().getValues();
  const refreshedUIDIdx = refreshedMasterValues[0].indexOf("UID");

  const uidToRowMap = new Map();
  for (let i = 1; i < refreshedMasterValues.length; i++) {
    const uid = refreshedMasterValues[i][refreshedUIDIdx];
    if (uid) uidToRowMap.set(uid, i + 1);
  }

  const allNewRows = [];
  const allowedMonths = getLastTwoMonths();
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  for (const sheet of sheets) {
    const name = sheet.getName();
    if (!allowedMonths.includes(name)) continue;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = {
      name: headers.indexOf("Name"),
      amount: headers.indexOf("Amount"),
      category: headers.indexOf("Category"),
      weeknumber: headers.indexOf("Week Number"),
      weektype: headers.indexOf("Week Type"),
      date: headers.indexOf("Date"),
      uid: headers.indexOf("UID"),
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dateStr = row[idx.date];
      const uid = row[idx.uid];
      if (!uid || !dateStr) continue;

      const dateObj = new Date(dateStr);
      const monthStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "MMMM yyyy");
      const spendType = fixedSet.has((row[idx.category] || '').trim().toLowerCase()) ? "Fixed" : "Variable";

      const preparedRow = [
        Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        row[idx.category],
        row[idx.name],
        row[idx.amount],
        row[idx.weeknumber],
        row[idx.weektype],
        monthStr,
        spendType,
        "Debit",
        uid
      ];

      if (uidToRowMap.has(uid)) {
        const masterRow = uidToRowMap.get(uid);
        const existingRow = outSheet.getRange(masterRow, 1, 1, preparedRow.length).getValues()[0];
        const isDifferent = preparedRow.some((val, col) => val !== existingRow[col]);
        if (isDifferent && dateObj >= sevenDaysAgo) {
          outSheet.getRange(masterRow, 1, 1, preparedRow.length).setValues([preparedRow]);
        }
      } else {
        if (dateObj >= sevenDaysAgo) allNewRows.push(preparedRow);
      }
    }
  }

  const creditSheet = ss.getSheetByName("Current Credit Cycle");
  if (creditSheet) {
    const creditData = creditSheet.getDataRange().getValues();
    const creditHeaders = creditData[0];
    const idx = {
      name: creditHeaders.indexOf("Name"),
      amount: creditHeaders.indexOf("Amount"),
      category: creditHeaders.indexOf("Category"),
      date: creditHeaders.indexOf("Date"),
      uid: creditHeaders.indexOf("UID"),
      weeknum: creditHeaders.indexOf("Week Number"),
      weektype: creditHeaders.indexOf("Week Type")
    };

    for (let i = 1; i < creditData.length; i++) {
      const row = creditData[i];
      const dateStr = row[idx.date];
      const uid = row[idx.uid];
      if (!uid || !dateStr) continue;

      const dateObj = new Date(dateStr);
      const monthStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "MMMM yyyy");
      const spendType = fixedSet.has((row[idx.category] || '').trim().toLowerCase()) ? "Fixed" : "Variable";

      const preparedRow = [
        Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        row[idx.category],
        row[idx.name],
        row[idx.amount],
        row[idx.weeknum],
        row[idx.weektype],
        monthStr,
        spendType,
        "Credit",
        uid
      ];

      if (uidToRowMap.has(uid)) {
        const masterRow = uidToRowMap.get(uid);
        const existingRow = outSheet.getRange(masterRow, 1, 1, preparedRow.length).getValues()[0];
        const isDifferent = preparedRow.some((val, col) => val !== existingRow[col]);
        if (isDifferent && dateObj >= sevenDaysAgo) {
          outSheet.getRange(masterRow, 1, 1, preparedRow.length).setValues([preparedRow]);
        }
      } else {
        if (dateObj >= sevenDaysAgo) allNewRows.push(preparedRow);
      }
    }
  }

  if (allNewRows.length > 0) {
    const lastRow = outSheet.getLastRow();
    outSheet.getRange(lastRow + 1, 1, allNewRows.length, allNewRows[0].length).setValues(allNewRows);
  }
}

function getLastTwoMonths() {
  const now = new Date();
  const thisMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), "MMMM yyyy");
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), "MMMM yyyy");
  return [lastMonth, thisMonth];
}